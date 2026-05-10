import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// ==================== COMPLAINTS CRUD ====================

// Get all complaints with filters
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, status, priority, category_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT comp.*, c.name as customer_name, c.account_no,
                      cc.name as category_name, ct.name as type_name,
                      cs.name as source_name, d.name as department_name,
                      e.first_name || ' ' || COALESCE(e.other_names, '') as assigned_to_name
               FROM complaints comp
               LEFT JOIN customers c ON comp.customer_id = c.id
               LEFT JOIN complaint_categories cc ON comp.category_id = cc.id
               LEFT JOIN complaint_types ct ON comp.type_id = ct.id
               LEFT JOIN complaint_sources cs ON comp.source_id = cs.id
               LEFT JOIN departments d ON comp.department_id = d.id
               LEFT JOIN employees e ON comp.assigned_to = e.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND comp.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (status) {
      paramCount++;
      sql += ` AND comp.status = $${paramCount}`;
      params.push(status);
    }
    if (priority) {
      paramCount++;
      sql += ` AND comp.priority = $${paramCount}`;
      params.push(priority);
    }
    if (category_id) {
      paramCount++;
      sql += ` AND comp.category_id = $${paramCount}`;
      params.push(category_id);
    }

    paramCount++;
    sql += ` ORDER BY comp.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const complaints = await query(sql, params);
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Complaints list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load complaints' });
  }
});

// Create complaint
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      customer_id, category_id, type_id, source_id, department_id,
      priority, description, assigned_to
    } = req.body;
    const createdBy = (req as any).user?.id;

    const result = await queryOne(
      `INSERT INTO complaints (customer_id, category_id, type_id, source_id, department_id,
       priority, status, description, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9) RETURNING *`,
      [customer_id, category_id, type_id, source_id, department_id, priority, description, assigned_to, createdBy]
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to create complaint' });
  }
});

// Complaint statistics
router.get('/stats/dashboard', verifyToken, async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;

    let dateFilter = '';
    const params: any[] = [];
    if (date_from) { dateFilter += ` AND created_at >= $${params.length + 1}`; params.push(date_from); }
    if (date_to) { dateFilter += ` AND created_at <= $${params.length + 1}`; params.push(date_to); }

    const statusStats = await query(
      `SELECT status, COUNT(*) as count FROM complaints WHERE 1=1${dateFilter} GROUP BY status`,
      params
    );
    const priorityStats = await query(
      `SELECT priority, COUNT(*) as count FROM complaints WHERE 1=1${dateFilter} GROUP BY priority`,
      params
    );
    const categoryStats = await query(
      `SELECT cc.name, COUNT(*) as count FROM complaints c
       JOIN complaint_categories cc ON c.category_id = cc.id
       WHERE 1=1${dateFilter} GROUP BY cc.name`,
      params
    );
    const totalResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM complaints WHERE 1=1${dateFilter}`,
      params
    );
    const resolvedResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM complaints WHERE status = 'resolved'${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult?.count || '0'),
        resolved: parseInt(resolvedResult?.count || '0'),
        by_status: statusStats,
        by_priority: priorityStats,
        by_category: categoryStats
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// ==================== LOOKUP TABLES ====================

// Complaint categories
router.get('/categories/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const categories = await query('SELECT * FROM complaint_categories WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
});

// Complaint types
router.get('/types/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const types = await query('SELECT * FROM complaint_types WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load types' });
  }
});

// Complaint sources
router.get('/sources/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const sources = await query('SELECT * FROM complaint_sources WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: sources });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load sources' });
  }
});

// Departments
router.get('/departments/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const departments = await query('SELECT * FROM departments WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load departments' });
  }
});

// Employees
router.get('/employees/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const employees = await query('SELECT * FROM employees WHERE is_active = true ORDER BY first_name');
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load employees' });
  }
});

// ==================== LOOKUP TABLES CRUD ====================

const lookupTables: Record<string, { table: string; codeField?: boolean }> = {
  categories: { table: 'complaint_categories', codeField: true },
  types: { table: 'complaint_types', codeField: true },
  sources: { table: 'complaint_sources', codeField: true },
  departments: { table: 'departments', codeField: true },
  employees: { table: 'employees', codeField: false }
};

// Generic CRUD for lookup tables
Object.entries(lookupTables).forEach(([key, config]) => {
  const { table } = config;

  // List
  router.get(`/${key}`, verifyToken, async (req: Request, res: Response) => {
    try {
      const result = await query(`SELECT * FROM ${table} ORDER BY id DESC`);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: `Failed to load ${key}` });
    }
  });

  // Create
  router.post(`/${key}`, verifyToken, async (req: Request, res: Response) => {
    try {
      const columns = Object.keys(req.body).filter(k => k !== 'id');
      const values = columns.map(k => req.body[k]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const result = await queryOne(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error(`Create ${key} error:`, error);
      res.status(500).json({ success: false, message: `Failed to create ${key}` });
    }
  });

  // Update
  router.put(`/${key}/:id`, verifyToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const columns = Object.keys(req.body).filter(k => k !== 'id');
      const values = columns.map(k => req.body[k]);
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      values.push(id);
      const result = await queryOne(
        `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
        values
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: `Failed to update ${key}` });
    }
  });

  // Delete
  router.delete(`/${key}/:id`, verifyToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      res.json({ success: true, message: 'Deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: `Failed to delete ${key}` });
    }
  });
});

// ==================== COMPLAINT-SPECIFIC ROUTES (must be after all specific paths) ====================

// Get single complaint
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const complaint = await queryOne(`SELECT comp.*, c.name as customer_name, c.account_no
                                      FROM complaints comp
                                      LEFT JOIN customers c ON comp.customer_id = c.id
                                      WHERE comp.id = $1`, [id]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load complaint' });
  }
});

// Update complaint with activity logging
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, assigned_to, description, resolution_notes } = req.body;
    const userId = (req as any).user?.id;

    const current = await queryOne<any>('SELECT * FROM complaints WHERE id = $1', [id]);
    if (!current) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
      if (status === 'resolved') {
        paramCount++;
        updates.push(`resolved_at = $${paramCount}`);
        values.push(new Date());
      }
    }
    if (priority !== undefined) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
    }
    if (assigned_to !== undefined) {
      paramCount++;
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
    }
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }
    if (resolution_notes !== undefined) {
      paramCount++;
      updates.push(`resolution_notes = $${paramCount}`);
      values.push(resolution_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    paramCount++;
    values.push(id);

    const result = await withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE complaints SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (status && status !== current.status) {
        await client.query(
          `INSERT INTO complaint_activities (complaint_id, activity_type, old_value, new_value, created_by)
           VALUES ($1, 'status_change', $2, $3, $4)`,
          [id, current.status, status, userId]
        );
      }
      if (priority && priority !== current.priority) {
        await client.query(
          `INSERT INTO complaint_activities (complaint_id, activity_type, old_value, new_value, created_by)
           VALUES ($1, 'escalation', $2, $3, $4)`,
          [id, current.priority, priority, userId]
        );
      }
      if (assigned_to && assigned_to !== current.assigned_to) {
        await client.query(
          `INSERT INTO complaint_activities (complaint_id, activity_type, old_value, new_value, created_by)
           VALUES ($1, 'assignment', $2, $3, $4)`,
          [id, String(current.assigned_to || ''), String(assigned_to), userId]
        );
      }

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint' });
  }
});

// Add note/activity to complaint
router.post('/:id/activities', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { activity_type, notes } = req.body;
    const userId = (req as any).user?.id;

    const result = await queryOne(
      `INSERT INTO complaint_activities (complaint_id, activity_type, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, activity_type || 'note', notes, userId]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to add activity' });
  }
});

// Get complaint activities
router.get('/:id/activities', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activities = await query(
      `SELECT ca.*, u.username as created_by_name
       FROM complaint_activities ca
       LEFT JOIN users u ON ca.created_by = u.id
       WHERE ca.complaint_id = $1
       ORDER BY ca.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load activities' });
  }
});

export default router;
