const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const zones = await executeQuery('SELECT * FROM zones WHERE is_active = 1 ORDER BY name');
  res.json({ success: true, data: zones });
}));

router.post('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  const result = await executeQuery(
    'INSERT INTO zones (name, code, description) VALUES (?, ?, ?)',
    [name, code, description]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

router.put('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, description } = req.body;
  await executeQuery(
    'UPDATE zones SET name = ?, code = ?, description = ? WHERE id = ?',
    [name, code, description, id]
  );
  res.json({ success: true, data: { id } });
}));

router.delete('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Check if zone has customers assigned
  const customers = await executeQuery(
    'SELECT COUNT(*) as count FROM customers WHERE zone_id = ?',
    [id]
  );
  if (customers[0].count > 0) {
    return res.status(409).json({ success: false, message: 'Cannot delete zone with assigned customers' });
  }
  // Soft delete
  await executeQuery('UPDATE zones SET is_active = 0 WHERE id = ?', [id]);
  res.json({ success: true, data: { id } });
}));

module.exports = router;
