const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Generate payment number
const generatePaymentNumber = async () => {
  const year = new Date().getFullYear();
  const result = await executeQuery(
    "SELECT COUNT(*) as count FROM payments WHERE YEAR(created_at) = ?",
    [year]
  );
  const sequence = String(result[0].count + 1).padStart(6, '0');
  return `PAY-${year}-${sequence}`;
};

// Get payments
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { customer, method, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT p.*, c.account_number, CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             c.first_name, c.last_name,
             u.first_name as received_by_first_name, u.last_name as received_by_last_name
             FROM payments p 
             LEFT JOIN customers c ON p.customer_id = c.id
             LEFT JOIN users u ON p.received_by = u.id WHERE 1=1`;
  const params = [];

  if (customer) { sql += ' AND p.customer_id = ?'; params.push(customer); }
  if (method) { sql += ' AND p.payment_method = ?'; params.push(method); }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const payments = await executeQuery(sql, params);

  res.json({ success: true, data: payments });
}));

// Record payment with FIFO allocation
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { customerId, amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;

  if (!customerId || !amount || !paymentMethod || !paymentDate) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const result = await withTransaction(async (connection) => {
    const paymentNumber = await generatePaymentNumber();
    
    // Create payment
    const [paymentResult] = await connection.execute(
      `INSERT INTO payments (payment_number, customer_id, amount, payment_method, payment_date,
       reference_number, received_by, notes, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [paymentNumber, customerId, amount, paymentMethod, paymentDate, referenceNumber || null, req.user.id, notes || null]
    );
    
    const paymentId = paymentResult.insertId;
    let remainingAmount = parseFloat(amount);
    
    // Get unpaid bills (FIFO order)
    const [bills] = await connection.execute(
      `SELECT id, balance FROM bills 
       WHERE customer_id = ? AND status IN ('unpaid', 'partial') 
       ORDER BY bill_date ASC`,
      [customerId]
    );
    
    // Allocate payment to bills
    for (const bill of bills) {
      if (remainingAmount <= 0) break;
      
      const allocation = Math.min(remainingAmount, parseFloat(bill.balance));
      
      await connection.execute(
        `INSERT INTO payment_allocations (payment_id, bill_id, amount_allocated) VALUES (?, ?, ?)`,
        [paymentId, bill.id, allocation]
      );
      
      // Update bill
      const newBalance = parseFloat(bill.balance) - allocation;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      const newAmountPaid = parseFloat(bill.balance) - newBalance;
      
      await connection.execute(
        `UPDATE bills SET amount_paid = amount_paid + ?, balance = ?, status = ? WHERE id = ?`,
        [allocation, newBalance, newStatus, bill.id]
      );
      
      remainingAmount -= allocation;
    }
    
    // Update customer balance (negative = credit, positive = owing)
    const balanceChange = parseFloat(amount) - remainingAmount;
    await connection.execute(
      `UPDATE customers SET balance = balance - ? WHERE id = ?`,
      [balanceChange, customerId]
    );
    
    return { paymentId, paymentNumber, allocated: balanceChange, remaining: remainingAmount };
  });

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    data: result
  });
}));

// Daily cashier collection report
router.get('/daily-summary', verifyToken, authorize('admin', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const summary = await executeQuery(
    `SELECT payment_method, 
     u.username as cashier,
     COUNT(*) as transaction_count,
     SUM(p.amount) as total_amount
     FROM payments p
     LEFT JOIN users u ON p.received_by = u.id
     WHERE DATE(p.payment_date) = ?
     GROUP BY p.payment_method, p.received_by
     ORDER BY p.payment_method, u.username`,
    [targetDate]
  );
  
  const totals = await executeQuery(
    `SELECT COUNT(*) as total_transactions, COALESCE(SUM(amount), 0) as grand_total
     FROM payments WHERE DATE(payment_date) = ?`,
    [targetDate]
  );
  
  res.json({ success: true, data: { summary, totals: totals[0], date: targetDate } });
}));

// Payment methods list
router.get('/methods', verifyToken, asyncHandler(async (req, res) => {
  const methods = await executeQuery(
    'SELECT DISTINCT payment_method FROM payments ORDER BY payment_method'
  );
  const methodList = methods.map(m => m.payment_method);
  // Also include standard methods
  const allMethods = [...new Set([...methodList, 'cash', 'mpesa', 'bank_transfer', 'cheque'])];
  res.json({ success: true, data: allMethods });
}));

// Bulk payment import
router.post('/bulk-import', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { payments } = req.body;
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ message: 'Payments array is required' });
  }
  
  let imported = 0;
  let errors = 0;
  const errorDetails = [];
  
  for (const payment of payments) {
    try {
      const { customerId, amount, paymentMethod, paymentDate, referenceNumber } = payment;
      if (!customerId || !amount || !paymentMethod || !paymentDate) {
        throw new Error('Missing required fields');
      }
      
      await withTransaction(async (connection) => {
        const paymentNumber = await generatePaymentNumber();
        
        const [paymentResult] = await connection.execute(
          `INSERT INTO payments (payment_number, customer_id, amount, payment_method, payment_date, reference_number, received_by, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Bulk import', NOW())`,
          [paymentNumber, customerId, amount, paymentMethod, paymentDate, referenceNumber || null, req.user.id]
        );
        
        let remainingAmount = parseFloat(amount);
        const [bills] = await connection.execute(
          `SELECT id, balance FROM bills WHERE customer_id = ? AND status IN ('unpaid', 'partial') ORDER BY bill_date ASC`,
          [customerId]
        );
        
        for (const bill of bills) {
          if (remainingAmount <= 0) break;
          const allocation = Math.min(remainingAmount, parseFloat(bill.balance));
          await connection.execute(
            'INSERT INTO payment_allocations (payment_id, bill_id, amount_allocated) VALUES (?, ?, ?)',
            [paymentResult.insertId, bill.id, allocation]
          );
          const newBalance = parseFloat(bill.balance) - allocation;
          await connection.execute(
            `UPDATE bills SET amount_paid = amount_paid + ?, balance = ?, status = ? WHERE id = ?`,
            [allocation, newBalance, newBalance <= 0 ? 'paid' : 'partial', bill.id]
          );
          remainingAmount -= allocation;
        }
        
        const allocated = parseFloat(amount) - remainingAmount;
        await connection.execute('UPDATE customers SET balance = balance - ? WHERE id = ?', [allocated, customerId]);
      });
      
      imported++;
    } catch (err) {
      errors++;
      errorDetails.push({ payment, error: err.message });
    }
  }
  
  res.json({ success: true, data: { imported, errors, total: payments.length, errorDetails: errorDetails.slice(0, 10) } });
}));

// Payment detail with allocations
router.get('/:id', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const [payment] = await executeQuery(
    `SELECT p.*, c.account_number, CONCAT(c.first_name, ' ', c.last_name) as customer_name,
     c.first_name, c.last_name,
     u.username as received_by_name
     FROM payments p
     LEFT JOIN customers c ON p.customer_id = c.id
     LEFT JOIN users u ON p.received_by = u.id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  
  const allocations = await executeQuery(
    `SELECT pa.*, b.bill_number, b.billing_period
     FROM payment_allocations pa
     LEFT JOIN bills b ON pa.bill_id = b.id
     WHERE pa.payment_id = ?`,
    [req.params.id]
  );
  
  res.json({ success: true, data: { ...payment, allocations } });
}));

// Reverse payment
router.post('/:id/reverse', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  
  const [payment] = await executeQuery('SELECT * FROM payments WHERE id = ? AND status != ?', [req.params.id, 'reversed']);
  if (!payment) return res.status(404).json({ message: 'Payment not found or already reversed' });
  
  await withTransaction(async (connection) => {
    // Get allocations
    const [allocations] = await connection.execute(
      'SELECT * FROM payment_allocations WHERE payment_id = ?', [req.params.id]
    );
    
    // Reverse each allocation
    for (const alloc of allocations) {
      await connection.execute(
        `UPDATE bills SET amount_paid = amount_paid - ?, balance = balance + ?, 
         status = CASE WHEN balance + ? >= total_amount THEN 'unpaid' ELSE 'partial' END
         WHERE id = ?`,
        [alloc.amount_allocated, alloc.amount_allocated, alloc.amount_allocated, alloc.bill_id]
      );
    }
    
    // Restore customer balance
    await connection.execute(
      'UPDATE customers SET balance = balance + ? WHERE id = ?',
      [payment.amount, payment.customer_id]
    );
    
    // Mark payment as reversed
    await connection.execute(
      'UPDATE payments SET status = ?, notes = CONCAT(COALESCE(notes, ""), " | Reversed: ", ?) WHERE id = ?',
      ['reversed', reason || 'No reason provided', req.params.id]
    );
    
    // Delete allocations
    await connection.execute('DELETE FROM payment_allocations WHERE payment_id = ?', [req.params.id]);
  });
  
  res.json({ success: true, message: 'Payment reversed successfully' });
}));

module.exports = router;
