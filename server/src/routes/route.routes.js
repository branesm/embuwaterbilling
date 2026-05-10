const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { zone } = req.query;
  let sql = `SELECT r.*, z.name as zone_name, u.first_name as reader_first_name, u.last_name as reader_last_name
             FROM routes r 
             LEFT JOIN zones z ON r.zone_id = z.id
             LEFT JOIN users u ON r.reader_id = u.id WHERE r.is_active = 1`;
  const params = [];
  
  if (zone) {
    sql += ' AND r.zone_id = ?';
    params.push(zone);
  }
  
  sql += ' ORDER BY r.name';
  const routes = await executeQuery(sql, params);
  res.json({ success: true, data: routes });
}));

router.post('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { zoneId, name, code, description, readerId } = req.body;
  const result = await executeQuery(
    'INSERT INTO routes (zone_id, name, code, description, reader_id) VALUES (?, ?, ?, ?, ?)',
    [zoneId, name, code, description, readerId || null]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

router.put('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { zoneId, name, code, description, readerId } = req.body;
  await executeQuery(
    'UPDATE routes SET zone_id = ?, name = ?, code = ?, description = ?, reader_id = ? WHERE id = ?',
    [zoneId, name, code, description, readerId || null, id]
  );
  res.json({ success: true, data: { id } });
}));

router.delete('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Check if route has meters assigned
  const meters = await executeQuery(
    'SELECT COUNT(*) as count FROM meters WHERE route_id = ?',
    [id]
  );
  if (meters[0].count > 0) {
    return res.status(409).json({ success: false, message: 'Cannot delete route with assigned meters' });
  }
  // Soft delete
  await executeQuery('UPDATE routes SET is_active = 0 WHERE id = ?', [id]);
  res.json({ success: true, data: { id } });
}));

module.exports = router;
