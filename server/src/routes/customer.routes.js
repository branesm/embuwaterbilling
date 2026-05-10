const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Generate account number
const generateAccountNumber = async () => {
  const prefix = 'EW';
  const year = new Date().getFullYear().toString().slice(-2);
  
  const result = await executeQuery(
    "SELECT MAX(CAST(SUBSTRING(account_number, 5) AS UNSIGNED)) as max_num " +
    "FROM customers WHERE account_number LIKE ?",
    [`${prefix}${year}%`]
  );
  
  const nextNum = (result[0].max_num || 0) + 1;
  return `${prefix}${year}${nextNum.toString().padStart(5, '0')}`;
};

// Get customer stats summary
router.get('/stats', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const result = await executeQuery(
    `SELECT 
      COUNT(*) as totalCustomers,
      SUM(CASE WHEN connection_status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN connection_status = 'disconnected' THEN 1 ELSE 0 END) as disconnected,
      SUM(CASE WHEN connection_status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN connection_status = 'inactive' THEN 1 ELSE 0 END) as inactive,
      COALESCE(SUM(balance), 0) as totalBalance
    FROM customers WHERE is_active = 1`
  );

  const row = result[0];
  res.json({
    success: true,
    data: {
      totalCustomers: row.totalCustomers,
      active: row.active,
      disconnected: row.disconnected,
      suspended: row.suspended,
      inactive: row.inactive,
      totalBalance: parseFloat(row.totalBalance)
    }
  });
}));

// Get all customers
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { search, zone, status, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT c.*, z.name as zone_name, r.name as route_name 
             FROM customers c 
             LEFT JOIN zones z ON c.zone_id = z.id 
             LEFT JOIN routes r ON c.route_id = r.id 
             WHERE c.is_active = 1`;
  const params = [];

  if (search) {
    sql += ` AND (c.account_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (zone) {
    sql += ' AND c.zone_id = ?';
    params.push(zone);
  }

  if (status) {
    sql += ' AND c.connection_status = ?';
    params.push(status);
  }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM customers c WHERE c.is_active = 1 ${search ? 'AND (c.account_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)' : ''} ${zone ? 'AND c.zone_id = ?' : ''} ${status ? 'AND c.connection_status = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const customers = await executeQuery(sql, params);

  res.json({
    success: true,
    data: customers.map(c => ({
      id: c.id,
      accountNumber: c.account_number,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      propertyType: c.property_type,
      address: c.address,
      zoneId: c.zone_id,
      zoneName: c.zone_name,
      routeId: c.route_id,
      routeName: c.route_name,
      connectionStatus: c.connection_status,
      balance: parseFloat(c.balance),
      createdAt: c.created_at
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get customer by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const customers = await executeQuery(
    `SELECT c.*, z.name as zone_name, r.name as route_name 
     FROM customers c 
     LEFT JOIN zones z ON c.zone_id = z.id 
     LEFT JOIN routes r ON c.route_id = r.id 
     WHERE c.id = ?`,
    [req.params.id]
  );

  if (customers.length === 0) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const customer = customers[0];
  
  // Get meters
  const meters = await executeQuery(
    'SELECT * FROM meters WHERE customer_id = ? ORDER BY is_main_meter DESC',
    [customer.id]
  );

  res.json({
    success: true,
    data: {
      id: customer.id,
      accountNumber: customer.account_number,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      idNumber: customer.id_number,
      propertyType: customer.property_type,
      propertyName: customer.property_name,
      address: customer.address,
      zoneId: customer.zone_id,
      zoneName: customer.zone_name,
      routeId: customer.route_id,
      routeName: customer.route_name,
      connectionStatus: customer.connection_status,
      connectionDate: customer.connection_date,
      balance: parseFloat(customer.balance),
      depositAmount: parseFloat(customer.deposit_amount),
      portalEnabled: customer.portal_enabled === 1,
      createdAt: customer.created_at,
      meters: meters.map(m => ({
        id: m.id,
        serialNumber: m.serial_number,
        meterSize: m.meter_size,
        meterType: m.meter_type,
        installationDate: m.installation_date,
        currentReading: parseFloat(m.current_reading),
        status: m.status,
        isMainMeter: m.is_main_meter === 1
      }))
    }
  });
}));

// Create customer
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const {
    firstName, lastName, email, phone, idNumber,
    propertyType, propertyName, address,
    zoneId, routeId, connectionDate, depositAmount
  } = req.body;

  if (!firstName || !lastName || !phone || !address) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const accountNumber = await generateAccountNumber();

  const result = await executeQuery(
    `INSERT INTO customers (account_number, first_name, last_name, email, phone, id_number,
     property_type, property_name, address, zone_id, route_id, connection_date, 
     deposit_amount, created_by, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      accountNumber, firstName, lastName, email || null, phone, idNumber || null,
      propertyType || 'residential', propertyName || null, address,
      zoneId || null, routeId || null, connectionDate || null,
      depositAmount || 0, req.user.id
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: { id: result.insertId, accountNumber }
  });
}));

// Update customer
router.put('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const customerId = req.params.id;
  const updates = [];
  const params = [];

  const fields = ['firstName', 'lastName', 'email', 'phone', 'idNumber', 
                  'propertyType', 'propertyName', 'address', 'zoneId', 
                  'routeId', 'connectionStatus', 'connectionDate'];
  
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = ?`);
      params.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  params.push(customerId);

  await executeQuery(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  res.json({ success: true, message: 'Customer updated successfully' });
}));

// Delete customer (soft delete)
router.delete('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await executeQuery(
    'UPDATE customers SET is_active = 0 WHERE id = ?',
    [req.params.id]
  );

  res.json({ success: true, message: 'Customer deactivated successfully' });
}));

module.exports = router;
