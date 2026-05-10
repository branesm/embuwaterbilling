const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Customer portal login
router.post('/login', asyncHandler(async (req, res) => {
  const { accountNumber, password } = req.body;

  if (!accountNumber || !password) {
    return res.status(400).json({ message: 'Account number and password are required' });
  }

  const customers = await executeQuery(
    `SELECT id, account_number, first_name, last_name, email, phone, portal_password_hash, portal_enabled
     FROM customers WHERE account_number = ? AND is_active = 1`,
    [accountNumber]
  );

  if (customers.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const customer = customers[0];

  if (!customer.portal_enabled || !customer.portal_password_hash) {
    return res.status(401).json({ message: 'Portal access not enabled for this account' });
  }

  const isValid = await bcrypt.compare(password, customer.portal_password_hash);
  
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate token
  const token = jwt.sign(
    { customerId: customer.id, accountNumber: customer.account_number },
    process.env.JWT_SECRET || 'ewasco_jwt_secret_key_2024',
    { expiresIn: '1h' }
  );

  res.json({
    success: true,
    data: {
      customer: {
        id: customer.id,
        accountNumber: customer.account_number,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.phone
      },
      token
    }
  });
}));

// Get customer bills (for portal)
router.get('/bills', asyncHandler(async (req, res) => {
  // Verify token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token required' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ewasco_jwt_secret_key_2024');

  const bills = await executeQuery(
    `SELECT bill_number, billing_period, bill_date, due_date, total_amount, amount_paid, 
     balance, status, consumption_units FROM bills WHERE customer_id = ? ORDER BY bill_date DESC`,
    [decoded.customerId]
  );

  res.json({ success: true, data: bills });
}));

// Get customer payments (for portal)
router.get('/payments', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token required' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ewasco_jwt_secret_key_2024');

  const payments = await executeQuery(
    `SELECT payment_number, amount, payment_method, payment_date, reference_number 
     FROM payments WHERE customer_id = ? ORDER BY payment_date DESC`,
    [decoded.customerId]
  );

  res.json({ success: true, data: payments });
}));

module.exports = router;
