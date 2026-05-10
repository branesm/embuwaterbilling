const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Generate work order number
const generateWorkOrderNumber = async () => {
  const year = new Date().getFullYear();
  const result = await executeQuery(
    "SELECT COUNT(*) as count FROM work_orders WHERE YEAR(created_at) = ?",
    [year]
  );
  const sequence = String(result[0].count + 1).padStart(4, '0');
  return `WO-${year}-${sequence}`;
};

// Get all work orders with filters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { 
    status, 
    type, 
    priority, 
    assignedTo, 
    customerId, 
    scheduledDate,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let sql = `SELECT wo.*, 
             t.first_name as technician_first_name, 
             t.last_name as technician_last_name,
             t.employee_id,
             u.first_name as created_by_first_name,
             u.last_name as created_by_last_name
             FROM work_orders wo
             LEFT JOIN technicians t ON wo.assigned_to = t.id
             LEFT JOIN users u ON wo.created_by = u.id
             WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND wo.status = ?'; params.push(status); }
  if (type) { sql += ' AND wo.work_order_type = ?'; params.push(type); }
  if (priority) { sql += ' AND wo.priority = ?'; params.push(priority); }
  if (assignedTo) { sql += ' AND wo.assigned_to = ?'; params.push(assignedTo); }
  if (customerId) { sql += ' AND wo.customer_id = ?'; params.push(customerId); }
  if (scheduledDate) { sql += ' AND wo.scheduled_date = ?'; params.push(scheduledDate); }

  sql += ' ORDER BY wo.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const workOrders = await executeQuery(sql, params);

  // Get total count for pagination
  let countSql = 'SELECT COUNT(*) as total FROM work_orders WHERE 1=1';
  const countParams = [];
  if (status) { countSql += ' AND status = ?'; countParams.push(status); }
  if (type) { countSql += ' AND work_order_type = ?'; countParams.push(type); }
  if (priority) { countSql += ' AND priority = ?'; countParams.push(priority); }
  
  const countResult = await executeQuery(countSql, countParams);

  res.json({ 
    success: true, 
    data: workOrders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult[0].total
    }
  });
}));

// Get technician's assigned work orders
router.get('/my-assignments', verifyToken, asyncHandler(async (req, res) => {
  const { technicianId, status, page = 1, limit = 20 } = req.query;

  // Try to auto-detect technician from user context
  let techId = technicianId;
  if (!techId) {
    const techResult = await executeQuery(
      'SELECT id FROM technicians WHERE employee_id = ? LIMIT 1',
      [req.user.username]
    );
    if (techResult.length > 0) {
      techId = techResult[0].id;
    }
  }

  let sql = `SELECT wo.*, 
             t.first_name as technician_first_name, 
             t.last_name as technician_last_name,
             t.employee_id,
             u.first_name as created_by_first_name,
             u.last_name as created_by_last_name
             FROM work_orders wo
             LEFT JOIN technicians t ON wo.assigned_to = t.id
             LEFT JOIN users u ON wo.created_by = u.id
             WHERE wo.status IN ('pending', 'assigned', 'in_progress')`;
  const params = [];

  if (techId) {
    sql += ' AND wo.assigned_to = ?';
    params.push(techId);
  }

  if (status) {
    sql += ' AND wo.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY wo.priority DESC, wo.scheduled_date ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const workOrders = await executeQuery(sql, params);

  // Get total count
  let countSql = `SELECT COUNT(*) as total FROM work_orders WHERE status IN ('pending', 'assigned', 'in_progress')`;
  const countParams = [];
  if (techId) {
    countSql += ' AND assigned_to = ?';
    countParams.push(techId);
  }
  if (status) {
    countSql += ' AND status = ?';
    countParams.push(status);
  }
  const countResult = await executeQuery(countSql, countParams);

  res.json({
    success: true,
    data: workOrders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult[0].total
    }
  });
}));

// Get work order by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const workOrder = await executeQuery(
    `SELECT wo.*, 
     t.first_name as technician_first_name, 
     t.last_name as technician_last_name,
     t.phone as technician_phone,
     t.employee_id,
     u.first_name as created_by_first_name,
     u.last_name as created_by_last_name,
     z.name as zone_name,
     r.name as route_name
     FROM work_orders wo
     LEFT JOIN technicians t ON wo.assigned_to = t.id
     LEFT JOIN users u ON wo.created_by = u.id
     LEFT JOIN zones z ON wo.zone_id = z.id
     LEFT JOIN billing_routes r ON wo.route_id = r.id
     WHERE wo.id = ?`,
    [id]
  );

  if (workOrder.length === 0) {
    return res.status(404).json({ message: 'Work order not found' });
  }

  // Get comments
  const comments = await executeQuery(
    `SELECT wc.*, u.first_name, u.last_name 
     FROM work_order_comments wc
     LEFT JOIN users u ON wc.created_by = u.id
     WHERE wc.work_order_id = ?
     ORDER BY wc.created_at DESC`,
    [id]
  );

  // Get attachments
  const attachments = await executeQuery(
    `SELECT * FROM work_order_attachments WHERE work_order_id = ?`,
    [id]
  );

  res.json({ 
    success: true, 
    data: { ...workOrder[0], comments, attachments }
  });
}));

// Create work order
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const {
    workOrderType,
    priority,
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    accountNumber,
    meterNumber,
    zoneId,
    routeId,
    locationLat,
    locationLng,
    description,
    instructions,
    estimatedCost,
    scheduledDate,
    scheduledTimeFrom,
    scheduledTimeTo
  } = req.body;

  if (!workOrderType || !description) {
    return res.status(400).json({ message: 'Work order type and description are required' });
  }

  const workOrderNumber = await generateWorkOrderNumber();

  const result = await executeQuery(
    `INSERT INTO work_orders (
      work_order_number, work_order_type, priority, status,
      customer_id, customer_name, customer_phone, customer_address,
      account_number, meter_number, zone_id, route_id,
      location_lat, location_lng,
      description, instructions, estimated_cost,
      scheduled_date, scheduled_time_from, scheduled_time_to,
      created_by
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workOrderNumber,
      workOrderType,
      priority || 'medium',
      customerId || null,
      customerName || null,
      customerPhone || null,
      customerAddress || null,
      accountNumber || null,
      meterNumber || null,
      zoneId || null,
      routeId || null,
      locationLat || null,
      locationLng || null,
      description,
      instructions || null,
      estimatedCost || null,
      scheduledDate || null,
      scheduledTimeFrom || null,
      scheduledTimeTo || null,
      req.user.id
    ]
  );

  const newWorkOrder = await executeQuery(
    'SELECT * FROM work_orders WHERE id = ?',
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Work order created successfully',
    data: newWorkOrder[0]
  });
}));

// Update work order
router.put('/:id', verifyToken, authorize('admin', 'manager', 'clerk', 'reader'), asyncHandler(async (req, res) => {
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

  const setClause = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(dbField)) {
      setClause.push(`${dbField} = ?`);
      values.push(value);
    }
  }

  if (setClause.length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  // Add timestamps based on status changes
  if (updates.status === 'in_progress') {
    setClause.push('started_at = NOW()');
  }
  if (updates.status === 'completed') {
    setClause.push('completed_at = NOW()');
  }

  values.push(id);

  await executeQuery(
    `UPDATE work_orders SET ${setClause.join(', ')} WHERE id = ?`,
    values
  );

  const updatedWorkOrder = await executeQuery(
    'SELECT * FROM work_orders WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Work order updated successfully',
    data: updatedWorkOrder[0]
  });
}));

// Assign work order to technician
router.post('/:id/assign', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { technicianId, scheduledDate, notes } = req.body;

  if (!technicianId) {
    return res.status(400).json({ message: 'Technician ID is required' });
  }

  await executeQuery(
    `UPDATE work_orders 
     SET assigned_to = ?, assigned_by = ?, assigned_at = NOW(), 
         status = 'assigned', scheduled_date = ?
     WHERE id = ?`,
    [technicianId, req.user.id, scheduledDate || null, id]
  );

  // Add comment if notes provided
  if (notes) {
    await executeQuery(
      `INSERT INTO work_order_comments (work_order_id, comment, comment_type, created_by)
       VALUES (?, ?, 'update', ?)`,
      [id, `Assigned to technician. Notes: ${notes}`, req.user.id]
    );
  }

  const updatedWorkOrder = await executeQuery(
    `SELECT wo.*, t.first_name, t.last_name, t.phone
     FROM work_orders wo
     LEFT JOIN technicians t ON wo.assigned_to = t.id
     WHERE wo.id = ?`,
    [id]
  );

  res.json({
    success: true,
    message: 'Work order assigned successfully',
    data: updatedWorkOrder[0]
  });
}));

// Add comment to work order
router.post('/:id/comments', verifyToken, authorize('admin', 'manager', 'clerk', 'reader'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment, commentType } = req.body;

  if (!comment) {
    return res.status(400).json({ message: 'Comment is required' });
  }

  const result = await executeQuery(
    `INSERT INTO work_order_comments (work_order_id, comment, comment_type, created_by)
     VALUES (?, ?, ?, ?)`,
    [id, comment, commentType || 'note', req.user.id]
  );

  const newComment = await executeQuery(
    `SELECT wc.*, u.first_name, u.last_name 
     FROM work_order_comments wc
     LEFT JOIN users u ON wc.created_by = u.id
     WHERE wc.id = ?`,
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: newComment[0]
  });
}));

// Get work order statistics
router.get('/stats/summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as urgent_open
    FROM work_orders
  `);

  // Get by type
  const byType = await executeQuery(`
    SELECT work_order_type, COUNT(*) as count
    FROM work_orders
    WHERE status NOT IN ('completed', 'cancelled')
    GROUP BY work_order_type
  `);

  res.json({
    success: true,
    data: {
      overview: stats[0],
      byType
    }
  });
}));

// Delete work order
router.delete('/:id', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  await executeQuery('DELETE FROM work_orders WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Work order deleted successfully'
  });
}));

module.exports = router;
