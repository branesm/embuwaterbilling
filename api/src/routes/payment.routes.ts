import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// Generate receipt number
const generateReceiptNo = async (): Promise<string> => {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const result = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM payments WHERE DATE(payment_date) = CURRENT_DATE",
    []
  );
  const seq = String(parseInt(result?.count || '0') + 1).padStart(4, '0');
  return `RCP-${today}-${seq}`;
};

// Post payment
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      customer_id, amount, payment_date, payment_mode_id,
      payment_category_id, reference, notes
    } = req.body;

    const receiptNo = await generateReceiptNo();
    const cashierId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      // Create payment
      const paymentResult = await client.query(
        `INSERT INTO payments (receipt_no, customer_id, amount, payment_date,
         payment_mode_id, payment_category_id, reference, cashier_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [receiptNo, customer_id, amount, payment_date, payment_mode_id,
         payment_category_id, reference, cashierId, notes]
      );

      const paymentId = paymentResult.rows[0].id;

      // Get unpaid bills (FIFO order)
      const billsResult = await client.query(
        `SELECT id, balance FROM bills 
         WHERE customer_id = $1 AND status IN ('unpaid', 'partial') 
         AND is_cancelled = false
         ORDER BY bill_date ASC`,
        [customer_id]
      );

      let remaining = parseFloat(amount);
      for (const bill of billsResult.rows) {
        if (remaining <= 0) break;
        const allocation = Math.min(remaining, parseFloat(bill.balance));
        
        await client.query(
          `INSERT INTO payment_allocations (payment_id, bill_id, amount_allocated)
           VALUES ($1, $2, $3)`,
          [paymentId, bill.id, allocation]
        );

        const newBalance = parseFloat(bill.balance) - allocation;
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';

        await client.query(
          `UPDATE bills SET amount_paid = amount_paid + $1, balance = $2, status = $3 WHERE id = $4`,
          [allocation, newBalance, newStatus, bill.id]
        );

        remaining -= allocation;
      }

      // Update customer balance
      await client.query(
        'UPDATE customers SET balance = balance - $1 WHERE id = $2',
        [amount, customer_id]
      );

      return paymentResult.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
});

// Get payments
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, cashier_id, date_from, date_to, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT p.*, c.name as customer_name, pm.name as payment_mode_name
               FROM payments p
               LEFT JOIN customers c ON p.customer_id = c.id
               LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
               WHERE p.is_cancelled = false`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND p.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (cashier_id) {
      paramCount++;
      sql += ` AND p.cashier_id = $${paramCount}`;
      params.push(cashier_id);
    }
    if (date_from) {
      paramCount++;
      sql += ` AND p.payment_date >= $${paramCount}`;
      params.push(date_from);
    }
    if (date_to) {
      paramCount++;
      sql += ` AND p.payment_date <= $${paramCount}`;
      params.push(date_to);
    }

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`,
      params
    );

    paramCount++;
    sql += ` ORDER BY p.payment_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const payments = await query(sql, params);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0'),
        pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Payment list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payments' });
  }
});

// Get payment allocations
router.get('/:id/allocations', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allocs = await query(
      `SELECT pa.*, b.bill_no, b.bill_date, b.total_amount as bill_total
       FROM payment_allocations pa
       JOIN bills b ON pa.bill_id = b.id
       WHERE pa.payment_id = $1`,
      [id]
    );
    res.json({ success: true, data: allocs });
  } catch (error) {
    console.error('Allocations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load allocations' });
  }
});

// Get payment plans
router.get('/payment-plans', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, status, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT pp.*, c.name as customer_name, c.account_no
               FROM payment_plans pp
               JOIN customers c ON pp.customer_id = c.id WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) { paramCount++; sql += ` AND pp.customer_id = $${paramCount}`; params.push(customer_id); }
    if (status) { paramCount++; sql += ` AND pp.status = $${paramCount}`; params.push(status); }

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`, params
    );

    paramCount++;
    sql += ` ORDER BY pp.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const plans = await query(sql, params);
    res.json({
      success: true, data: plans,
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total: parseInt(countResult?.total || '0'), pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string)) }
    });
  } catch (error) {
    console.error('Payment plans error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payment plans' });
  }
});

// Create payment plan
router.post('/payment-plans', verifyToken, requirePermission('payments', 'create'), async (req: Request, res: Response) => {
  try {
    const { customer_id, total_amount, down_payment, installment_amount, num_installments, frequency, start_date, end_date } = req.body;
    const userId = (req as any).user?.id;

    const planNo = `PLAN-${Date.now()}`;
    const plan = await queryOne<any>(
      `INSERT INTO payment_plans (plan_no, customer_id, total_amount, down_payment, installment_amount, num_installments, frequency, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [planNo, customer_id, total_amount, down_payment || 0, installment_amount, num_installments, frequency || 'monthly', start_date, end_date, userId]
    );

    // Generate installments
    const installments = [];
    for (let i = 1; i <= num_installments; i++) {
      const dueDate = new Date(start_date);
      if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
      else if (frequency === 'biweekly') dueDate.setDate(dueDate.getDate() + (i - 1) * 14);
      else dueDate.setMonth(dueDate.getMonth() + (i - 1));

      const inst = await queryOne<any>(
        `INSERT INTO payment_plan_installments (plan_id, installment_no, due_date, amount)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [plan.id, i, dueDate.toISOString().split('T')[0], installment_amount]
      );
      installments.push(inst);
    }

    res.status(201).json({ success: true, data: { ...plan, installments } });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment plan' });
  }
});

// Get single payment plan with installments
router.get('/payment-plans/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await queryOne<any>(
      `SELECT pp.*, c.name as customer_name, c.account_no
       FROM payment_plans pp
       JOIN customers c ON pp.customer_id = c.id
       WHERE pp.id = $1`, [id]
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const installments = await query(
      'SELECT * FROM payment_plan_installments WHERE plan_id = $1 ORDER BY installment_no',
      [id]
    );
    res.json({ success: true, data: { ...plan, installments } });
  } catch (error) {
    console.error('Plan detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to load plan' });
  }
});

// Pay a plan installment
router.post('/payment-plans/:id/installments/:installmentId/pay', verifyToken, requirePermission('payments', 'create'), async (req: Request, res: Response) => {
  try {
    const { installmentId } = req.params;
    const { payment_id } = req.body;

    const updated = await queryOne<any>(
      `UPDATE payment_plan_installments
       SET amount_paid = amount, status = 'paid', payment_id = $1
       WHERE id = $2 RETURNING *`,
      [payment_id, installmentId]
    );

    // Check if all installments paid
    const pending = await queryOne<any>(
      `SELECT COUNT(*) as count FROM payment_plan_installments WHERE plan_id = $1 AND status != 'paid'`,
      [updated.plan_id]
    );
    if (parseInt(pending.count) === 0) {
      await query(`UPDATE payment_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [updated.plan_id]);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Pay installment error:', error);
    res.status(500).json({ success: false, message: 'Failed to pay installment' });
  }
});

// Cancel payment
router.post('/:id/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cancelledBy = (req as any).user?.id;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE payments SET is_cancelled = true, cancel_reason = $1, cancelled_by = $2, cancelled_at = NOW()
         WHERE id = $3`,
        [reason, cancelledBy, id]
      );

      // Reverse allocations
      const allocs = await client.query(
        'SELECT bill_id, amount_allocated FROM payment_allocations WHERE payment_id = $1',
        [id]
      );

      for (const alloc of allocs.rows) {
        await client.query(
          `UPDATE bills SET amount_paid = amount_paid - $1, balance = balance + $1,
           status = CASE WHEN amount_paid - $1 <= 0 THEN 'unpaid' ELSE 'partial' END
           WHERE id = $2`,
          [alloc.amount_allocated, alloc.bill_id]
        );
      }
    });

    res.json({ success: true, message: 'Payment cancelled' });
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel payment' });
  }
});

export default router;
