const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all devices
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { status, assigned, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT d.*, 
             t.first_name as technician_first_name, 
             t.last_name as technician_last_name,
             t.employee_id,
             u.first_name as created_by_first_name, 
             u.last_name as created_by_last_name
             FROM meter_devices d
             LEFT JOIN technicians t ON d.assigned_to = t.id
             LEFT JOIN users u ON d.created_by = u.id
             WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND d.status = ?'; params.push(status); }
  if (assigned === 'true') { sql += ' AND d.assigned_to IS NOT NULL'; }
  if (assigned === 'false') { sql += ' AND d.assigned_to IS NULL'; }

  sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const devices = await executeQuery(sql, params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM meter_devices WHERE 1=1';
  const countParams = [];
  if (status) { countSql += ' AND status = ?'; countParams.push(status); }
  if (assigned === 'true') { countSql += ' AND assigned_to IS NOT NULL'; }
  if (assigned === 'false') { countSql += ' AND assigned_to IS NULL'; }
  
  const countResult = await executeQuery(countSql, countParams);

  res.json({ 
    success: true, 
    data: devices,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult[0].total
    }
  });
}));

// Get device by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const device = await executeQuery(
    `SELECT d.*, 
     t.first_name as technician_first_name, 
     t.last_name as technician_last_name,
     t.employee_id, t.phone as technician_phone
     FROM meter_devices d
     LEFT JOIN technicians t ON d.assigned_to = t.id
     WHERE d.id = ?`,
    [id]
  );

  if (device.length === 0) {
    return res.status(404).json({ message: 'Device not found' });
  }

  res.json({ 
    success: true, 
    data: device[0]
  });
}));

// Create device
router.post('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const {
    deviceName,
    serialNumber,
    deviceTag,
    imei,
    phoneNumber,
    deviceType,
    assignedTo
  } = req.body;

  if (!deviceName || !serialNumber || !deviceTag) {
    return res.status(400).json({ message: 'Device name, serial number, and device tag are required' });
  }

  const result = await executeQuery(
    `INSERT INTO meter_devices (device_name, serial_number, device_tag, imei, phone_number, device_type, assigned_to, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [deviceName, serialNumber, deviceTag, imei || null, phoneNumber || null, deviceType || 'android', assignedTo || null, req.user.id]
  );

  // Update technician's device_id if assigned
  if (assignedTo) {
    await executeQuery(
      'UPDATE technicians SET device_id = ? WHERE id = ?',
      [result.insertId, assignedTo]
    );
  }

  const newDevice = await executeQuery(
    'SELECT * FROM meter_devices WHERE id = ?',
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Device created successfully',
    data: newDevice[0]
  });
}));

// Update device
router.put('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'device_name', 'serial_number', 'device_tag', 'imei', 
    'phone_number', 'device_type', 'status', 'assigned_to'
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
    `UPDATE meter_devices SET ${setClause.join(', ')} WHERE id = ?`,
    values
  );

  // Update technician's device_id if assignment changed
  if (updates.assignedTo !== undefined) {
    // Remove from old technician
    await executeQuery(
      'UPDATE technicians SET device_id = NULL WHERE device_id = ?',
      [id]
    );
    // Assign to new technician
    if (updates.assignedTo) {
      await executeQuery(
        'UPDATE technicians SET device_id = ? WHERE id = ?',
        [id, updates.assignedTo]
      );
    }
  }

  const updatedDevice = await executeQuery(
    'SELECT * FROM meter_devices WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Device updated successfully',
    data: updatedDevice[0]
  });
}));

// Update device location (for mobile sync)
router.post('/:id/location', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  await executeQuery(
    `UPDATE meter_devices 
     SET last_location_lat = ?, last_location_lng = ?, last_location_at = NOW()
     WHERE id = ?`,
    [lat, lng, id]
  );

  res.json({
    success: true,
    message: 'Device location updated'
  });
}));

// Update last sync time
router.post('/:id/sync', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await executeQuery(
    'UPDATE meter_devices SET last_sync_at = NOW() WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Device sync time updated'
  });
}));

// Delete device
router.delete('/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Remove from technician first
  await executeQuery(
    'UPDATE technicians SET device_id = NULL WHERE device_id = ?',
    [id]
  );

  await executeQuery('DELETE FROM meter_devices WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Device deleted successfully'
  });
}));

// Get available devices (not assigned)
router.get('/available/list', verifyToken, asyncHandler(async (req, res) => {
  const devices = await executeQuery(
    `SELECT id, device_name, device_tag, serial_number 
     FROM meter_devices 
     WHERE status = 'active' AND assigned_to IS NULL
     ORDER BY device_name`
  );

  res.json({
    success: true,
    data: devices
  });
}));

// Get device statistics
router.get('/stats/overview', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END) as damaged,
      SUM(CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN assigned_to IS NULL AND status = 'active' THEN 1 ELSE 0 END) as available
    FROM meter_devices
  `);

  res.json({
    success: true,
    data: stats[0]
  });
}));

module.exports = router;
