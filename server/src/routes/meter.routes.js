const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all meters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { customer, status, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT m.*, c.account_number, c.first_name, c.last_name 
             FROM meters m 
             LEFT JOIN customers c ON m.customer_id = c.id WHERE 1=1`;
  const params = [];

  if (customer) {
    sql += ' AND m.customer_id = ?';
    params.push(customer);
  }

  if (status) {
    sql += ' AND m.status = ?';
    params.push(status);
  }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM meters m WHERE 1=1 ${customer ? 'AND m.customer_id = ?' : ''} ${status ? 'AND m.status = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const meters = await executeQuery(sql, params);

  res.json({
    success: true,
    data: meters,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get meter by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const meters = await executeQuery(
    `SELECT m.*, c.account_number, c.first_name, c.last_name 
     FROM meters m 
     LEFT JOIN customers c ON m.customer_id = c.id 
     WHERE m.id = ?`,
    [req.params.id]
  );

  if (meters.length === 0) {
    return res.status(404).json({ message: 'Meter not found' });
  }

  res.json({ success: true, data: meters[0] });
}));

// Create meter
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { customerId, serialNumber, meterSize, meterType, installationDate, initialReading, gpsLatitude, gpsLongitude } = req.body;

  if (!customerId || !serialNumber || !installationDate) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const result = await executeQuery(
    `INSERT INTO meters (customer_id, serial_number, meter_size, meter_type, installation_date, 
     initial_reading, current_reading, gps_latitude, gps_longitude, created_by, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [customerId, serialNumber, meterSize || '15mm', meterType || 'analog', installationDate, 
     initialReading || 0, initialReading || 0, gpsLatitude || null, gpsLongitude || null, req.user.id]
  );

  res.status(201).json({
    success: true,
    message: 'Meter created successfully',
    data: { id: result.insertId }
  });
}));

// Update meter
router.put('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const meterId = req.params.id;
  const updates = [];
  const params = [];

  const fields = ['meterSize', 'meterType', 'status', 'gpsLatitude', 'gpsLongitude'];
  
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = ?`);
      params.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  params.push(meterId);

  await executeQuery(
    `UPDATE meters SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  res.json({ success: true, message: 'Meter updated successfully' });
}));

// Delete meter
router.delete('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await executeQuery('DELETE FROM meters WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Meter deleted successfully' });
}));

module.exports = router;
