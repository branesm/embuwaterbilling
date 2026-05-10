const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Generate complaint number
const generateComplaintNumber = async () => {
  const year = new Date().getFullYear();
  const result = await executeQuery(
    "SELECT COUNT(*) as count FROM complaints WHERE YEAR(created_at) = ?",
    [year]
  );
  const sequence = String(result[0].count + 1).padStart(4, '0');
  return `COMP-${year}-${sequence}`;
};

// Get all complaints with filters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { 
    status, 
    category, 
    priority,
    assignedTo,
    customerId,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let sql = `SELECT c.*, 
             cust.first_name, cust.last_name, cust.account_number, cust.phone,
             assigned.first_name as assigned_first_name, assigned.last_name as assigned_last_name,
             creator.first_name as creator_first_name, creator.last_name as creator_last_name
             FROM complaints c
             LEFT JOIN customers cust ON c.customer_id = cust.id
             LEFT JOIN users assigned ON c.assigned_to = assigned.id
             LEFT JOIN users creator ON c.created_by = creator.id
             WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (category) { sql += ' AND c.category = ?'; params.push(category); }
  if (priority) { sql += ' AND c.priority = ?'; params.push(priority); }
  if (assignedTo) { sql += ' AND c.assigned_to = ?'; params.push(assignedTo); }
  if (customerId) { sql += ' AND c.customer_id = ?'; params.push(customerId); }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM complaints c WHERE 1=1 
     ${status ? 'AND c.status = ?' : ''} 
     ${category ? 'AND c.category = ?' : ''}
     ${priority ? 'AND c.priority = ?' : ''}
     ${assignedTo ? 'AND c.assigned_to = ?' : ''}
     ${customerId ? 'AND c.customer_id = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ` ORDER BY 
    CASE c.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      ELSE 4 
    END,
    c.created_at DESC 
    LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const complaints = await executeQuery(sql, params);

  res.json({
    success: true,
    data: complaints,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get complaint by ID
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const complaint = await executeQuery(
    `SELECT c.*, 
     cust.first_name, cust.last_name, cust.account_number, cust.phone, cust.email,
     assigned.first_name as assigned_first_name, assigned.last_name as assigned_last_name,
     assigned_by_user.first_name as assigned_by_first_name, assigned_by_user.last_name as assigned_by_last_name,
     resolved_by_user.first_name as resolved_by_first_name, resolved_by_user.last_name as resolved_by_last_name,
     creator.first_name as creator_first_name, creator.last_name as creator_last_name
     FROM complaints c
     LEFT JOIN customers cust ON c.customer_id = cust.id
     LEFT JOIN users assigned ON c.assigned_to = assigned.id
     LEFT JOIN users assigned_by_user ON c.assigned_by = assigned_by_user.id
     LEFT JOIN users resolved_by_user ON c.resolved_by = resolved_by_user.id
     LEFT JOIN users creator ON c.created_by = creator.id
     WHERE c.complaint_id = ?`,
    [id]
  );

  if (complaint.length === 0) {
    return res.status(404).json({ message: 'Complaint not found' });
  }

  res.json({
    success: true,
    data: complaint[0]
  });
}));

// Create complaint
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const {
    customerId,
    contractId,
    category,
    priority,
    subject,
    description,
    assignedTo
  } = req.body;

  if (!customerId || !category || !subject || !description) {
    return res.status(400).json({ 
      message: 'Customer ID, category, subject, and description are required' 
    });
  }

  const complaintNumber = await generateComplaintNumber();

  const result = await executeQuery(
    `INSERT INTO complaints (
      complaint_number, customer_id, contract_id, category, priority, status,
      subject, description, assigned_to, assigned_by, assigned_at, created_by
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
    [
      complaintNumber,
      customerId,
      contractId || null,
      category,
      priority || 'medium',
      subject,
      description,
      assignedTo || null,
      assignedTo ? req.user.id : null,
      assignedTo ? new Date() : null,
      req.user.id
    ]
  );

  const newComplaint = await executeQuery(
    `SELECT c.*, cust.first_name, cust.last_name 
     FROM complaints c
     LEFT JOIN customers cust ON c.customer_id = cust.id
     WHERE c.complaint_id = ?`,
    [result.insertId]
  );

  res.status(201).json({
    success: true,
    message: 'Complaint created successfully',
    data: newComplaint[0]
  });
}));

// Assign complaint
router.post('/:id/assign', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ message: 'Assigned user ID is required' });
  }

  await executeQuery(
    `UPDATE complaints 
     SET assigned_to = ?, assigned_by = ?, assigned_at = ?, status = 'assigned'
     WHERE complaint_id = ?`,
    [assignedTo, req.user.id, new Date(), id]
  );

  const updatedComplaint = await executeQuery(
    'SELECT * FROM complaints WHERE complaint_id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Complaint assigned successfully',
    data: updatedComplaint[0]
  });
}));

// Update complaint status
router.put('/:id/status', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const allowedStatuses = ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  let updateFields = ['status = ?'];
  let values = [status];

  if (status === 'resolved') {
    updateFields.push('resolution_notes = ?', 'resolved_by = ?', 'resolved_at = ?');
    values.push(notes || '', req.user.id, new Date());
  }

  values.push(id);

  await executeQuery(
    `UPDATE complaints SET ${updateFields.join(', ')} WHERE complaint_id = ?`,
    values
  );

  const updatedComplaint = await executeQuery(
    'SELECT * FROM complaints WHERE complaint_id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'Complaint status updated successfully',
    data: updatedComplaint[0]
  });
}));

// Get complaint statistics (WASREB compliance)
router.get('/stats/summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  // Overall stats
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_complaints,
      SUM(CASE WHEN status IN ('open', 'assigned', 'in_progress') THEN 1 ELSE 0 END) as open_complaints,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_complaints,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_complaints,
      SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as urgent_pending
    FROM complaints
  `);

  // By category
  const byCategory = await executeQuery(`
    SELECT category, COUNT(*) as count
    FROM complaints
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY category
  `);

  // Average resolution time (in hours)
  const avgResolutionTime = await executeQuery(`
    SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
    FROM complaints
    WHERE status = 'resolved'
    AND resolved_at IS NOT NULL
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  `);

  // Complaints by priority
  const byPriority = await executeQuery(`
    SELECT priority, COUNT(*) as count
    FROM complaints
    WHERE status NOT IN ('resolved', 'closed')
    GROUP BY priority
  `);

  // WASREB Compliance: Resolution timeline analysis
  const resolutionTimeline = await executeQuery(`
    SELECT 
      CASE 
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 24 THEN 'Within 24h'
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 72 THEN 'Within 72h'
        WHEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) <= 168 THEN 'Within 7 days'
        ELSE 'Over 7 days'
      END as timeline,
      COUNT(*) as count
    FROM complaints
    WHERE status = 'resolved'
    AND resolved_at IS NOT NULL
    AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY timeline
  `);

  res.json({
    success: true,
    data: {
      overview: stats[0],
      byCategory,
      byPriority,
      avgResolutionTime: avgResolutionTime[0].avg_hours || 0,
      resolutionTimeline
    }
  });
}));

module.exports = router;
