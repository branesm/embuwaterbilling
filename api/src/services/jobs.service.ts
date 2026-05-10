import cron from 'node-cron';
import { query, queryOne } from '../config/database';

// Log job execution
const logJob = async (name: string, status: string, details?: string) => {
  console.log(`[${new Date().toISOString()}] Job: ${name} | Status: ${status}${details ? ' | ' + details : ''}`);
};

// Auto billing job - generates bills for unbilled readings daily at midnight
const runAutoBilling = async () => {
  try {
    const openPeriod = await queryOne<any>(
      "SELECT id FROM financial_periods WHERE status = 'open' ORDER BY start_date DESC LIMIT 1"
    );
    if (!openPeriod) {
      await logJob('auto_billing', 'skipped', 'No open financial period');
      return;
    }

    const unbilledReadings = await query<any>(
      `SELECT mr.id, mr.customer_id, mr.reading_date, mr.consumption, c.tariff_category_id
       FROM meter_readings mr
       JOIN customers c ON mr.customer_id = c.id
       WHERE mr.is_billed = false AND c.account_status = 'active'
       LIMIT 100`
    );

    let generated = 0;
    for (const reading of unbilledReadings) {
      try {
        // Get tariff lines for customer
        const tariffLines = await query<any>(
          `SELECT * FROM tariff_lines
           WHERE tariff_category_id = $1 AND is_active = true
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
           ORDER BY min_units`,
          [reading.tariff_category_id]
        );

        let waterCharge = 0;
        let remainingUnits = parseFloat(reading.consumption);
        for (const line of tariffLines) {
          if (remainingUnits <= 0) break;
          const tierUnits = Math.min(remainingUnits, parseFloat(line.max_units) - parseFloat(line.min_units));
          waterCharge += tierUnits * parseFloat(line.rate);
          remainingUnits -= tierUnits;
        }

        const fixedCharge = tariffLines.length > 0 ? parseFloat(tariffLines[0].fixed_charge || 0) : 0;
        const sewerCharge = waterCharge * 0.2; // 20% sewer surcharge
        const totalAmount = waterCharge + sewerCharge + fixedCharge;
        const billNo = `BILL-${Date.now()}-${reading.customer_id}`;

        await queryOne(
          `INSERT INTO bills (bill_no, customer_id, reading_id, billing_period_id, bill_date, due_date,
           water_charge, sewer_charge, fixed_charge, total_amount, balance, status)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days',
           $5, $6, $7, $8, $9, 'unpaid')`,
          [billNo, reading.customer_id, reading.id, openPeriod.id, waterCharge, sewerCharge, fixedCharge, totalAmount, totalAmount]
        );

        await query('UPDATE meter_readings SET is_billed = true WHERE id = $1', [reading.id]);
        generated++;
      } catch (err) {
        console.error(`Auto billing failed for reading ${reading.id}:`, err);
      }
    }

    await logJob('auto_billing', 'completed', `Generated ${generated} bills`);
  } catch (error) {
    await logJob('auto_billing', 'failed', String(error));
  }
};

// Arrears check job - flags customers with overdue bills daily at 1 AM
const runArrearsCheck = async () => {
  try {
    const overdueCustomers = await query<any>(
      `SELECT c.id, c.name, c.account_no, c.telephone, c.balance,
        COUNT(b.id) as overdue_bills,
        SUM(b.balance) as total_overdue
       FROM customers c
       JOIN bills b ON b.customer_id = c.id
       WHERE b.due_date < CURRENT_DATE AND b.status IN ('unpaid', 'partial')
       AND c.account_status = 'active'
       GROUP BY c.id
       HAVING COUNT(b.id) >= 2 OR SUM(b.balance) >= 1000`
    );

    for (const customer of overdueCustomers) {
      // Create arrears action record
      await queryOne(
        `INSERT INTO bill_adjustments (bill_id, adjustment_type, original_amount, adjusted_amount, difference, reason, adjusted_by)
         SELECT id, 'arrears_flag', total_amount, total_amount, 0, 'Auto arrears check', NULL
         FROM bills WHERE customer_id = $1 AND due_date < CURRENT_DATE AND status IN ('unpaid', 'partial')
         AND NOT EXISTS (
           SELECT 1 FROM bill_adjustments WHERE bill_id = bills.id AND adjustment_type = 'arrears_flag'
         )
         LIMIT 1`,
        [customer.id]
      );
    }

    await logJob('arrears_check', 'completed', `${overdueCustomers.length} customers flagged`);
  } catch (error) {
    await logJob('arrears_check', 'failed', String(error));
  }
};

// Disconnection notice job - prepares disconnection list daily at 2 AM
const runDisconnectionNotices = async () => {
  try {
    const eligibleCustomers = await query<any>(
      `SELECT c.id, c.name, c.account_no, c.telephone, c.balance,
        MAX(b.due_date) as oldest_due_date
       FROM customers c
       JOIN bills b ON b.customer_id = c.id
       WHERE b.due_date < CURRENT_DATE - INTERVAL '30 days'
       AND b.status IN ('unpaid', 'partial')
       AND c.account_status = 'active'
       GROUP BY c.id
       HAVING SUM(b.balance) >= 500`
    );

    for (const customer of eligibleCustomers) {
      // Check if notice already exists
      const existing = await queryOne(
        'SELECT id FROM disconnections WHERE customer_id = $1 AND status IN ($2, $3)',
        [customer.id, 'pending', 'approved']
      );

      if (!existing) {
        await queryOne(
          `INSERT INTO disconnections (customer_id, status, reason, outstanding_balance, disc_date, created_by)
           VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '7 days', NULL)`,
          [customer.id, 'pending', 'Auto-generated: 30+ days overdue', customer.balance]
        );
      }
    }

    await logJob('disconnection_notices', 'completed', `${eligibleCustomers.length} notices prepared`);
  } catch (error) {
    await logJob('disconnection_notices', 'failed', String(error));
  }
};

// M-Pesa reconciliation check - marks old pending transactions as failed every 15 minutes
const runMpesaReconciliation = async () => {
  try {
    const result = await queryOne<{ count: string }>(
      `UPDATE mpesa_transactions
       SET status = 'failed', result_desc = 'Transaction timed out'
       WHERE status = 'pending'
       AND created_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
       AND transaction_type = 'STK_PUSH'
       RETURNING COUNT(*) as count`
    );

    const count = result?.count || '0';
    if (parseInt(count) > 0) {
      await logJob('mpesa_reconciliation', 'completed', `${count} stale transactions marked failed`);
    }
  } catch (error) {
    await logJob('mpesa_reconciliation', 'failed', String(error));
  }
};

// Initialize all scheduled jobs
export const initializeJobs = () => {
  console.log('[Jobs] Initializing scheduled jobs...');

  // Auto billing: daily at 00:00
  cron.schedule('0 0 * * *', runAutoBilling);

  // Arrears check: daily at 01:00
  cron.schedule('0 1 * * *', runArrearsCheck);

  // Disconnection notices: daily at 02:00
  cron.schedule('0 2 * * *', runDisconnectionNotices);

  // M-Pesa reconciliation: every 15 minutes
  cron.schedule('*/15 * * * *', runMpesaReconciliation);

  console.log('[Jobs] All scheduled jobs initialized');
};

// Manual trigger endpoints (for testing/admin)
export const triggerJob = async (jobName: string) => {
  switch (jobName) {
    case 'auto_billing':
      await runAutoBilling();
      break;
    case 'arrears_check':
      await runArrearsCheck();
      break;
    case 'disconnection_notices':
      await runDisconnectionNotices();
      break;
    case 'mpesa_reconciliation':
      await runMpesaReconciliation();
      break;
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
};
