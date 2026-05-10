const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all settings
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const settings = await executeQuery('SELECT * FROM company_settings ORDER BY setting_key');
  res.json({ success: true, data: settings });
}));

// Get setting by key
router.get('/:key', verifyToken, asyncHandler(async (req, res) => {
  const settings = await executeQuery(
    'SELECT * FROM company_settings WHERE setting_key = ?',
    [req.params.key]
  );
  
  if (settings.length === 0) {
    return res.status(404).json({ message: 'Setting not found' });
  }
  
  res.json({ success: true, data: settings[0] });
}));

// Update setting (admin only)
router.put('/:key', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { settingValue } = req.body;
  
  await executeQuery(
    'UPDATE company_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
    [settingValue, req.user.id, req.params.key]
  );
  
  res.json({ success: true, message: 'Setting updated successfully' });
}));

module.exports = router;
