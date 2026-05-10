import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// Generate work order number using an atomic per-year counter (race-safe)
const generateWorkOrderNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const result = await queryOne<{ last_sequence: number }>(
    `INSERT INTO work_order_counters (year, last_sequence)
     VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE
       SET last_sequence = work_order_counters.last_sequence + 1,
           updated_at = CURRENT_TIMESTAMP
     RETURNING last_sequence`,
    [year]
  );
  const sequence = String(result?.last_sequence || 1).padStart(4, '0');
  return `WO-${year}-${sequence}`;
};

// Get all work orders with filters
router.get('/', verifyToken, requirePermission('work_orders', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      status, type, priority, assigned_to, customer_id, scheduled_date,
      page = '1', limit = '20'
    } = req.query;

    let sql = `SELECT wo.*,
               t.first_name as technician_first_name,
               t.last_name as technician_last_name,
               t.employee_id,
               u.first_name as created_by_first_name,
               u.other_names as created_by_other_names
               FROM work_orders wo
               LEFT JOIN technicians t ON wo.assigned_to = t.id
               LEFT JOIN users u ON wo.created_by = u.id
               WHERE 1=1`;
    const params: any[] = [];

    if (status) { sql += ` AND wo.status = $${params.length + 1}`; params.push(status); }
    if (type) { sql += ` AND wo.work_order_type = $${params.length + 1}`; params.push(type); }
    if (priority) { sql += ` AND wo.priority = $${params.length + 1}`; params.push(priority); }
    if (assigned_to) { sql += ` AND wo.assigned_to = $${params.length + 1}`; params.push(assigned_to); }
    if (customer_id) { sql += ` AND wo.customer_id = $${params.length + 1}`; params.push(customer_id); }
    if (scheduled_date) { sql += ` AND wo.scheduled_date = $${params.length + 1}`; params.push(scheduled_date); }

    sql += ` ORDER BY wo.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

    const workOrders = await query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM work_orders WHERE 1=1';
    const countParams: any[] = [];
    if (status) { countSql += ` AND status = $${countParams.length + 1}`; countParams.push(status); }
    if (type) { countSql += ` AND work_order_type = $${countParams.length + 1}`; countParams.push(type); }
    if (priority) { countSql += ` AND priority = $${countParams.length + 1}`; countParams.push(priority); }

    const countResult = await queryOne<{ total: string }>(countSql, countParams);

    res.json({
      success: true,
      data: workOrders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0')
      }
    });
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to load work orders' });
  }
});

// Get work order by ID
router.get('/:id', verifyToken, requirePermission('work_orders', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const workOrder = await queryOne(
      `SELECT wo.*,
       t.first_name as technician_first_name,
       t.last_name as technician_last_name,
       t.phone as technician_phone,
       t.employee_id,
       u.first_name as created_by_first_name,
       u.other_names as created_by_other_names,
       z.name as zone_name,
       r.name as route_name
       FROM work_orders wo
       LEFT JOIN technicians t ON wo.assigned_to = t.id
       LEFT JOIN users u ON wo.created_by = u.id
       LEFT JOIN zones z ON wo.zone_id = z.id
       LEFT JOIN billing_routes r ON wo.route_id = r.id
       WHERE wo.id = $1`,
      [id]
    );

    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found' });
    }

    const comments = await query(
      `SELECT wc.*, u.first_name, u.other_names
       FROM work_order_comments wc
       LEFT JOIN users u ON wc.created_by = u.id
       WHERE wc.work_order_id = $1
       ORDER BY wc.created_at DESC`,
      [id]
    );

    const attachments = await query(
      'SELECT * FROM work_order_attachments WHERE work_order_id = $1',
      [id]
    );

    res.json({
      success: true,
      data: { ...workOrder, comments, attachments }
    });
  } catch (error) {
    console.error('Get work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to load work order' });
  }
});

// Create work order
router.post('/', verifyToken, requirePermission('work_orders', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      work_order_type, priority, customer_id, customer_name, customer_phone,
      customer_address, account_number, meter_number, zone_id, route_id,
      location_lat, location_lng, description, instructions, estimated_cost,
      scheduled_date, scheduled_time_from, scheduled_time_to
    } = req.body;

    if (!work_order_type || !description) {
      return res.status(400).json({ success: false, message: 'Work order type and description are required' });
    }

    const workOrderNumber = await generateWorkOrderNumber();

    const result = await queryOne(
      `INSERT INTO work_orders (
        work_order_number, work_order_type, priority, status,
        customer_id, customer_name, customer_phone, customer_address,
        account_number, meter_number, zone_id, route_id,
        location_lat, location_lng,
        description, instructions, estimated_cost,
        scheduled_date, scheduled_time_from, scheduled_time_to,
        created_by
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [
        workOrderNumber, work_order_type, priority || 'medium',
        customer_id || null, customer_name || null, customer_phone || null,
        customer_address || null, account_number || null, meter_number || null,
        zone_id || null, route_id || null, location_lat || null, location_lng || null,
        description, instructions || null, estimated_cost || null,
        scheduled_date || null, scheduled_time_from || null, scheduled_time_to || null,
        req.user?.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: result
    });
  } catch (error) {
    console.error('Create work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create work order' });
  }
});

// Update work order
router.put('/:id', verifyToken, requirePermission('work_orders', 'update'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'work_order_type', 'priority', 'status',
      'customer_id', 'customer_name', 'customer_phone', 'customer_address',
      'account_number', 'meter_number', 'zone_id', 'route_id',
      'location_lat', 'location_lng',
      'description', 'instructions', 'estimated_cost', 'actual_cost', 'materials_used',
      'assigned_to', 'scheduled_date', 'scheduled_time_from', 'scheduled_time_to'
    ];

    const setClause: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(dbField) && value !== undefined) {
        setClause.push(`${dbField} = $${values.length + 1}`);
        values.push(value);
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (updates.status === 'in_progress') {
      setClause.push('started_at = CURRENT_TIMESTAMP');
    }
    if (updates.status === 'completed') {
      setClause.push('completed_at = CURRENT_TIMESTAMP');
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await queryOne(
      `UPDATE work_orders SET ${setClause.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Work order not found' });
    }

    res.json({
      success: true,
      message: 'Work order updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Update work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to update work order' });
  }
});

// Assign work order
router.post('/:id/assign', verifyToken, requirePermission('work_orders', 'update'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { technician_id, scheduled_date, notes } = req.body;

    if (!technician_id) {
      return res.status(400).json({ success: false, message: 'Technician ID is required' });
    }

    await query(
      `UPDATE work_orders
       SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP,
           status = 'assigned', scheduled_date = $3
       WHERE id = $4`,
      [technician_id, req.user?.id, scheduled_date || null, id]
    );

    if (notes) {
      await query(
        `INSERT INTO work_order_comments (work_order_id, comment, comment_type, created_by)
         VALUES ($1, $2, 'update', $3)`,
        [id, `Assigned to technician. Notes: ${notes}`, req.user?.id]
      );
    }

    const updatedWorkOrder = await queryOne(
      `SELECT wo.*, t.first_name, t.last_name, t.phone
       FROM work_orders wo
       LEFT JOIN technicians t ON wo.assigned_to = t.id
       WHERE wo.id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Work order assigned successfully',
      data: updatedWorkOrder
    });
  } catch (error) {
    console.error('Assign work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign work order' });
  }
});

// Add comment
router.post('/:id/comments', verifyToken, requirePermission('work_orders', 'update'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment, comment_type } = req.body;

    if (!comment) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const result = await queryOne(
      `INSERT INTO work_order_comments (work_order_id, comment, comment_type, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, comment, comment_type || 'note', req.user?.id]
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: result
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

// Get statistics
router.get('/stats/summary', verifyToken, requirePermission('work_orders', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await queryOne(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as urgent_open
      FROM work_orders`
    );

    const byType = await query(
      `SELECT work_order_type, COUNT(*) as count
       FROM work_orders
       WHERE status NOT IN ('completed', 'cancelled')
       GROUP BY work_order_type`
    );

    res.json({
      success: true,
      data: {
        overview: stats,
        byType
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load statistics' });
  }
});

// Delete work order
router.delete('/:id', verifyToken, requirePermission('work_orders', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne('DELETE FROM work_orders WHERE id = $1 RETURNING id', [id]);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Work order not found' });
    }

    res.json({ success: true, message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Delete work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete work order' });
  }
});

export default router;
