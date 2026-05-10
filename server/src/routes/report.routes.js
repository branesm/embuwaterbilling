const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Dashboard stats
router.get('/dashboard', verifyToken, asyncHandler(async (req, res) => {
  const stats = {};
  
  // Total customers
  const [customerResult] = await executeQuery('SELECT COUNT(*) as count FROM customers WHERE is_active = 1');
  stats.totalCustomers = customerResult.count;
  
  // Active meters
  const [meterResult] = await executeQuery("SELECT COUNT(*) as count FROM meters WHERE status = 'active'");
  stats.activeMeters = meterResult.count;
  
  // Total revenue this month
  const [revenueResult] = await executeQuery(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE MONTH(payment_date) = MONTH(CURDATE()) AND YEAR(payment_date) = YEAR(CURDATE())"
  );
  stats.monthlyRevenue = parseFloat(revenueResult.total);
  
  // Outstanding bills
  const [outstandingResult] = await executeQuery(
    "SELECT COALESCE(SUM(balance), 0) as total FROM bills WHERE status IN ('unpaid', 'partial', 'overdue')"
  );
  stats.outstandingAmount = parseFloat(outstandingResult.total);
  
  // Recent readings count
  const [readingResult] = await executeQuery(
    "SELECT COUNT(*) as count FROM meter_readings WHERE MONTH(reading_date) = MONTH(CURDATE()) AND YEAR(reading_date) = YEAR(CURDATE())"
  );
  stats.monthlyReadings = readingResult.count;
  
  res.json({ success: true, data: stats });
}));

// Revenue report
router.get('/revenue', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const data = await executeQuery(
    `SELECT DATE(payment_date) as date, payment_method,
     COUNT(*) as transaction_count,
     SUM(amount) as total_amount
     FROM payments 
     WHERE payment_date BETWEEN ? AND ?
     GROUP BY DATE(payment_date), payment_method
     ORDER BY date DESC`,
    [startDate || '2024-01-01', endDate || '2024-12-31']
  );
  
  res.json({ success: true, data });
}));

// Billing summary - Bills by period with status counts
router.get('/billing-summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT billing_period, status, COUNT(*) as count, 
     SUM(total_amount) as total_amount, SUM(balance) as total_balance
     FROM bills
     WHERE bill_date BETWEEN ? AND ?
     GROUP BY billing_period, status
     ORDER BY billing_period DESC, status`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// Collection efficiency - Collections vs billing ratio
router.get('/collection-efficiency', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT b.billing_period,
     SUM(b.total_amount) as total_billed,
     SUM(b.amount_paid) as total_collected,
     SUM(b.balance) as total_outstanding,
     ROUND(SUM(b.amount_paid) / NULLIF(SUM(b.total_amount), 0) * 100, 2) as efficiency_rate
     FROM bills b
     WHERE b.bill_date BETWEEN ? AND ?
     GROUP BY b.billing_period
     ORDER BY b.billing_period DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// Arrears aging - Aged arrears by zone/route
router.get('/arrears-aging', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { zoneId, routeId } = req.query;
  let sql = `SELECT c.id as customer_id, c.account_number, c.first_name, c.last_name,
     z.name as zone_name, br.route_name,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 1 AND 30 THEN b.balance ELSE 0 END) as days_30,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 31 AND 60 THEN b.balance ELSE 0 END) as days_60,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 61 AND 90 THEN b.balance ELSE 0 END) as days_90,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 91 AND 120 THEN b.balance ELSE 0 END) as days_120,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) > 120 THEN b.balance ELSE 0 END) as days_over_120,
     SUM(b.balance) as total_arrears
     FROM bills b
     JOIN customers c ON b.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     LEFT JOIN billing_routes br ON c.route_id = br.id
     WHERE b.status IN ('unpaid', 'partial', 'overdue') AND b.balance > 0`;
  const params = [];
  if (zoneId) { sql += ' AND c.zone_id = ?'; params.push(zoneId); }
  if (routeId) { sql += ' AND c.route_id = ?'; params.push(routeId); }
  sql += ' GROUP BY c.id, c.account_number, c.first_name, c.last_name, z.name, br.route_name HAVING total_arrears > 0 ORDER BY total_arrears DESC LIMIT 200';
  
  const data = await executeQuery(sql, params);
  
  // Summary totals
  const totals = data.reduce((acc, row) => ({
    days_30: acc.days_30 + parseFloat(row.days_30 || 0),
    days_60: acc.days_60 + parseFloat(row.days_60 || 0),
    days_90: acc.days_90 + parseFloat(row.days_90 || 0),
    days_120: acc.days_120 + parseFloat(row.days_120 || 0),
    days_over_120: acc.days_over_120 + parseFloat(row.days_over_120 || 0),
    total: acc.total + parseFloat(row.total_arrears || 0)
  }), { days_30: 0, days_60: 0, days_90: 0, days_120: 0, days_over_120: 0, total: 0 });
  
  res.json({ success: true, data: { customers: data, totals } });
}));

// Customer statement - Full transaction history
router.get('/customer-statement/:customerId', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const customerId = req.params.customerId;
  
  const [customer] = await executeQuery(
    'SELECT id, account_number, first_name, last_name, phone, address, balance FROM customers WHERE id = ?',
    [customerId]
  );
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  
  const bills = await executeQuery(
    `SELECT id, bill_number, billing_period, bill_date, total_amount, amount_paid, balance, status, 'bill' as transaction_type
     FROM bills WHERE customer_id = ? AND bill_date BETWEEN ? AND ? ORDER BY bill_date`,
    [customerId, startDate || '2020-01-01', endDate || '2030-12-31']
  );
  
  const payments = await executeQuery(
    `SELECT id, payment_number, payment_date, amount, payment_method, reference_number, 'payment' as transaction_type
     FROM payments WHERE customer_id = ? AND payment_date BETWEEN ? AND ? ORDER BY payment_date`,
    [customerId, startDate || '2020-01-01', endDate || '2030-12-31']
  );
  
  // Merge and sort by date
  const transactions = [
    ...bills.map(b => ({ ...b, date: b.bill_date, debit: b.total_amount, credit: 0 })),
    ...payments.map(p => ({ ...p, date: p.payment_date, debit: 0, credit: p.amount }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate running balance
  let runningBalance = 0;
  const statement = transactions.map(t => {
    runningBalance += parseFloat(t.debit) - parseFloat(t.credit);
    return { ...t, running_balance: runningBalance };
  });
  
  res.json({ success: true, data: { customer, statement, currentBalance: customer.balance } });
}));

// Meter reader performance - Readings per reader
router.get('/meter-reader-performance', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as reader_name, u.username,
     COUNT(mr.id) as total_readings,
     SUM(CASE WHEN mr.is_estimated = 0 THEN 1 ELSE 0 END) as actual_readings,
     SUM(CASE WHEN mr.is_estimated = 1 THEN 1 ELSE 0 END) as estimated_readings,
     AVG(mr.consumption) as avg_consumption,
     COUNT(DISTINCT mr.route_id) as routes_covered,
     COUNT(DISTINCT DATE(mr.reading_date)) as days_worked
     FROM meter_readings mr
     LEFT JOIN users u ON mr.reader_id = u.id
     WHERE mr.reading_date BETWEEN ? AND ?
     GROUP BY u.id, u.username, u.first_name, u.last_name
     ORDER BY total_readings DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// Disconnection summary - Disconnections by period
router.get('/disconnection-summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT DATE_FORMAT(scheduled_date, '%Y-%m') as period,
     status, COUNT(*) as count
     FROM disconnections
     WHERE scheduled_date BETWEEN ? AND ?
     GROUP BY period, status
     ORDER BY period DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// Consumption analysis - Average consumption by zone/category
router.get('/consumption-analysis', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  const group = groupBy === 'category' ? 'c.property_type' : 'z.name';
  const groupLabel = groupBy === 'category' ? 'c.property_type as group_name' : 'z.name as group_name';
  
  const data = await executeQuery(
    `SELECT ${groupLabel},
     COUNT(mr.id) as reading_count,
     AVG(mr.consumption) as avg_consumption,
     MIN(mr.consumption) as min_consumption,
     MAX(mr.consumption) as max_consumption,
     SUM(mr.consumption) as total_consumption
     FROM meter_readings mr
     JOIN customers c ON mr.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     WHERE mr.reading_date BETWEEN ? AND ?
     GROUP BY ${group}
     ORDER BY avg_consumption DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// NRW summary - Non-revenue water
router.get('/nrw-summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT z.name as zone_name,
     SUM(mr.consumption) as billed_consumption,
     COUNT(DISTINCT mr.customer_id) as active_connections
     FROM meter_readings mr
     JOIN customers c ON mr.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     WHERE mr.reading_date BETWEEN ? AND ?
     GROUP BY z.name
     ORDER BY billed_consumption DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

// Cashier collections - Per-cashier collections
router.get('/cashier-collections', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await executeQuery(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as cashier_name, u.username,
     COUNT(p.id) as transaction_count,
     SUM(p.amount) as total_collected,
     ROUND(SUM(p.amount) / NULLIF(COUNT(p.id), 0), 2) as avg_transaction,
     COUNT(DISTINCT DATE(p.payment_date)) as days_active,
     GROUP_CONCAT(DISTINCT p.payment_method) as methods_used
     FROM payments p
     LEFT JOIN users u ON p.received_by = u.id
     WHERE p.payment_date BETWEEN ? AND ?
     GROUP BY u.id, u.username, u.first_name, u.last_name
     ORDER BY total_collected DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  res.json({ success: true, data });
}));

module.exports = router;
