const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Calculate bill using tiered tariff
const calculateBill = async (customerId, consumption, connection) => {
  // Get customer property type
  const [customers] = await connection.execute(
    'SELECT property_type FROM customers WHERE id = ?',
    [customerId]
  );
  
  if (customers.length === 0) throw new Error('Customer not found');
  
  const propertyType = customers[0].property_type;
  
  // Get active tariff config
  const [tariffs] = await connection.execute(
    `SELECT * FROM tariff_configs 
     WHERE property_type = ? AND is_active = TRUE 
     AND effective_from <= CURDATE() AND (effective_to IS NULL OR effective_to >= CURDATE())
     ORDER BY effective_from DESC LIMIT 1`,
    [propertyType]
  );
  
  if (tariffs.length === 0) throw new Error('No active tariff found');
  
  const tariff = tariffs[0];
  
  // Get tariff tiers
  const [tiers] = await connection.execute(
    'SELECT * FROM tariff_tiers WHERE tariff_config_id = ? ORDER BY tier_order',
    [tariff.id]
  );
  
  // Calculate water charge by tier
  let remainingConsumption = consumption;
  let waterCharge = 0;
  const tierCharges = [];
  
  for (const tier of tiers) {
    if (remainingConsumption <= 0) break;
    
    const tierRange = tier.max_consumption - tier.min_consumption;
    const tierConsumption = Math.min(remainingConsumption, tierRange);
    const tierCharge = tierConsumption * tier.rate_per_unit;
    
    waterCharge += tierCharge;
    tierCharges.push({
      tier: tier.tier_order,
      consumption: tierConsumption,
      rate: tier.rate_per_unit,
      amount: tierCharge
    });
    
    remainingConsumption -= tierConsumption;
  }
  
  // Calculate other charges
  const sewerageCharge = waterCharge * (tariff.sewerage_rate / 100);
  const standingCharge = tariff.standing_charge;
  const meterRent = tariff.meter_rent;
  
  const totalAmount = waterCharge + sewerageCharge + standingCharge + meterRent;
  
  return {
    waterCharge,
    sewerageCharge,
    standingCharge,
    meterRent,
    totalAmount,
    tierCharges,
    tariffConfigId: tariff.id
  };
};

// Generate bill number
const generateBillNumber = async (connection) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [result] = await connection.execute(
    "SELECT COUNT(*) as count FROM bills WHERE billing_period LIKE ?",
    [`${year}-${month}%`]
  );
  
  const sequence = String(result[0].count + 1).padStart(5, '0');
  return `BILL-${year}${month}-${sequence}`;
};

// Get bills
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { customer, status, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT b.*, c.account_number, c.first_name, c.last_name 
             FROM bills b 
             LEFT JOIN customers c ON b.customer_id = c.id WHERE 1=1`;
  const params = [];

  if (customer) { sql += ' AND b.customer_id = ?'; params.push(customer); }
  if (status) { sql += ' AND b.status = ?'; params.push(status); }

  sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const bills = await executeQuery(sql, params);

  res.json({ success: true, data: bills });
}));

// List billing periods
router.get('/periods', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const periods = await executeQuery(
    'SELECT bp.*, u.username as created_by_name FROM billing_periods bp LEFT JOIN users u ON bp.created_by = u.id ORDER BY bp.start_date DESC'
  );
  res.json({ success: true, data: periods });
}));

// Create billing period
router.post('/periods', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { periodCode, periodName, startDate, endDate, dueDate } = req.body;
  if (!periodCode || !periodName || !startDate || !endDate || !dueDate) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const result = await executeQuery(
    'INSERT INTO billing_periods (period_code, period_name, start_date, end_date, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [periodCode, periodName, startDate, endDate, dueDate, req.user.id]
  );
  res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Billing period created' });
}));

// Update period status
router.put('/periods/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ message: 'Status must be open or closed' });
  }
  await executeQuery('UPDATE billing_periods SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true, message: `Period ${status}` });
}));

// List penalty rules
router.get('/penalty-rules', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const rules = await executeQuery('SELECT * FROM penalty_rules ORDER BY created_at DESC');
  res.json({ success: true, data: rules });
}));

// Create penalty rule
router.post('/penalty-rules', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { name, graceDays, penaltyType, penaltyRate, maxPenalty } = req.body;
  if (!name || !penaltyType || penaltyRate === undefined) {
    return res.status(400).json({ message: 'Name, type and rate are required' });
  }
  const result = await executeQuery(
    'INSERT INTO penalty_rules (name, grace_days, penalty_type, penalty_rate, max_penalty) VALUES (?, ?, ?, ?, ?)',
    [name, graceDays || 14, penaltyType, penaltyRate, maxPenalty || null]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

// List mass billing runs
router.get('/mass-runs', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const runs = await executeQuery(
    `SELECT mbr.*, bp.period_code, bp.period_name, u.username as created_by_name,
     br.route_name, z.name as zone_name
     FROM mass_billing_runs mbr
     LEFT JOIN billing_periods bp ON mbr.period_id = bp.id
     LEFT JOIN users u ON mbr.created_by = u.id
     LEFT JOIN billing_routes br ON mbr.route_id = br.id
     LEFT JOIN zones z ON mbr.zone_id = z.id
     ORDER BY mbr.created_at DESC LIMIT 50`
  );
  res.json({ success: true, data: runs });
}));

// Mass bill generation
router.post('/mass-generate', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { periodId, routeId, zoneId } = req.body;
  if (!periodId) return res.status(400).json({ message: 'Period is required' });

  // Verify period exists and is open
  const [period] = await executeQuery('SELECT * FROM billing_periods WHERE id = ?', [periodId]);
  if (!period) return res.status(404).json({ message: 'Period not found' });
  if (period.status === 'closed') return res.status(400).json({ message: 'Period is closed' });

  // Create mass billing run record
  const runResult = await executeQuery(
    'INSERT INTO mass_billing_runs (period_id, route_id, zone_id, status, started_at, created_by) VALUES (?, ?, ?, ?, NOW(), ?)',
    [periodId, routeId || null, zoneId || null, 'running', req.user.id]
  );
  const runId = runResult.insertId;

  // Update period status to generating
  await executeQuery('UPDATE billing_periods SET status = ? WHERE id = ?', ['generating', periodId]);

  try {
    // Find unbilled readings for this period
    let readingSql = `SELECT mr.* FROM meter_readings mr
      LEFT JOIN customers c ON mr.customer_id = c.id
      WHERE mr.is_billed = FALSE AND mr.billing_period = ?`;
    const readingParams = [period.period_code];

    if (routeId) { readingSql += ' AND mr.route_id = ?'; readingParams.push(routeId); }
    if (zoneId) { readingSql += ' AND c.zone_id = ?'; readingParams.push(zoneId); }

    const readings = await executeQuery(readingSql, readingParams);

    let billsGenerated = 0;
    let errors = 0;
    const errorDetails = [];

    // Process in batches of 50
    for (let i = 0; i < readings.length; i += 50) {
      const batch = readings.slice(i, i + 50);

      for (const reading of batch) {
        try {
          await withTransaction(async (connection) => {
            // Get customer balance
            const [customers] = await connection.execute(
              'SELECT balance FROM customers WHERE id = ?', [reading.customer_id]
            );
            if (customers.length === 0) throw new Error(`Customer ${reading.customer_id} not found`);
            const previousBalance = customers[0].balance;

            // Calculate bill
            const calculation = await calculateBill(reading.customer_id, reading.consumption, connection);

            // Generate bill number
            const billNumber = await generateBillNumber(connection);

            // Create bill
            const [billResult] = await connection.execute(
              `INSERT INTO bills (bill_number, customer_id, meter_id, reading_id, billing_period,
               bill_date, due_date, previous_balance, water_charge, sewerage_charge, standing_charge,
               meter_rent, total_amount, balance, consumption_units, generated_by, created_at)
               VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                billNumber, reading.customer_id, reading.meter_id, reading.id, period.period_code,
                period.due_date, previousBalance, calculation.waterCharge,
                calculation.sewerageCharge, calculation.standingCharge, calculation.meterRent,
                calculation.totalAmount + previousBalance, calculation.totalAmount + previousBalance,
                reading.consumption, req.user.id
              ]
            );

            // Create bill items
            for (const tier of calculation.tierCharges) {
              await connection.execute(
                `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount, tier_order)
                 VALUES (?, 'water_tier', ?, ?, ?, ?, ?)`,
                [billResult.insertId, `Water tier ${tier.tier}`, tier.consumption, tier.rate, tier.amount, tier.tier]
              );
            }
            if (calculation.sewerageCharge > 0) {
              await connection.execute(
                `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
                 VALUES (?, 'sewerage', 'Sewerage charge', 1, ?, ?)`,
                [billResult.insertId, calculation.sewerageCharge, calculation.sewerageCharge]
              );
            }
            if (calculation.standingCharge > 0) {
              await connection.execute(
                `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
                 VALUES (?, 'standing_charge', 'Standing charge', 1, ?, ?)`,
                [billResult.insertId, calculation.standingCharge, calculation.standingCharge]
              );
            }
            if (previousBalance > 0) {
              await connection.execute(
                `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
                 VALUES (?, 'arrears', 'Previous balance', 1, ?, ?)`,
                [billResult.insertId, previousBalance, previousBalance]
              );
            }

            // Update customer balance
            await connection.execute(
              'UPDATE customers SET balance = balance + ? WHERE id = ?',
              [calculation.totalAmount, reading.customer_id]
            );

            // Mark reading as billed
            await connection.execute('UPDATE meter_readings SET is_billed = TRUE WHERE id = ?', [reading.id]);
          });

          billsGenerated++;
        } catch (err) {
          errors++;
          errorDetails.push({ readingId: reading.id, customerId: reading.customer_id, error: err.message });
        }
      }
    }

    // Update run record
    await executeQuery(
      `UPDATE mass_billing_runs SET status = ?, bills_generated = ?, total_customers = ?, errors = ?, error_details = ?, completed_at = NOW() WHERE id = ?`,
      ['completed', billsGenerated, readings.length, errors, JSON.stringify(errorDetails), runId]
    );

    // Reset period status to open
    await executeQuery('UPDATE billing_periods SET status = ? WHERE id = ?', ['open', periodId]);

    res.json({
      success: true,
      message: 'Mass billing completed',
      data: { runId, totalReadings: readings.length, billsGenerated, errors, errorDetails: errorDetails.slice(0, 10) }
    });
  } catch (err) {
    await executeQuery(
      'UPDATE mass_billing_runs SET status = ?, error_details = ?, completed_at = NOW() WHERE id = ?',
      ['failed', JSON.stringify([{ error: err.message }]), runId]
    );
    await executeQuery('UPDATE billing_periods SET status = ? WHERE id = ?', ['open', periodId]);
    throw err;
  }
}));

// Generate bill from reading
router.post('/generate', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { readingId, customerId, billingPeriod } = req.body;

  if (!readingId || !customerId || !billingPeriod) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const result = await withTransaction(async (connection) => {
    // Get reading
    const [readings] = await connection.execute(
      'SELECT * FROM meter_readings WHERE id = ? AND customer_id = ?',
      [readingId, customerId]
    );
    
    if (readings.length === 0) throw new Error('Reading not found');
    const reading = readings[0];
    
    // Get customer balance
    const [customers] = await connection.execute(
      'SELECT balance FROM customers WHERE id = ?',
      [customerId]
    );
    const previousBalance = customers[0].balance;
    
    // Calculate bill
    const calculation = await calculateBill(customerId, reading.consumption, connection);
    
    // Generate bill number
    const billNumber = await generateBillNumber(connection);
    
    // Calculate due date (14 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    
    // Create bill
    const [billResult] = await connection.execute(
      `INSERT INTO bills (bill_number, customer_id, meter_id, reading_id, billing_period,
       bill_date, due_date, previous_balance, water_charge, sewerage_charge, standing_charge,
       meter_rent, total_amount, balance, consumption_units, generated_by, created_at)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        billNumber, customerId, reading.meter_id, readingId, billingPeriod,
        dueDate.toISOString().split('T')[0], previousBalance, calculation.waterCharge,
        calculation.sewerageCharge, calculation.standingCharge, calculation.meterRent,
        calculation.totalAmount + previousBalance, calculation.totalAmount + previousBalance,
        reading.consumption, req.user.id
      ]
    );
    
    // Create bill items
    for (const tier of calculation.tierCharges) {
      await connection.execute(
        `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount, tier_order)
         VALUES (?, 'water_tier', ?, ?, ?, ?, ?)`,
        [billResult.insertId, `Water consumption tier ${tier.tier}`, tier.consumption, tier.rate, tier.amount, tier.tier]
      );
    }
    
    // Add other charges as line items
    if (calculation.sewerageCharge > 0) {
      await connection.execute(
        `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
         VALUES (?, 'sewerage', 'Sewerage charge (15% of water)', 1, ?, ?)`,
        [billResult.insertId, calculation.sewerageCharge, calculation.sewerageCharge]
      );
    }
    
    if (calculation.standingCharge > 0) {
      await connection.execute(
        `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
         VALUES (?, 'standing_charge', 'Standing charge', 1, ?, ?)`,
        [billResult.insertId, calculation.standingCharge, calculation.standingCharge]
      );
    }
    
    if (previousBalance > 0) {
      await connection.execute(
        `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
         VALUES (?, 'arrears', 'Previous balance brought forward', 1, ?, ?)`,
        [billResult.insertId, previousBalance, previousBalance]
      );
    }
    
    // Mark reading as billed
    await connection.execute(
      'UPDATE meter_readings SET is_billed = TRUE WHERE id = ?',
      [readingId]
    );
    
    return { billId: billResult.insertId, billNumber };
  });

  res.status(201).json({
    success: true,
    message: 'Bill generated successfully',
    data: result
  }));
}));

// Get bill detail
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const [bill] = await executeQuery(
    `SELECT b.*, c.account_number, c.first_name, c.last_name, c.phone, c.address,
     m.serial_number as meter_serial, bp.period_name
     FROM bills b
     LEFT JOIN customers c ON b.customer_id = c.id
     LEFT JOIN meters m ON b.meter_id = m.id
     LEFT JOIN billing_periods bp ON b.billing_period = bp.period_code
     WHERE b.id = ?`,
    [req.params.id]
  );
  if (!bill) return res.status(404).json({ message: 'Bill not found' });

  const items = await executeQuery('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY tier_order, id', [req.params.id]);
  const adjustments = await executeQuery(
    `SELECT ba.*, u.username as created_by_name FROM bill_adjustments ba
     LEFT JOIN users u ON ba.created_by = u.id WHERE ba.bill_id = ? ORDER BY ba.created_at DESC`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...bill, items, adjustments } });
}));

// Create bill adjustment
router.post('/:id/adjust', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { adjustmentType, amount, reason } = req.body;
  if (!adjustmentType || !amount || !reason) {
    return res.status(400).json({ message: 'Type, amount and reason required' });
  }
  if (!['debit', 'credit'].includes(adjustmentType)) {
    return res.status(400).json({ message: 'Type must be debit or credit' });
  }

  const [bill] = await executeQuery('SELECT * FROM bills WHERE id = ? AND status != ?', [req.params.id, 'cancelled']);
  if (!bill) return res.status(404).json({ message: 'Bill not found or cancelled' });

  const adjustmentAmount = adjustmentType === 'debit' ? parseFloat(amount) : -parseFloat(amount);

  await executeQuery(
    'INSERT INTO bill_adjustments (bill_id, adjustment_type, amount, reason, created_by) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, adjustmentType, parseFloat(amount), reason, req.user.id]
  );

  // Update bill balance and adjustments column
  await executeQuery(
    'UPDATE bills SET adjustments = adjustments + ?, balance = balance + ?, total_amount = total_amount + ? WHERE id = ?',
    [adjustmentAmount, adjustmentAmount, adjustmentAmount, req.params.id]
  );

  // Update customer balance
  await executeQuery('UPDATE customers SET balance = balance + ? WHERE id = ?', [adjustmentAmount, bill.customer_id]);

  res.json({ success: true, message: `${adjustmentType} adjustment applied` });
}));

// Cancel bill
router.post('/:id/cancel', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const [bill] = await executeQuery('SELECT * FROM bills WHERE id = ? AND status != ?', [req.params.id, 'cancelled']);
  if (!bill) return res.status(404).json({ message: 'Bill not found or already cancelled' });

  // Reverse the balance impact on customer
  await executeQuery('UPDATE customers SET balance = balance - ? WHERE id = ?', [bill.balance, bill.customer_id]);

  // Cancel the bill
  await executeQuery('UPDATE bills SET status = ?, balance = 0, notes = ? WHERE id = ?', ['cancelled', reason || 'Cancelled', req.params.id]);

  res.json({ success: true, message: 'Bill cancelled' });
}));

// Apply penalty to bill
router.post('/:id/apply-penalty', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { penaltyRuleId } = req.body;

  const [bill] = await executeQuery('SELECT * FROM bills WHERE id = ? AND status IN (?, ?)', [req.params.id, 'unpaid', 'overdue']);
  if (!bill) return res.status(404).json({ message: 'Bill not found or not eligible for penalty' });

  const [rule] = await executeQuery('SELECT * FROM penalty_rules WHERE id = ? AND is_active = TRUE', [penaltyRuleId]);
  if (!rule) return res.status(404).json({ message: 'Penalty rule not found' });

  // Calculate penalty
  let penaltyAmount;
  if (rule.penalty_type === 'fixed') {
    penaltyAmount = rule.penalty_rate;
  } else {
    penaltyAmount = bill.balance * (rule.penalty_rate / 100);
  }
  if (rule.max_penalty && penaltyAmount > rule.max_penalty) {
    penaltyAmount = rule.max_penalty;
  }

  // Apply penalty
  await executeQuery(
    'UPDATE bills SET penalties = penalties + ?, balance = balance + ?, total_amount = total_amount + ? WHERE id = ?',
    [penaltyAmount, penaltyAmount, penaltyAmount, req.params.id]
  );

  // Add as bill item
  await executeQuery(
    `INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
     VALUES (?, 'penalty', ?, 1, ?, ?)`,
    [req.params.id, `Late payment penalty (${rule.name})`, penaltyAmount, penaltyAmount]
  );

  // Update customer balance
  await executeQuery('UPDATE customers SET balance = balance + ? WHERE id = ?', [penaltyAmount, bill.customer_id]);

  res.json({ success: true, message: 'Penalty applied', data: { penaltyAmount } });
}));

module.exports = router;
