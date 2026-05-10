import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Helper to build safe date filter (validates ISO date format)
const dateFilter = (field: string, from?: string, to?: string) => {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  let clause = '';
  if (from && isoDate.test(from)) clause += ` AND ${field} >= '${from}'`;
  if (to && isoDate.test(to)) clause += ` AND ${field} <= '${to}'`;
  return clause;
};

// Aged Analysis Report
router.get('/aged-analysis', verifyToken, async (req: Request, res: Response) => {
  try {
    const { zone_id, category_id, report_type = 'detailed' } = req.query;

    let sql = `
      SELECT 
        c.id, c.account_no, c.name, c.telephone,
        bg.name as billing_group,
        cc.name as category,
        c.balance,
        SUM(CASE WHEN b.status IN ('unpaid', 'partial') AND b.due_date >= CURRENT_DATE THEN b.balance ELSE 0 END) as current_due,
        SUM(CASE WHEN b.status IN ('unpaid', 'partial') AND b.due_date < CURRENT_DATE AND b.due_date >= CURRENT_DATE - INTERVAL '30 days' THEN b.balance ELSE 0 END) as days_1_30,
        SUM(CASE WHEN b.status IN ('unpaid', 'partial') AND b.due_date < CURRENT_DATE - INTERVAL '30 days' AND b.due_date >= CURRENT_DATE - INTERVAL '60 days' THEN b.balance ELSE 0 END) as days_31_60,
        SUM(CASE WHEN b.status IN ('unpaid', 'partial') AND b.due_date < CURRENT_DATE - INTERVAL '60 days' AND b.due_date >= CURRENT_DATE - INTERVAL '90 days' THEN b.balance ELSE 0 END) as days_61_90,
        SUM(CASE WHEN b.status IN ('unpaid', 'partial') AND b.due_date < CURRENT_DATE - INTERVAL '90 days' THEN b.balance ELSE 0 END) as over_90
      FROM customers c
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN customer_categories cc ON c.category_id = cc.id
      LEFT JOIN bills b ON c.id = b.customer_id AND b.is_cancelled = false
      WHERE c.account_status = 'active'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (zone_id) {
      paramCount++;
      sql += ` AND c.zone_id = $${paramCount}`;
      params.push(zone_id);
    }
    if (category_id) {
      paramCount++;
      sql += ` AND c.category_id = $${paramCount}`;
      params.push(category_id);
    }

    sql += ` GROUP BY c.id, c.account_no, c.name, c.telephone, bg.name, cc.name`;

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Aged analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Daily Payments Summary
router.get('/daily-payments', verifyToken, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    const summary = await query(
      `SELECT 
        pm.name as payment_mode,
        COUNT(*) as count,
        SUM(p.amount) as total
       FROM payments p
       LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
       WHERE p.payment_date = $1 AND p.is_cancelled = false
       GROUP BY pm.name`,
      [reportDate]
    );

    const byCashier = await query(
      `SELECT 
        u.first_name || ' ' || COALESCE(u.other_names, '') as cashier,
        COUNT(*) as count,
        SUM(p.amount) as total
       FROM payments p
       LEFT JOIN users u ON p.cashier_id = u.id
       WHERE p.payment_date = $1 AND p.is_cancelled = false
       GROUP BY u.id, u.first_name, u.other_names`,
      [reportDate]
    );

    res.json({ success: true, data: { date: reportDate, summary, byCashier } });
  } catch (error) {
    console.error('Daily payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Collection Efficiency
router.get('/collection-efficiency', verifyToken, async (req: Request, res: Response) => {
  try {
    const { period_id, from_date, to_date } = req.query;

    const data = await query(
      `SELECT
        bg.name as billing_group,
        SUM(b.total_amount) as billed_amount,
        SUM(b.amount_paid) as collected_amount,
        CASE WHEN SUM(b.total_amount) > 0
          THEN ROUND((SUM(b.amount_paid) / SUM(b.total_amount)) * 100, 2)
          ELSE 0
        END as efficiency
       FROM bills b
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       WHERE b.is_cancelled = false
       ${period_id ? 'AND b.billing_period_id = $1' : ''}
       ${dateFilter('b.bill_date', from_date as string, to_date as string)}
       GROUP BY bg.name`,
      period_id ? [period_id] : []
    );

    res.json({ success: true, data });
  } catch (error) {
    console.error('Collection efficiency error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Revenue Summary Report
router.get('/revenue-summary', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date, zone_id, billing_group_id } = req.query;

    let sql = `
      SELECT
        COUNT(DISTINCT b.id) as bill_count,
        SUM(b.water_charge) as water_revenue,
        SUM(b.sewer_charge) as sewer_revenue,
        SUM(b.fixed_charge) as fixed_revenue,
        SUM(b.rent_charge) as rent_revenue,
        SUM(b.misc_charge) as misc_revenue,
        SUM(b.penalty_amount) as penalty_revenue,
        SUM(b.interest_amount) as interest_revenue,
        SUM(b.total_amount) as total_billed,
        SUM(b.amount_paid) as total_collected,
        SUM(b.balance) as total_outstanding
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.is_cancelled = false
    `;
    const params: any[] = [];
    if (from_date && to_date) { params.push(from_date, to_date); sql += ` AND b.bill_date BETWEEN $${params.length - 1} AND $${params.length}`; }
    if (zone_id) { params.push(zone_id); sql += ` AND c.zone_id = $${params.length}`; }
    if (billing_group_id) { params.push(billing_group_id); sql += ` AND c.billing_group_id = $${params.length}`; }

    const summary = await queryOne(sql, params);

    // Revenue by billing group
    let bgSql = `
      SELECT bg.name as billing_group,
        SUM(b.total_amount) as billed,
        SUM(b.amount_paid) as collected
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      WHERE b.is_cancelled = false
    `;
    const bgParams: any[] = [];
    if (from_date && to_date) { bgParams.push(from_date, to_date); bgSql += ` AND b.bill_date BETWEEN $${bgParams.length - 1} AND $${bgParams.length}`; }
    bgSql += ` GROUP BY bg.name ORDER BY billed DESC`;
    const byBillingGroup = await query(bgSql, bgParams);

    res.json({ success: true, data: { summary, byBillingGroup } });
  } catch (error) {
    console.error('Revenue summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Debtors List Report
router.get('/debtors-list', verifyToken, async (req: Request, res: Response) => {
  try {
    const { zone_id, billing_group_id, min_balance, max_balance, status } = req.query;

    let sql = `
      SELECT c.id, c.account_no, c.name, c.telephone, c.address, c.balance,
        bg.name as billing_group, z.name as zone, cc.name as category,
        COUNT(b.id) as unpaid_bills,
        MIN(b.due_date) as oldest_due_date
      FROM customers c
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN zones z ON c.zone_id = z.id
      LEFT JOIN customer_categories cc ON c.category_id = cc.id
      LEFT JOIN bills b ON c.id = b.customer_id AND b.is_cancelled = false AND b.status IN ('unpaid', 'partial')
      WHERE c.balance > 0
    `;
    const params: any[] = [];
    if (zone_id) { params.push(zone_id); sql += ` AND c.zone_id = $${params.length}`; }
    if (billing_group_id) { params.push(billing_group_id); sql += ` AND c.billing_group_id = $${params.length}`; }
    if (min_balance) { params.push(min_balance); sql += ` AND c.balance >= $${params.length}`; }
    if (max_balance) { params.push(max_balance); sql += ` AND c.balance <= $${params.length}`; }
    if (status) { params.push(status); sql += ` AND c.account_status = $${params.length}`; }

    sql += ` GROUP BY c.id, c.account_no, c.name, c.telephone, c.address, c.balance, bg.name, z.name, cc.name ORDER BY c.balance DESC`;

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Debtors list error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Consumption Summary Report
router.get('/consumption-summary', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date, zone_id, billing_group_id } = req.query;

    let sql = `
      SELECT
        bg.name as billing_group,
        z.name as zone,
        COUNT(DISTINCT mr.id) as reading_count,
        SUM(mr.consumption) as total_consumption,
        AVG(mr.consumption) as avg_consumption,
        SUM(CASE WHEN mr.is_estimated THEN 1 ELSE 0 END) as estimated_count,
        SUM(CASE WHEN mr.anomaly_flag THEN 1 ELSE 0 END) as anomaly_count
      FROM meter_readings mr
      JOIN customers c ON mr.customer_id = c.id
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN zones z ON c.zone_id = z.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (from_date && to_date) { params.push(from_date, to_date); sql += ` AND mr.reading_date BETWEEN $${params.length - 1} AND $${params.length}`; }
    if (zone_id) { params.push(zone_id); sql += ` AND c.zone_id = $${params.length}`; }
    if (billing_group_id) { params.push(billing_group_id); sql += ` AND c.billing_group_id = $${params.length}`; }

    sql += ` GROUP BY bg.name, z.name ORDER BY total_consumption DESC`;

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Consumption summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Customer Summary Report (new connections, disconnections, terminations)
router.get('/customer-summary', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;

    let dateWhere = '';
    const params: any[] = [];
    if (from_date && to_date) {
      params.push(from_date, to_date);
      dateWhere = ` AND created_at BETWEEN $1 AND $2`;
    }

    const totalCustomers = await queryOne(`SELECT COUNT(*) as count FROM customers WHERE 1=1 ${dateWhere}`, params);
    const activeCustomers = await queryOne(`SELECT COUNT(*) as count FROM customers WHERE account_status = 'active' ${dateWhere}`, params);
    const inactiveCustomers = await queryOne(`SELECT COUNT(*) as count FROM customers WHERE account_status = 'inactive' ${dateWhere}`, params);
    const terminatedCustomers = await queryOne(`SELECT COUNT(*) as count FROM customers WHERE account_status = 'terminated' ${dateWhere}`, params);
    const pendingCustomers = await queryOne(`SELECT COUNT(*) as count FROM customers WHERE account_status = 'pending' ${dateWhere}`, params);

    // By category
    const byCategory = await query(
      `SELECT cc.name as category, COUNT(*) as count
       FROM customers c
       LEFT JOIN customer_categories cc ON c.category_id = cc.id
       WHERE 1=1 ${dateWhere}
       GROUP BY cc.name`,
      params
    );

    // By billing group
    const byBillingGroup = await query(
      `SELECT bg.name as billing_group, COUNT(*) as count
       FROM customers c
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       WHERE 1=1 ${dateWhere}
       GROUP BY bg.name`,
      params
    );

    res.json({
      success: true,
      data: {
        summary: { total: parseInt(totalCustomers?.count || '0'), active: parseInt(activeCustomers?.count || '0'), inactive: parseInt(inactiveCustomers?.count || '0'), terminated: parseInt(terminatedCustomers?.count || '0'), pending: parseInt(pendingCustomers?.count || '0') },
        byCategory, byBillingGroup
      }
    });
  } catch (error) {
    console.error('Customer summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Meter Reading Summary Report
router.get('/meter-reading-summary', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date, billing_period_id } = req.query;

    let sql = `
      SELECT
        COUNT(*) as total_readings,
        SUM(CASE WHEN is_estimated THEN 1 ELSE 0 END) as estimated,
        SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END) as anomalies,
        SUM(CASE WHEN is_billed THEN 1 ELSE 0 END) as billed,
        SUM(CASE WHEN NOT is_billed THEN 1 ELSE 0 END) as unbilled,
        AVG(consumption) as avg_consumption,
        MAX(consumption) as max_consumption,
        MIN(consumption) as min_consumption
      FROM meter_readings
      WHERE 1=1
    `;
    const params: any[] = [];
    if (from_date && to_date) { params.push(from_date, to_date); sql += ` AND reading_date BETWEEN $${params.length - 1} AND $${params.length}`; }
    if (billing_period_id) { params.push(billing_period_id); sql += ` AND billing_period_id = $${params.length}`; }

    const summary = await queryOne(sql, params);

    // By reading code
    let codeSql = `
      SELECT rc.name as reading_code, rc.code, COUNT(*) as count
      FROM meter_readings mr
      LEFT JOIN reading_codes rc ON mr.reading_code_id = rc.id
      WHERE 1=1
    `;
    const codeParams: any[] = [];
    if (from_date && to_date) { codeParams.push(from_date, to_date); codeSql += ` AND mr.reading_date BETWEEN $${codeParams.length - 1} AND $${codeParams.length}`; }
    codeSql += ` GROUP BY rc.name, rc.code ORDER BY count DESC`;
    const byCode = await query(codeSql, codeParams);

    res.json({ success: true, data: { summary, byCode } });
  } catch (error) {
    console.error('Meter reading summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Payment Reconciliation Report
router.get('/payment-reconciliation', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;

    let sql = `
      SELECT
        DATE(p.payment_date) as date,
        COUNT(*) as payment_count,
        SUM(p.amount) as total_payments,
        SUM(pa.amount_allocated) as total_allocated
      FROM payments p
      LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
      WHERE p.is_cancelled = false
    `;
    const params: any[] = [];
    if (from_date && to_date) { params.push(from_date, to_date); sql += ` AND p.payment_date BETWEEN $${params.length - 1} AND $${params.length}`; }
    sql += ` GROUP BY DATE(p.payment_date) ORDER BY date DESC`;

    const data = await query(sql, params);

    // By payment mode
    let modeSql = `
      SELECT pm.name as payment_mode, COUNT(*) as count, SUM(p.amount) as total
      FROM payments p
      LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
      WHERE p.is_cancelled = false
    `;
    const modeParams: any[] = [];
    if (from_date && to_date) { modeParams.push(from_date, to_date); modeSql += ` AND p.payment_date BETWEEN $${modeParams.length - 1} AND $${modeParams.length}`; }
    modeSql += ` GROUP BY pm.name ORDER BY total DESC`;
    const byMode = await query(modeSql, modeParams);

    res.json({ success: true, data: { daily: data, byMode } });
  } catch (error) {
    console.error('Payment reconciliation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Zone Performance Report
router.get('/zone-performance', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;

    let sql = `
      SELECT
        z.name as zone,
        COUNT(DISTINCT c.id) as customer_count,
        SUM(b.total_amount) as billed,
        SUM(b.amount_paid) as collected,
        CASE WHEN SUM(b.total_amount) > 0
          THEN ROUND((SUM(b.amount_paid) / SUM(b.total_amount)) * 100, 2)
          ELSE 0
        END as collection_rate,
        SUM(b.balance) as outstanding
      FROM customers c
      LEFT JOIN zones z ON c.zone_id = z.id
      LEFT JOIN bills b ON c.id = b.customer_id AND b.is_cancelled = false
      WHERE 1=1
    `;
    const params: any[] = [];
    if (from_date && to_date) { params.push(from_date, to_date); sql += ` AND b.bill_date BETWEEN $${params.length - 1} AND $${params.length}`; }
    sql += ` GROUP BY z.name ORDER BY billed DESC`;

    const data = await query(sql, params);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Zone performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

export default router;
