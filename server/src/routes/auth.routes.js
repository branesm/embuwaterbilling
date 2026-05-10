const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { verifyToken, generateTokens, JWT_SECRET } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // Find user
  const users = await executeQuery(
    `SELECT id, username, email, password_hash, first_name, last_name, role, is_active 
     FROM users WHERE username = ? OR email = ?`,
    [username, username]
  );

  if (users.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const user = users[0];

  if (!user.is_active) {
    return res.status(401).json({ message: 'Account is deactivated' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Update last login
  await executeQuery(
    'UPDATE users SET last_login = NOW() WHERE id = ?',
    [user.id]
  );

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      accessToken
    }
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Verify user still exists and is active
    const users = await executeQuery(
      'SELECT id, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);

    // Set new refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      data: { accessToken: tokens.accessToken }
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
}));

// Logout
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logout successful' });
}));

// Get current user
router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  const users = await executeQuery(
    `SELECT id, username, email, first_name, last_name, phone, role, last_login, created_at 
     FROM users WHERE id = ?`,
    [req.user.id]
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
      lastLogin: user.last_login,
      createdAt: user.created_at
    }
  });
}));

// Change password
router.post('/change-password', verifyToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  // Get current user with password
  const users = await executeQuery(
    'SELECT password_hash FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
  
  if (!isValid) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await executeQuery(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hashedPassword, req.user.id]
  );

  res.json({ success: true, message: 'Password changed successfully' });
}));

module.exports = router;
