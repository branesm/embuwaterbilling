import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database';
import { generateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const user = await queryOne<any>(
      `SELECT u.*, g.name as group_name, g.permissions 
       FROM users u 
       LEFT JOIN user_groups g ON u.group_id = g.id 
       WHERE u.username = $1 AND u.status = 'active'`,
      [username]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      id: user.id,
      username: user.username,
      group_id: user.group_id,
      group_name: user.group_name
    });

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          other_names: user.other_names,
          email: user.email,
          group_id: user.group_id,
          group_name: user.group_name,
          permissions: user.permissions
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token required' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ewasco_jwt_secret_key_2024_secure');

    const user = await queryOne<any>(
      `SELECT u.id, u.username, u.first_name, u.other_names, u.email, 
              u.group_id, g.name as group_name, g.permissions
       FROM users u 
       LEFT JOIN user_groups g ON u.group_id = g.id 
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
