const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all disconnections with filters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { 
    isReconnected, 
    customerId,
    type,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let sql = `SELECT d.*, 
             c.contract_number,
             cust.first_name, cust.last_name, cust.account_number, cust.phone,
             disconnected.first_name as disconnected_by_first_name, disconnected.last_name as disconnected_by_last_name,
             reconnected.first_name as reconnected_by_first_name, reconnected.last_name as reconnected_by_last_name,
             approved.first_name as approved_by_first_name, approved.last_name as approved_by_last_name
             FROM disconnections d
             LEFT JOIN contracts c ON d.contract_id = c.contract_id
             LEFT JOIN customers cust ON d.customer_id = cust.id
             LEFT JOIN users disconnected ON d.disconnected_by = disconnected.id
             LEFT JOIN users reconnected ON d.reconnected_by = reconnected.id
             LEFT JOIN users approved ON d.approved_by = approved.id
             WHERE 1=1`;
  const params = [];

  if (isReconnected !== undefined) { 
    sql += ' AND d.is_reconnected = ?'; 
    params.push(isReconnected === 'true' ? 1 : 0); 
  }
  if (customerId) { sql += ' AND d.customer_id = ?'; params.push(customerId); }
  if (type) { sql += ' AND d.disconnection_type = ?'; params.push(type); }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM disconnections d WHERE 1=1 
     ${isReconnected !== undefined ? 'AND d.is_reconnected = ?' : ''} 
     ${customerId ? 'AND d.customer_id = ?' : ''}
     ${type ? 'AND d.disconnection_type = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY d.disconnection_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const disconnections = await executeQuery(sql, params);

  res.json({
    success: true,
    data: disconnections,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get disconnection by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const disconnection = await executeQuery(
    `SELECT d.*, 
     c.contract_number,
     cust.first_name, cust.last_name, cust.account_number, cust.phone, cust.email,
     cust.physical_address,
     disconnected.first_name as disconnected_by_first_name, disconnected.last_name as disconnected_by_last_name,
     reconnected.first_name as reconnected_by_first_name, reconnected.last_name as reconnected_by_last_name,
     approved.first_name as approved_by_first_name, approved.last_name as approved_by_last_name,
     creator.first_name as creator_first_name, creator.last_name as creator_last_name
     FROM disconnections d
     LEFT JOIN contracts c ON d.contract_id = c.contract_id
     LEFT JOIN customers cust ON d.customer_id = cust.id
     LEFT JOIN users disconnected ON d.disconnected_by = disconnected.id
     LEFT JOIN users reconnected ON d.reconnected_by = reconnected.id
     LEFT JOIN users approved ON d.approved_by = approved.id
     LEFT JOIN users creator ON d.created_by = creator.id
     WHERE d.disconnection_id = ?`,
    [id]
  );

  if (disconnection.length === 0) {
    return res.status(404).json({ message: 'Disconnection record not found' });
  }

  res.json({
    success: true,
    data: disconnection[0]
  });
}));

// Create disconnection
router.post('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const {
    contractId,
    customerId,
    disconnectionType,
    reason,
    outstandingAmount,
    billIds,
    disconnectionDate,
    meterReadingAtDisconnection,
    reconnectionFee
  } = req.body;

  if (!contractId || !customerId || !disconnectionType || !reason) {
    return res.status(400).json({ 
      message: 'Contract ID, customer ID, disconnection type, and reason are required' 
    });
  }

  const result = await withTransaction(async (connection) => {
    // Create disconnection
    const [disconnectionResult] = await connection.execute(
      `INSERT INTO disconnections (
        contract_id, customer_id, disconnection_type, reason, outstanding_amount,
        bill_ids, disconnection_date, disconnected_by, meter_reading_at_disconnection,
        reconnection_fee, approved_by, approved_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        customerId,
        disconnectionType,
        reason,
        outstandingAmount || 0,
        billIds ? JSON.stringify(billIds) : null,
        disconnectionDate || new Date(),
        req.user.id,
        meterReadingAtDisconnection || null,
        reconnectionFee || 500.00,
        req.user.id,
        new Date(),
        req.user.id
      ]
    );

    // Update contract status
    await connection.execute(
      'UPDATE contracts SET status = ? WHERE contract_id = ?',
      ['suspended', contractId]
    );

    // Log contract change
    await connection.execute(
      `INSERT INTO contract_history (contract_id, change_type, old_values, new_values, changed_by, change_reason)
       VALUES (?, 'suspended', ?, ?, ?, ?)`,
      [
        contractId,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'suspended' }),
        req.user.id,
        `Disconnection: ${reason}`
      ]
    );

    return disconnectionResult;
  });

  const newDisconnection = await executeQuery(
    `SELECT d.*, cust.first_name, cust.last_name 
     FROM disconnections d
     LEFT JOIN customers cust ON d.customer_id = cust.id
     WHERE d.disconnection_id = ?`,
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Disconnection recorded successfully',
    data: newDisconnection[0]
  });
}));

// Reconnect service
router.post('/:id/reconnect', verifyToken, authorize('admin', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    reconnectionDate, 
    amountPaid, 
    paymentId 
  } = req.body;

  const disconnection = await executeQuery(
    'SELECT * FROM disconnections WHERE disconnection_id = ?',
    [id]
  );

  if (disconnection.length === 0) {
    return res.status(404).json({ message: 'Disconnection record not found' });
  }

  if (disconnection[0].is_reconnected) {
    return res.status(400).json({ message: 'Service is already reconnected' });
  }

  await withTransaction(async (connection) => {
    // Update disconnection record
    await connection.execute(
      `UPDATE disconnections 
       SET is_reconnected = ?, reconnection_date = ?, reconnected_by = ?, amount_paid = ?
       WHERE disconnection_id = ?`,
      [
        true,
        reconnectionDate || new Date(),
        req.user.id,
        amountPaid || 0,
        id
      ]
    );

    // Update contract status back to active
    await connection.execute(
      'UPDATE contracts SET status = ? WHERE contract_id = ?',
      ['active', disconnection[0].contract_id]
    );

    // Log contract change
    await connection.execute(
      `INSERT INTO contract_history (contract_id, change_type, old_values, new_values, changed_by, change_reason)
       VALUES (?, 'reactivated', ?, ?, ?, ?)`,
      [
        disconnection[0].contract_id,
        JSON.stringify({ status: 'suspended' }),
        JSON.stringify({ status: 'active' }),
        req.user.id,
        'Service reconnected'
      ]
    );
  });

  const updatedDisconnection = await executeQuery(
    'SELECT * FROM disconnections WHERE disconnection_id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Service reconnected successfully',
    data: updatedDisconnection[0]
  });
}));

// Get disconnection statistics (WASREB compliance)
router.get('/stats/summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  // Overall stats
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_disconnections,
      SUM(CASE WHEN is_reconnected = TRUE THEN 1 ELSE 0 END) as reconnected,
      SUM(CASE WHEN is_reconnected = FALSE THEN 1 ELSE 0 END) as still_disconnected,
      SUM(outstanding_amount) as total_outstanding,
      SUM(amount_paid) as total_collected,
      SUM(reconnection_fee) as total_reconnection_fees
    FROM disconnections
  `);

  // By disconnection type
  const byType = await executeQuery(`
    SELECT disconnection_type, COUNT(*) as count
    FROM disconnections
    WHERE disconnection_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY disconnection_type
  `);

  // Monthly disconnection trend
  const monthlyTrend = await executeQuery(`
    SELECT 
      DATE_FORMAT(disconnection_date, '%Y-%m') as month,
      COUNT(*) as disconnections,
      SUM(CASE WHEN is_reconnected = TRUE THEN 1 ELSE 0 END) as reconnections
    FROM disconnections
    WHERE disconnection_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(disconnection_date, '%Y-%m')
    ORDER BY month DESC
  `);

  // Average days to reconnection
  const avgReconnectionDays = await executeQuery(`
    SELECT AVG(DATEDIFF(reconnection_date, disconnection_date)) as avg_days
    FROM disconnections
    WHERE is_reconnected = TRUE
    AND reconnection_date IS NOT NULL
  `);

  res.json({
    success: true,
    data: {
      overview: stats[0],
      byType,
      monthlyTrend,
      avgReconnectionDays: avgReconnectionDays[0].avg_days || 0
    }
  });
}));

module.exports = router;
