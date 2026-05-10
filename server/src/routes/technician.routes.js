const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all technicians
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { status, department, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT t.*, 
             d.device_name, d.device_tag, d.serial_number, d.status as device_status,
             u.first_name as created_by_first_name, u.last_name as created_by_last_name
             FROM technicians t
             LEFT JOIN meter_devices d ON t.device_id = d.id
             LEFT JOIN users u ON t.created_by = u.id
             WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (department) { sql += ' AND t.department = ?'; params.push(department); }

  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const technicians = await executeQuery(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM technicians WHERE 1=1';
  const countParams = [];
  if (status) { countSql += ' AND status = ?'; countParams.push(status); }
  if (department) { countSql += ' AND department = ?'; countParams.push(department); }
  
  const countResult = await executeQuery(countSql, countParams);

  res.json({ 
    success: true, 
    data: technicians,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult[0].total
    }
  });
}));

// Get technician by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const technician = await executeQuery(
    `SELECT t.*, 
     d.device_name, d.device_tag, d.serial_number, d.imei, d.phone_number as device_phone
     FROM technicians t
     LEFT JOIN meter_devices d ON t.device_id = d.id
     WHERE t.id = ?`,
    [id]
  );

  if (technician.length === 0) {
    return res.status(404).json({ message: 'Technician not found' });
  }

  // Get assigned work orders
  const workOrders = await executeQuery(
    `SELECT id, work_order_number, work_order_type, priority, status, 
     scheduled_date, description
     FROM work_orders 
     WHERE assigned_to = ? AND status NOT IN ('completed', 'cancelled')
     ORDER BY scheduled_date ASC`,
    [id]
  );

  // Get work order statistics
  const stats = await executeQuery(
    `SELECT 
      COUNT(*) as total_assigned,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
     FROM work_orders 
     WHERE assigned_to = ?`,
    [id]
  );

  res.json({ 
    success: true, 
    data: { 
      ...technician[0], 
      workOrders,
      statistics: stats[0]
    }
  });
}));

// Create technician
router.post('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const {
    employeeId,
    firstName,
    lastName,
    email,
    phone,
    department,
    deviceId
  } = req.body;

  if (!employeeId || !firstName || !lastName || !phone) {
    return res.status(400).json({ message: 'Employee ID, first name, last name, and phone are required' });
  }

  const result = await executeQuery(
    `INSERT INTO technicians (employee_id, first_name, last_name, email, phone, department, device_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [employeeId, firstName, lastName, email || null, phone, department || 'general', deviceId || null, req.user.id]
  );

  // Update device assignment if device provided
  if (deviceId) {
    await executeQuery(
      'UPDATE meter_devices SET assigned_to = ? WHERE id = ?',
      [result.insertId, deviceId]
    );
  }

  const newTechnician = await executeQuery(
    'SELECT * FROM technicians WHERE id = ?',
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Technician created successfully',
    data: newTechnician[0]
  });
}));

// Update technician
router.put('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'employee_id', 'first_name', 'last_name', 'email', 'phone', 
    'department', 'status', 'device_id'
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
    `UPDATE technicians SET ${setClause.join(', ')} WHERE id = ?`,
    values
  );

  // Update device assignment if device changed
  if (updates.deviceId !== undefined) {
    // Unassign from old device
    await executeQuery(
      'UPDATE meter_devices SET assigned_to = NULL WHERE assigned_to = ?',
      [id]
    );
    // Assign to new device
    if (updates.deviceId) {
      await executeQuery(
        'UPDATE meter_devices SET assigned_to = ? WHERE id = ?',
        [id, updates.deviceId]
      );
    }
  }

  const updatedTechnician = await executeQuery(
    'SELECT * FROM technicians WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Technician updated successfully',
    data: updatedTechnician[0]
  });
}));

// Delete technician
router.delete('/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Unassign device before deleting
  await executeQuery(
    'UPDATE meter_devices SET assigned_to = NULL WHERE assigned_to = ?',
    [id]
  );

  await executeQuery('DELETE FROM technicians WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Technician deleted successfully'
  });
}));

// Get technician departments (for dropdown)
router.get('/meta/departments', verifyToken, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'meter_reading', label: 'Meter Reading' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'connections', label: 'Connections' },
      { value: 'leak_repair', label: 'Leak Repair' },
      { value: 'general', label: 'General' }
    ]
  });
}));

module.exports = router;
