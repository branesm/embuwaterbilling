import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Users
router.get('/users', verifyToken, async (req: Request, res: Response) => {
  try {
    const users = await query(
      `SELECT u.id, u.username, u.first_name, u.other_names, u.email, u.status, 
              u.last_login, g.name as group_name
       FROM users u
       LEFT JOIN user_groups g ON u.group_id = g.id
       ORDER BY u.first_name`
    );
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

router.post('/users', verifyToken, async (req: Request, res: Response) => {
  try {
    const { username, password, first_name, other_names, email, phone, group_id } = req.body;
    const hash = await bcrypt.hash(password, 10);
    
    const result = await queryOne(
      `INSERT INTO users (username, password_hash, first_name, other_names, email, phone, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, first_name, email, status`,
      [username, hash, first_name, other_names, email, phone, group_id]
    );
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// User Groups
router.get('/groups', verifyToken, async (req: Request, res: Response) => {
  try {
    const groups = await query('SELECT * FROM user_groups ORDER BY name');
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load groups' });
  }
});

router.put('/groups/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    const result = await queryOne(
      'UPDATE user_groups SET permissions = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(permissions), id]
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update group' });
  }
});

// Events Log
router.get('/events', verifyToken, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const events = await query(
      `SELECT e.*, u.username 
       FROM events_log e
       LEFT JOIN users u ON e.user_id = u.id
       ORDER BY e.timestamp DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit as string), offset]
    );
    
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load events' });
  }
});

// System Settings
router.get('/settings', verifyToken, async (req: Request, res: Response) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

router.put('/settings/:key', verifyToken, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const result = await queryOne(
      'UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2 RETURNING *',
      [value, key]
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

export default router;
