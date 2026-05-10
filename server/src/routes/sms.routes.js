const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get SMS templates
router.get('/templates', verifyToken, asyncHandler(async (req, res) => {
  const templates = await executeQuery('SELECT * FROM sms_templates WHERE is_active = 1');
  res.json({ success: true, data: templates });
}));

// Get SMS logs
router.get('/logs', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const logs = await executeQuery(
    'SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 100'
  );
  res.json({ success: true, data: logs });
}));

// Send SMS (placeholder - integrate with Africa's Talking)
router.post('/send', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { customerId, phoneNumber, message } = req.body;
  
  // Placeholder for SMS sending logic
  // TODO: Integrate with Africa's Talking API
  
  await executeQuery(
    `INSERT INTO sms_logs (customer_id, phone_number, message, message_type, status, created_at)
     VALUES (?, ?, ?, 'manual', 'pending', NOW())`,
    [customerId || null, phoneNumber, message]
  );
  
  res.json({ success: true, message: 'SMS queued for sending' });
}));

// Update SMS template
router.put('/templates/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { template, isActive } = req.body;
  const fields = [];
  const params = [];

  if (template !== undefined) {
    fields.push('template = ?');
    params.push(template);
  }
  if (isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (!fields.length) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  params.push(req.params.id);
  await executeQuery(
    `UPDATE sms_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );

  const [templateRow] = await executeQuery('SELECT * FROM sms_templates WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: templateRow });
}));

module.exports = router;
