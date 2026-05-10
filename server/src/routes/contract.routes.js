const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Generate contract number
const generateContractNumber = async () => {
  const year = new Date().getFullYear();
  const result = await executeQuery(
    "SELECT COUNT(*) as count FROM contracts WHERE YEAR(created_at) = ?",
    [year]
  );
  const sequence = String(result[0].count + 1).padStart(4, '0');
  return `CNT-${year}-${sequence}`;
};

// Get all contracts with filters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { 
    status, 
    customerId, 
    zoneId, 
    billingGroupId,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let sql = `SELECT c.*, 
             cust.first_name, cust.last_name, cust.account_number,
             bg.group_name as billing_group_name,
             tc.name as tariff_category_name,
             z.name as zone_name,
             r.name as route_name,
             m.meter_number,
             u.first_name as created_by_first_name, u.last_name as created_by_last_name
             FROM contracts c
             LEFT JOIN customers cust ON c.customer_id = cust.id
             LEFT JOIN billing_groups bg ON c.billing_group_id = bg.billing_group_id
             LEFT JOIN tariff_configs tc ON c.tariff_config_id = tc.id
             LEFT JOIN zones z ON c.zone_id = z.id
             LEFT JOIN routes r ON c.route_id = r.id
             LEFT JOIN meters m ON c.meter_id = m.id
             LEFT JOIN users u ON c.created_by = u.id
             WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (customerId) { sql += ' AND c.customer_id = ?'; params.push(customerId); }
  if (zoneId) { sql += ' AND c.zone_id = ?'; params.push(zoneId); }
  if (billingGroupId) { sql += ' AND c.billing_group_id = ?'; params.push(billingGroupId); }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM contracts c WHERE 1=1 
     ${status ? 'AND c.status = ?' : ''} 
     ${customerId ? 'AND c.customer_id = ?' : ''} 
     ${zoneId ? 'AND c.zone_id = ?' : ''}
     ${billingGroupId ? 'AND c.billing_group_id = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const contracts = await executeQuery(sql, params);

  res.json({
    success: true,
    data: contracts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get contract by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const contract = await executeQuery(
    `SELECT c.*, 
     cust.first_name, cust.last_name, cust.account_number, cust.phone, cust.email,
     bg.group_name as billing_group_name,
     tc.name as tariff_category_name,
     z.name as zone_name,
     r.name as route_name,
     m.meter_number, m.meter_type, m.current_reading,
     u.first_name as created_by_first_name, u.last_name as created_by_last_name
     FROM contracts c
     LEFT JOIN customers cust ON c.customer_id = cust.id
     LEFT JOIN billing_groups bg ON c.billing_group_id = bg.billing_group_id
     LEFT JOIN tariff_configs tc ON c.tariff_config_id = tc.id
     LEFT JOIN zones z ON c.zone_id = z.id
     LEFT JOIN routes r ON c.route_id = r.id
     LEFT JOIN meters m ON c.meter_id = m.id
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.contract_id = ?`,
    [id]
  );

  if (contract.length === 0) {
    return res.status(404).json({ message: 'Contract not found' });
  }

  // Get contract history
  const history = await executeQuery(
    `SELECT ch.*, u.first_name, u.last_name 
     FROM contract_history ch
     LEFT JOIN users u ON ch.changed_by = u.id
     WHERE ch.contract_id = ?
     ORDER BY ch.created_at DESC`,
    [id]
  );

  // Get related bills
  const bills = await executeQuery(
    `SELECT b.* FROM bills b
     WHERE b.contract_id = ?
     ORDER BY b.billing_period_end DESC
     LIMIT 10`,
    [id]
  );

  res.json({
    success: true,
    data: { ...contract[0], history, bills }
  });
}));

// Create contract
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const {
    customerId,
    billingGroupId,
    tariffCategoryId,
    tariffConfigId,
    connectionDate,
    depositAmount,
    zoneId,
    routeId,
    plotNumber,
    physicalAddress,
    meterId,
    serviceType,
    connectionSize
  } = req.body;

  if (!customerId || !connectionDate) {
    return res.status(400).json({ message: 'Customer ID and connection date are required' });
  }

  const contractNumber = await generateContractNumber();

  const result = await withTransaction(async (connection) => {
    // Create contract
    const [contractResult] = await connection.execute(
      `INSERT INTO contracts (
        contract_number, customer_id, billing_group_id, tariff_category_id, tariff_config_id,
        connection_date, status, deposit_amount, zone_id, route_id, plot_number,
        physical_address, meter_id, service_type, connection_size, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contractNumber,
        customerId,
        billingGroupId || null,
        tariffCategoryId || null,
        tariffConfigId || null,
        connectionDate,
        depositAmount || 0,
        zoneId || null,
        routeId || null,
        plotNumber || null,
        physicalAddress || null,
        meterId || null,
        serviceType || 'water',
        connectionSize || '1/2 inch',
        req.user.id
      ]
    );

    // Log contract creation
    await connection.execute(
      `INSERT INTO contract_history (contract_id, change_type, new_values, changed_by, change_reason)
       VALUES (?, 'created', ?, ?, 'Initial contract creation')`,
      [
        contractResult.insertId,
        JSON.stringify({ status: 'active', meter_id: meterId }),
        req.user.id
      ]
    );

    // Update meter status if assigned
    if (meterId) {
      await connection.execute(
        'UPDATE meters SET status = ?, customer_id = ? WHERE id = ?',
        ['active', customerId, meterId]
      );
    }

    return contractResult;
  });

  const newContract = await executeQuery(
    `SELECT c.*, cust.first_name, cust.last_name 
     FROM contracts c
     LEFT JOIN customers cust ON c.customer_id = cust.id
     WHERE c.contract_id = ?`,
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Contract created successfully',
    data: newContract[0]
  });
}));

// Update contract
router.put('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'billing_group_id', 'tariff_category_id', 'tariff_config_id',
    'status', 'deposit_amount', 'zone_id', 'route_id', 'plot_number',
    'physical_address', 'meter_id', 'service_type', 'connection_size'
  ];

  const setClause = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(dbField)) {
      setClause.push(`${dbField} = ?`);
      values.push(value);
    }
  }

  if (setClause.length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  values.push(id);

  await executeQuery(
    `UPDATE contracts SET ${setClause.join(', ')} WHERE contract_id = ?`,
    values
  );

  // Log the change
  await executeQuery(
    `INSERT INTO contract_history (contract_id, change_type, new_values, changed_by, change_reason)
     VALUES (?, 'updated', ?, ?, 'Contract updated')`,
    [id, JSON.stringify(updates), req.user.id]
  );

  const updatedContract = await executeQuery(
    'SELECT * FROM contracts WHERE contract_id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Contract updated successfully',
    data: updatedContract[0]
  });
}));

// Suspend contract
router.post('/:id/suspend', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  await withTransaction(async (connection) => {
    await connection.execute(
      'UPDATE contracts SET status = ? WHERE contract_id = ?',
      ['suspended', id]
    );

    await connection.execute(
      `INSERT INTO contract_history (contract_id, change_type, old_values, new_values, changed_by, change_reason)
       VALUES (?, 'suspended', ?, ?, ?, ?)`,
      [
        id,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'suspended' }),
        req.user.id,
        reason || 'Contract suspended'
      ]
    );
  });

  res.json({
    success: true,
    message: 'Contract suspended successfully'
  });
}));

// Terminate contract
router.post('/:id/terminate', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, terminationDate } = req.body;

  await withTransaction(async (connection) => {
    await connection.execute(
      'UPDATE contracts SET status = ?, termination_date = ?, termination_reason = ? WHERE contract_id = ?',
      ['terminated', terminationDate || new Date(), reason, id]
    );

    await connection.execute(
      `INSERT INTO contract_history (contract_id, change_type, old_values, new_values, changed_by, change_reason)
       VALUES (?, 'terminated', ?, ?, ?, ?)`,
      [
        id,
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'terminated', termination_date: terminationDate }),
        req.user.id,
        reason || 'Contract terminated'
      ]
    );
  });

  res.json({
    success: true,
    message: 'Contract terminated successfully'
  });
}));

// Get contract statistics (WASREB reporting)
router.get('/stats/summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_contracts,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_contracts,
      SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated_contracts,
      SUM(deposit_amount) as total_deposits
    FROM contracts
  `);

  // Get by zone
  const byZone = await executeQuery(`
    SELECT z.name as zone_name, COUNT(*) as contract_count
    FROM contracts c
    LEFT JOIN zones z ON c.zone_id = z.id
    WHERE c.status = 'active'
    GROUP BY c.zone_id, z.name
  `);

  // Get new connections this month
  const newConnections = await executeQuery(`
    SELECT COUNT(*) as count
    FROM contracts
    WHERE MONTH(connection_date) = MONTH(CURRENT_DATE())
    AND YEAR(connection_date) = YEAR(CURRENT_DATE())
  `);

  res.json({
    success: true,
    data: {
      overview: stats[0],
      byZone,
      newConnectionsThisMonth: newConnections[0].count
    }
  });
}));

module.exports = router;
