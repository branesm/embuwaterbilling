const express = require('express');
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all users (admin/manager only)
router.get('/', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT id, username, email, first_name, last_name, phone, role, is_active, last_login, created_at 
             FROM users WHERE 1=1`;
  const params = [];

  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  if (search) {
    sql += ` AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Get total count
  const countResult = await executeQuery(`SELECT COUNT(*) as total FROM users WHERE 1=1 ${role ? 'AND role = ?' : ''} ${search ? 'AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)' : ''}`, params);
  const total = countResult[0].total;

  // Add pagination
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const users = await executeQuery(sql, params);

  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      role: u.role,
      isActive: u.is_active === 1,
      lastLogin: u.last_login,
      createdAt: u.created_at
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get user by ID
router.get('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const users = await executeQuery(
    `SELECT id, username, email, first_name, last_name, phone, role, is_active, last_login, created_at 
     FROM users WHERE id = ?`,
    [req.params.id]
  );

  if (users.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = users[0];
  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      isActive: user.is_active === 1,
      lastLogin: user.last_login,
      createdAt: user.created_at
    }
  });
}));

// Create user (admin only)
router.post('/', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName, phone, role } = req.body;

  if (!username || !email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  // Check if username or email exists
  const existing = await executeQuery(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (existing.length > 0) {
    return res.status(409).json({ message: 'Username or email already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await executeQuery(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, created_by, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [username, email, hashedPassword, firstName, lastName, phone || null, role, req.user.id]
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { id: result.insertId }
  });
}));

// Update user (admin only)
router.put('/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { email, firstName, lastName, phone, role, isActive } = req.body;
  const userId = req.params.id;

  // Build update query dynamically
  const updates = [];
  const params = [];

  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (firstName !== undefined) { updates.push('first_name = ?'); params.push(firstName); }
  if (lastName !== undefined) { updates.push('last_name = ?'); params.push(lastName); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  params.push(userId);

  await executeQuery(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  res.json({ success: true, message: 'User updated successfully' });
}));

// Reset user password (admin only)
router.post('/:id/reset-password', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.params.id;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await executeQuery(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hashedPassword, userId]
  );

  res.json({ success: true, message: 'Password reset successfully' });
}));

// Delete user (admin only)
router.delete('/:id', verifyToken, authorize('admin'), asyncHandler(async (req, res) => {
  const userId = req.params.id;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }

  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

  res.json({ success: true, message: 'User deleted successfully' });
}));

module.exports = router;
