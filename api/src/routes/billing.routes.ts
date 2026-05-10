import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// Generate bill number
const generateBillNo = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const result = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM bills WHERE EXTRACT(YEAR FROM bill_date) = $1",
    [year]
  );
  const seq = String(parseInt(result?.count || '0') + 1).padStart(6, '0');
  return `BILL-${year}-${seq}`;
};

// Calculate bill using tiered tariff
const calculateBill = async (customerId: number, consumption: number): Promise<any> => {
  const customer = await queryOne<any>(
    'SELECT tariff_category_id FROM customers WHERE id = $1',
    [customerId]
  );

  if (!customer?.tariff_category_id) {
    return { water_charge: 0, fixed_charge: 0, total: 0 };
  }

  const tariffs = await query<any>(
    `SELECT * FROM tariff_lines 
     WHERE tariff_category_id = $1 AND is_active = true
     AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY min_units`,
    [customer.tariff_category_id]
  );

  let waterCharge = 0;
  let remainingConsumption = consumption;
  let fixedCharge = 0;

  for (const tariff of tariffs) {
    if (remainingConsumption <= 0) break;
    
    const blockSize = tariff.max_units - tariff.min_units;
    const usedInBlock = Math.min(remainingConsumption, blockSize);
    waterCharge += usedInBlock * tariff.rate;
    fixedCharge = Math.max(fixedCharge, tariff.fixed_charge);
    remainingConsumption -= usedInBlock;
  }

  // If consumption exceeds all blocks, use last block rate
  if (remainingConsumption > 0 && tariffs.length > 0) {
    const lastTariff = tariffs[tariffs.length - 1];
    waterCharge += remainingConsumption * lastTariff.rate;
  }

  return { water_charge: waterCharge, fixed_charge: fixedCharge };
};

// Create bill
router.post('/generate', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, meter_reading_id, bill_date, due_date } = req.body;

    const reading = await queryOne<any>(
      'SELECT * FROM meter_readings WHERE id = $1',
      [meter_reading_id]
    );

    if (!reading) {
      return res.status(404).json({ success: false, message: 'Meter reading not found' });
    }

    const consumption = reading.consumption;
    const charges = await calculateBill(customer_id, consumption);

    const billNo = await generateBillNo();
    const totalAmount = charges.water_charge + charges.fixed_charge;

    const result = await queryOne<any>(
      `INSERT INTO bills (bill_no, customer_id, billing_period_id, meter_reading_id,
       bill_date, due_date, prev_reading, curr_reading, consumption,
       water_charge, fixed_charge, total_amount, balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'unpaid')
       RETURNING *`,
      [billNo, customer_id, reading.billing_period_id, meter_reading_id,
       bill_date, due_date, reading.previous_reading, reading.current_reading,
       consumption, charges.water_charge, charges.fixed_charge, totalAmount, totalAmount]
    );

    // Mark reading as billed
    await query('UPDATE meter_readings SET is_billed = true WHERE id = $1', [meter_reading_id]);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Bill generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate bill' });
  }
});

// Get bills
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, status, period_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT b.*, c.name as customer_name, c.account_no
               FROM bills b
               JOIN customers c ON b.customer_id = c.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND b.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (status) {
      paramCount++;
      sql += ` AND b.status = $${paramCount}`;
      params.push(status);
    }
    if (period_id) {
      paramCount++;
      sql += ` AND b.billing_period_id = $${paramCount}`;
      params.push(period_id);
    }

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`,
      params
    );

    paramCount++;
    sql += ` ORDER BY b.bill_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const bills = await query(sql, params);

    res.json({
      success: true,
      data: bills,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0'),
        pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Bill list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bills' });
  }
});

// Cancel bill
router.post('/:id/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await queryOne<any>(
      `UPDATE bills SET is_cancelled = true, cancel_reason = $1, status = 'cancelled'
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel bill' });
  }
});

// Get single bill with full details
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bill = await queryOne<any>(
      `SELECT b.*, c.name as customer_name, c.account_no, c.address, c.telephone,
        bg.name as billing_group_name, z.name as zone_name,
        mr.current_reading, mr.previous_reading, mr.reading_date,
        fp.period_name, fp.start_date as period_start, fp.end_date as period_end
       FROM bills b
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       LEFT JOIN zones z ON c.zone_id = z.id
       LEFT JOIN meter_readings mr ON b.meter_reading_id = mr.id
       LEFT JOIN financial_periods fp ON b.billing_period_id = fp.id
       WHERE b.id = $1`,
      [id]
    );
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    const adjustments = await query(
      'SELECT * FROM bill_adjustments WHERE bill_id = $1 ORDER BY created_at DESC',
      [id]
    );
    const reprints = await query(
      'SELECT * FROM bill_reprints WHERE bill_id = $1 ORDER BY printed_at DESC',
      [id]
    );
    res.json({ success: true, data: { ...bill, adjustments, reprints } });
  } catch (error) {
    console.error('Bill detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bill' });
  }
});

// Adjust bill
router.post('/:id/adjust', verifyToken, requirePermission('billing', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adjustment_type, new_amount, reason } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const bill = await client.query('SELECT * FROM bills WHERE id = $1', [id]);
      if (bill.rows.length === 0) throw new Error('Bill not found');
      if (bill.rows[0].is_cancelled) throw new Error('Cannot adjust cancelled bill');

      const original = parseFloat(bill.rows[0].total_amount);
      const adjusted = parseFloat(new_amount);
      const diff = adjusted - original;

      await client.query(
        `INSERT INTO bill_adjustments (bill_id, adjustment_type, original_amount, adjusted_amount, difference, reason, adjusted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, adjustment_type, original, adjusted, diff, reason, userId]
      );

      const newBalance = parseFloat(bill.rows[0].balance) + diff;
      const updated = await client.query(
        `UPDATE bills SET total_amount = $1, balance = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        [adjusted, newBalance, id]
      );
      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Bill adjustment error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to adjust bill' });
  }
});

// Reprint bill
router.post('/:id/reprint', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;

    await query(
      `INSERT INTO bill_reprints (bill_id, reprint_reason, printed_by) VALUES ($1, $2, $3)`,
      [id, reason, userId]
    );

    const updated = await queryOne<any>(
      `UPDATE bills SET reprint_count = COALESCE(reprint_count, 0) + 1, last_printed_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Reprint error:', error);
    res.status(500).json({ success: false, message: 'Failed to reprint bill' });
  }
});

// Mass generate bills for a billing period
router.post('/mass-generate', verifyToken, requirePermission('billing', 'create'), async (req: Request, res: Response) => {
  try {
    const { billing_period_id, bill_date, due_date } = req.body;
    const userId = (req as any).user?.id;

    const unbilledReadings = await query<any>(
      `SELECT mr.*, c.tariff_category_id
       FROM meter_readings mr
       JOIN customers c ON mr.customer_id = c.id
       WHERE mr.billing_period_id = $1 AND mr.is_billed = false
       AND c.account_status = 'active'`,
      [billing_period_id]
    );

    const results = [];
    for (const reading of unbilledReadings) {
      const charges = await calculateBill(reading.customer_id, reading.consumption);
      const billNo = await generateBillNo();
      const totalAmount = charges.water_charge + charges.fixed_charge;

      const bill = await queryOne<any>(
        `INSERT INTO bills (bill_no, customer_id, billing_period_id, meter_reading_id,
         bill_date, due_date, prev_reading, curr_reading, consumption,
         water_charge, fixed_charge, total_amount, balance, status, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'unpaid', $14)
         RETURNING *`,
        [billNo, reading.customer_id, billing_period_id, reading.id,
         bill_date, due_date, reading.previous_reading, reading.current_reading,
         reading.consumption, charges.water_charge, charges.fixed_charge, totalAmount, totalAmount, userId]
      );

      await query('UPDATE meter_readings SET is_billed = true WHERE id = $1', [reading.id]);
      results.push(bill);
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('Mass billing error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate bills' });
  }
});

// Apply penalty to a bill
router.post('/:id/apply-penalty', verifyToken, requirePermission('billing', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { penalty_amount, interest_amount, reason } = req.body;

    const bill = await queryOne<any>(
      `UPDATE bills SET
        penalty_amount = COALESCE(penalty_amount, 0) + $1,
        interest_amount = COALESCE(interest_amount, 0) + $2,
        total_amount = total_amount + $1 + $2,
        balance = balance + $1 + $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [penalty_amount || 0, interest_amount || 0, id]
    );

    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Penalty error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply penalty' });
  }
});

// Get penalty rules
router.get('/penalty-rules', verifyToken, async (req: Request, res: Response) => {
  try {
    const rules = await query('SELECT * FROM penalty_rules WHERE is_active = true ORDER BY days_overdue');
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Penalty rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to load penalty rules' });
  }
});

// Get tariff categories
router.get('/tariffs/categories', verifyToken, async (req: Request, res: Response) => {
  try {
    const categories = await query('SELECT * FROM tariff_categories WHERE is_active = true');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load tariffs' });
  }
});

export default router;
