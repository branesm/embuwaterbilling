const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Aged arrears analysis
router.get('/aged-analysis', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { zoneId, routeId } = req.query;
  
  let sql = `SELECT c.id, c.account_number, c.first_name, c.last_name, c.phone,
     z.name as zone_name, br.route_name,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 1 AND 30 THEN b.balance ELSE 0 END) as bucket_30,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 31 AND 60 THEN b.balance ELSE 0 END) as bucket_60,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 61 AND 90 THEN b.balance ELSE 0 END) as bucket_90,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) BETWEEN 91 AND 120 THEN b.balance ELSE 0 END) as bucket_120,
     SUM(CASE WHEN DATEDIFF(CURDATE(), b.due_date) > 120 THEN b.balance ELSE 0 END) as bucket_over_120,
     SUM(b.balance) as total_outstanding
     FROM bills b
     JOIN customers c ON b.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     LEFT JOIN billing_routes br ON c.route_id = br.id
     WHERE b.status IN ('unpaid', 'partial', 'overdue') AND b.balance > 0`;
  const params = [];
  
  if (zoneId) { sql += ' AND c.zone_id = ?'; params.push(zoneId); }
  if (routeId) { sql += ' AND c.route_id = ?'; params.push(routeId); }
  
  sql += ` GROUP BY c.id, c.account_number, c.first_name, c.last_name, c.phone, z.name, br.route_name
           HAVING total_outstanding > 0
           ORDER BY total_outstanding DESC
           LIMIT 500`;
  
  const customers = await executeQuery(sql, params);
  
  // Summary by zone
  const zoneSummary = await executeQuery(
    `SELECT z.name as zone_name, COUNT(DISTINCT c.id) as customer_count,
     SUM(b.balance) as total_arrears
     FROM bills b
     JOIN customers c ON b.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     WHERE b.status IN ('unpaid', 'partial', 'overdue') AND b.balance > 0
     GROUP BY z.name ORDER BY total_arrears DESC`
  );
  
  // Overall totals
  const totals = customers.reduce((acc, c) => ({
    bucket_30: acc.bucket_30 + parseFloat(c.bucket_30 || 0),
    bucket_60: acc.bucket_60 + parseFloat(c.bucket_60 || 0),
    bucket_90: acc.bucket_90 + parseFloat(c.bucket_90 || 0),
    bucket_120: acc.bucket_120 + parseFloat(c.bucket_120 || 0),
    bucket_over_120: acc.bucket_over_120 + parseFloat(c.bucket_over_120 || 0),
    total: acc.total + parseFloat(c.total_outstanding || 0),
    count: acc.count + 1
  }), { bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_120: 0, bucket_over_120: 0, total: 0, count: 0 });
  
  res.json({ success: true, data: { customers, zoneSummary, totals } });
}));

// Top debtors
router.get('/top-debtors', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  
  const data = await executeQuery(
    `SELECT c.id, c.account_number, c.first_name, c.last_name, c.phone, c.address,
     c.balance as account_balance, z.name as zone_name, br.route_name,
     COUNT(b.id) as unpaid_bills,
     MIN(b.due_date) as oldest_due_date,
     DATEDIFF(CURDATE(), MIN(b.due_date)) as days_overdue
     FROM customers c
     LEFT JOIN zones z ON c.zone_id = z.id
     LEFT JOIN billing_routes br ON c.route_id = br.id
     LEFT JOIN bills b ON c.id = b.customer_id AND b.status IN ('unpaid', 'partial', 'overdue')
     WHERE c.balance > 0
     GROUP BY c.id, c.account_number, c.first_name, c.last_name, c.phone, c.address, c.balance, z.name, br.route_name
     ORDER BY c.balance DESC
     LIMIT ?`,
    [parseInt(limit)]
  );
  
  res.json({ success: true, data });
}));

// NRW Analysis
router.get('/nrw-analysis', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Billed consumption by zone
  const billedByZone = await executeQuery(
    `SELECT z.name as zone_name, z.id as zone_id,
     COUNT(DISTINCT mr.customer_id) as active_meters,
     SUM(mr.consumption) as total_billed_consumption,
     AVG(mr.consumption) as avg_consumption_per_meter,
     COUNT(mr.id) as total_readings
     FROM meter_readings mr
     JOIN customers c ON mr.customer_id = c.id
     LEFT JOIN zones z ON c.zone_id = z.id
     WHERE mr.reading_date BETWEEN ? AND ?
     GROUP BY z.name, z.id
     ORDER BY total_billed_consumption DESC`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  
  // Total system metrics
  const [systemTotal] = await executeQuery(
    `SELECT COUNT(DISTINCT customer_id) as total_connections,
     SUM(consumption) as total_consumption,
     AVG(consumption) as system_avg
     FROM meter_readings
     WHERE reading_date BETWEEN ? AND ?`,
    [startDate || '2024-01-01', endDate || '2030-12-31']
  );
  
  res.json({ success: true, data: { billedByZone, systemTotal } });
}));

module.exports = router;
