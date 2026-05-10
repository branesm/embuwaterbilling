const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// List reading books
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const books = await executeQuery(
    `SELECT rb.*, br.route_name,
      CONCAT(u.first_name, ' ', u.last_name) as generated_by_name
     FROM reading_books rb
     LEFT JOIN billing_routes br ON rb.route_id = br.id
     LEFT JOIN users u ON rb.generated_by = u.id
     ORDER BY rb.created_at DESC`
  );

  res.json({ success: true, data: books });
}));

// Generate reading book for route+period
router.post('/generate', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { routeId, periodCode } = req.body;

  if (!routeId || !periodCode) {
    return res.status(400).json({ message: 'Route and period are required' });
  }

  const existing = await executeQuery(
    'SELECT id FROM reading_books WHERE route_id = ? AND period_code = ?',
    [routeId, periodCode]
  );
  if (existing.length > 0) {
    return res.status(409).json({ message: 'A reading book already exists for this route and period' });
  }

  const meters = await executeQuery(
    `SELECT m.id as meter_id, m.serial_number, m.customer_id, c.first_name, c.last_name, c.account_number
     FROM meters m
     JOIN customers c ON m.customer_id = c.id
     WHERE m.route_id = ? AND m.status = 'active'
     ORDER BY m.serial_number ASC`,
    [routeId]
  );

  if (meters.length === 0) {
    return res.status(404).json({ message: 'No active meters found for the selected route' });
  }

  const bookId = await withTransaction(async (connection) => {
    const [bookResult] = await connection.execute(
      `INSERT INTO reading_books (route_id, period_code, status, meter_count, readings_done, generated_by, created_at, updated_at)
       VALUES (?, ?, 'open', ?, 0, ?, NOW(), NOW())`,
      [routeId, periodCode, meters.length, req.user.id]
    );

    const insertedId = bookResult.insertId;

    for (const meter of meters) {
      const [previousRows] = await connection.execute(
        `SELECT current_reading FROM meter_readings WHERE meter_id = ? ORDER BY reading_date DESC LIMIT 1`,
        [meter.meter_id]
      );

      const previousReading = previousRows[0]?.current_reading ?? 0;

      await connection.execute(
        `INSERT INTO reading_book_entries (book_id, meter_id, customer_id, previous_reading, current_reading, consumption, reading_date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'pending', NULL, NOW(), NOW())`,
        [insertedId, meter.meter_id, meter.customer_id, previousReading]
      );
    }

    return insertedId;
  });

  const [createdBook] = await executeQuery('SELECT * FROM reading_books WHERE id = ?', [bookId]);
  res.status(201).json({ success: true, data: createdBook });
}));

// Get reading book detail
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const [book] = await executeQuery(
    `SELECT rb.*, br.route_name,
      CONCAT(u.first_name, ' ', u.last_name) as generated_by_name
     FROM reading_books rb
     LEFT JOIN billing_routes br ON rb.route_id = br.id
     LEFT JOIN users u ON rb.generated_by = u.id
     WHERE rb.id = ?`,
    [req.params.id]
  );

  if (!book) {
    return res.status(404).json({ message: 'Reading book not found' });
  }

  const entries = await executeQuery(
    `SELECT rbe.*, m.serial_number, c.account_number,
      CONCAT(c.first_name, ' ', c.last_name) as customer_name
     FROM reading_book_entries rbe
     LEFT JOIN meters m ON rbe.meter_id = m.id
     LEFT JOIN customers c ON rbe.customer_id = c.id
     WHERE rbe.book_id = ?
     ORDER BY m.serial_number ASC`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...book, entries } });
}));

// Close reading book
router.put('/:id/close', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const [book] = await executeQuery('SELECT * FROM reading_books WHERE id = ?', [req.params.id]);
  if (!book) {
    return res.status(404).json({ message: 'Reading book not found' });
  }

  const [incomplete] = await executeQuery(
    'SELECT COUNT(*) as count FROM reading_book_entries WHERE book_id = ? AND status != ?',
    [req.params.id, 'read']
  );

  if (incomplete.count > 0) {
    return res.status(400).json({ message: 'Cannot close reading book until all entries are marked as read' });
  }

  const [readCount] = await executeQuery(
    'SELECT COUNT(*) as count FROM reading_book_entries WHERE book_id = ? AND status = ?',
    [req.params.id, 'read']
  );

  await executeQuery(
    'UPDATE reading_books SET status = ?, readings_done = ?, updated_at = NOW() WHERE id = ?',
    ['closed', readCount.count, req.params.id]
  );

  const [updatedBook] = await executeQuery('SELECT * FROM reading_books WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: updatedBook });
}));

module.exports = router;
