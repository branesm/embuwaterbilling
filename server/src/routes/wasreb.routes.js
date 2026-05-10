const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// WASREB Impact Report - Revenue and Customer Statistics
router.get('/impact-report', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;
  
  let dateFilter = `YEAR(b.billing_period_end) = ${year}`;
  if (month) {
    dateFilter += ` AND MONTH(b.billing_period_end) = ${month}`;
  }

  // Revenue Summary
  const revenueSummary = await executeQuery(`
    SELECT 
      COUNT(DISTINCT b.contract_id) as active_connections,
      SUM(b.consumption) as total_consumption_m3,
      SUM(b.amount) as total_billed,
      SUM(b.amount - b.balance) as total_collected,
      SUM(b.balance) as total_outstanding,
      AVG(b.amount) as avg_bill_amount
    FROM bills b
    WHERE ${dateFilter}
    AND b.status != 'cancelled'
  `);

  // Customer Statistics
  const customerStats = await executeQuery(`
    SELECT 
      COUNT(*) as total_customers,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
      SUM(CASE WHEN status = 'disconnected' THEN 1 ELSE 0 END) as disconnected_customers,
      SUM(CASE WHEN customer_type_id = 1 THEN 1 ELSE 0 END) as domestic_customers,
      SUM(CASE WHEN customer_type_id = 2 THEN 1 ELSE 0 END) as commercial_customers,
      SUM(CASE WHEN customer_type_id = 3 THEN 1 ELSE 0 END) as industrial_customers
    FROM customers
  `);

  // Billing Efficiency
  const billingEfficiency = await executeQuery(`
    SELECT 
      COUNT(*) as total_bills,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_bills,
      SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_bills,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_bills,
      ROUND(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as collection_rate
    FROM bills
    WHERE ${dateFilter}
  `);

  // Non-Revenue Water (NRW) Indicators
  const nrwIndicators = await executeQuery(`
    SELECT 
      (SELECT SUM(consumption) FROM bills WHERE ${dateFilter}) as billed_consumption,
      (SELECT SUM(current_reading - previous_reading) 
       FROM meter_readings mr
       JOIN meters m ON mr.meter_id = m.id
       WHERE YEAR(mr.reading_date) = ${year}
       ${month ? `AND MONTH(mr.reading_date) = ${month}` : ''}
      ) as total_production_estimate
  `);

  res.json({
    success: true,
    data: {
      period: { year, month },
      revenue: revenueSummary[0],
      customers: customerStats[0],
      billing: billingEfficiency[0],
      nrw: nrwIndicators[0]
    }
  });
}));

// Debt Aging Analysis (WASREB Requirement)
router.get('/debt-aging', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const debtAging = await executeQuery(`
    SELECT 
      CASE 
        WHEN DATEDIFF(NOW(), b.due_date) <= 0 THEN 'Current'
        WHEN DATEDIFF(NOW(), b.due_date) <= 30 THEN '1-30 days'
        WHEN DATEDIFF(NOW(), b.due_date) <= 60 THEN '31-60 days'
        WHEN DATEDIFF(NOW(), b.due_date) <= 90 THEN '61-90 days'
        ELSE 'Over 90 days'
      END as aging_bucket,
      COUNT(*) as bill_count,
      SUM(b.balance) as total_amount,
      COUNT(DISTINCT b.contract_id) as customer_count
    FROM bills b
    WHERE b.status IN ('unpaid', 'partial')
    AND b.status != 'cancelled'
    GROUP BY aging_bucket
    ORDER BY 
      CASE aging_bucket
        WHEN 'Current' THEN 1
        WHEN '1-30 days' THEN 2
        WHEN '31-60 days' THEN 3
        WHEN '61-90 days' THEN 4
        ELSE 5
      END
  `);

  // Top debtors
  const topDebtors = await executeQuery(`
    SELECT 
      c.account_number,
      CONCAT(c.first_name, ' ', c.last_name) as customer_name,
      COUNT(b.id) as unpaid_bills,
      SUM(b.balance) as total_debt,
      MAX(b.due_date) as oldest_due_date
    FROM bills b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.status IN ('unpaid', 'partial')
    AND b.status != 'cancelled'
    GROUP BY c.id, c.account_number, c.first_name, c.last_name
    HAVING total_debt > 0
    ORDER BY total_debt DESC
    LIMIT 20
  `);

  res.json({
    success: true,
    data: {
      agingBuckets: debtAging,
      topDebtors
    }
  });
}));

// Complaint Resolution Report (WASREB Compliance)
router.get('/complaint-report', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear(), month } = req.query;
  
  let dateFilter = `YEAR(created_at) = ${year}`;
  if (month) {
    dateFilter += ` AND MONTH(created_at) = ${month}`;
  }

  // Complaint summary
  const summary = await executeQuery(`
    SELECT 
      COUNT(*) as total_complaints,
      SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved_complaints,
      SUM(CASE WHEN status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as pending_complaints,
      AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) 
        ELSE NULL 
      END) as avg_resolution_hours
    FROM complaints
    WHERE ${dateFilter}
  `);

  // By category
  const byCategory = await executeQuery(`
    SELECT 
      category,
      COUNT(*) as count,
      AVG(CASE 
        WHEN resolved_at IS NOT NULL 
        THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) 
        ELSE NULL 
      END) as avg_resolution_hours
    FROM complaints
    WHERE ${dateFilter}
    GROUP BY category
  `);

  // Resolution timeline compliance
  const timelineCompliance = await executeQuery(`
    SELECT 
      CASE 
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 24 THEN 'Within 24h'
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 72 THEN 'Within 72h'
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 168 THEN 'Within 7 days'
        ELSE 'Over 7 days'
      END as timeline,
      COUNT(*) as count
    FROM complaints
    WHERE status = 'resolved'
    AND ${dateFilter.replace(/created_at/g, 'created_at').replace(/b\./g, '')}
    GROUP BY timeline
  `);

  res.json({
    success: true,
    data: {
      period: { year, month },
      summary: summary[0],
      byCategory,
      timelineCompliance
    }
  });
}));

// Audit Trail Report (WASREB Financial Transaction Audit)
router.get('/audit-trail', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { 
    startDate, 
    endDate, 
    transactionType,
    userId,
    page = 1,
    limit = 50
  } = req.query;

  let sql = `SELECT 
             al.*,
             u.first_name, u.last_name, u.username,
             c.account_number,
             cust.first_name as customer_first_name, cust.last_name as customer_last_name
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             LEFT JOIN contracts c ON al.contract_id = c.contract_id
             LEFT JOIN customers cust ON al.customer_id = cust.id
             WHERE 1=1`;
  const params = [];

  if (startDate) { sql += ' AND DATE(al.timestamp) >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND DATE(al.timestamp) <= ?'; params.push(endDate); }
  if (transactionType) { sql += ' AND al.transaction_type = ?'; params.push(transactionType); }
  if (userId) { sql += ' AND al.user_id = ?'; params.push(userId); }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1 
     ${startDate ? 'AND DATE(al.timestamp) >= ?' : ''} 
     ${endDate ? 'AND DATE(al.timestamp) <= ?' : ''}
     ${transactionType ? 'AND al.transaction_type = ?' : ''}
     ${userId ? 'AND al.user_id = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const auditLogs = await executeQuery(sql, params);

  res.json({
    success: true,
    data: auditLogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Zone-wise Performance Report
router.get('/zone-performance', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const zonePerformance = await executeQuery(`
    SELECT 
      z.name as zone_name,
      COUNT(DISTINCT c.contract_id) as total_connections,
      COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.contract_id END) as active_connections,
      SUM(b.consumption) as total_consumption,
      SUM(b.amount) as total_billed,
      SUM(b.amount - b.balance) as total_collected,
      ROUND(SUM(b.amount - b.balance) * 100.0 / NULLIF(SUM(b.amount), 0), 2) as collection_rate
    FROM zones z
    LEFT JOIN contracts c ON z.id = c.zone_id
    LEFT JOIN bills b ON c.contract_id = b.contract_id 
      AND YEAR(b.billing_period_end) = ${year}
      AND b.status != 'cancelled'
    GROUP BY z.id, z.name
    ORDER BY total_connections DESC
  `);

  res.json({
    success: true,
    data: zonePerformance
  });
}));

module.exports = router;
