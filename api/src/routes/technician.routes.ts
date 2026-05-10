import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// Get all technicians
router.get('/', verifyToken, requirePermission('work_orders', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, department, page = '1', limit = '20' } = req.query;

    let sql = `SELECT t.*, u.first_name as created_by_first_name, u.other_names as created_by_other_names
               FROM technicians t
               LEFT JOIN users u ON t.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];

    if (status) { sql += ' AND t.status = $' + (params.length + 1); params.push(status); }
    if (department) { sql += ' AND t.department = $' + (params.length + 1); params.push(department); }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

    const technicians = await query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM technicians WHERE 1=1';
    const countParams: any[] = [];
    if (status) { countSql += ' AND status = $1'; countParams.push(status); }
    if (department) { countSql += ` AND department = $${countParams.length + 1}`; countParams.push(department); }

    const countResult = await queryOne<{ total: string }>(countSql, countParams);

    res.json({
      success: true,
      data: technicians,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0')
      }
    });
  } catch (error) {
    console.error('Get technicians error:', error);
    res.status(500).json({ success: false, message: 'Failed to load technicians' });
  }
});

// Get technician by ID
router.get('/:id', verifyToken, requirePermission('work_orders', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const technician = await queryOne(
      'SELECT * FROM technicians WHERE id = $1',
      [id]
    );

    if (!technician) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    const workOrders = await query(
      `SELECT id, work_order_number, work_order_type, priority, status,
       scheduled_date, description
       FROM work_orders
       WHERE assigned_to = $1 AND status NOT IN ('completed', 'cancelled')
       ORDER BY scheduled_date ASC`,
      [id]
    );

    const stats = await queryOne(
      `SELECT COUNT(*) as total_assigned,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
       FROM work_orders WHERE assigned_to = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...technician,
        workOrders,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Get technician error:', error);
    res.status(500).json({ success: false, message: 'Failed to load technician' });
  }
});

// Create technician
router.post('/', verifyToken, requirePermission('work_orders', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, first_name, last_name, email, phone, department } = req.body;

    if (!employee_id || !first_name || !last_name || !phone) {
      return res.status(400).json({ success: false, message: 'Employee ID, first name, last name, and phone are required' });
    }

    const result = await queryOne(
      `INSERT INTO technicians (employee_id, first_name, last_name, email, phone, department, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [employee_id, first_name, last_name, email || null, phone, department || 'general', req.user?.id]
    );

    res.status(201).json({
      success: true,
      message: 'Technician created successfully',
      data: result
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Employee ID already exists' });
    }
    console.error('Create technician error:', error);
    res.status(500).json({ success: false, message: 'Failed to create technician' });
  }
});

// Update technician
router.put('/:id', verifyToken, requirePermission('work_orders', 'update'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { employee_id, first_name, last_name, email, phone, department, status } = req.body;

    const result = await queryOne(
      `UPDATE technicians SET
       employee_id = COALESCE($1, employee_id),
       first_name = COALESCE($2, first_name),
       last_name = COALESCE($3, last_name),
       email = COALESCE($4, email),
       phone = COALESCE($5, phone),
       department = COALESCE($6, department),
       status = COALESCE($7, status),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [employee_id, first_name, last_name, email, phone, department, status, id]
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    res.json({
      success: true,
      message: 'Technician updated successfully',
      data: result
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Employee ID already exists' });
    }
    console.error('Update technician error:', error);
    res.status(500).json({ success: false, message: 'Failed to update technician' });
  }
});

// Delete technician
router.delete('/:id', verifyToken, requirePermission('work_orders', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne('DELETE FROM technicians WHERE id = $1 RETURNING id', [id]);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    res.json({ success: true, message: 'Technician deleted successfully' });
  } catch (error) {
    console.error('Delete technician error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete technician' });
  }
});

// Get departments dropdown
router.get('/meta/departments', verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: [
      { value: 'meter_reading', label: 'Meter Reading' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'connections', label: 'Connections' },
      { value: 'leak_repair', label: 'Leak Repair' },
      { value: 'general', label: 'General' }
    ]
  });
});

export default router;
