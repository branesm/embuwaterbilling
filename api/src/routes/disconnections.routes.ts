import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Prepare disconnection list
router.get('/orders/prepare', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_group_id, min_balance, min_months, disconnection_profile_id, walk_no } = req.query;

    let sql = `
      SELECT 
        c.id as customer_id,
        c.account_no,
        c.name,
        c.telephone,
        c.walk_no,
        c.address,
        c.balance as total_balance,
        COUNT(b.id) as unpaid_bills,
        MIN(b.bill_date) as oldest_bill,
        m.meter_no,
        dp.name as disconnection_profile_name
      FROM customers c
      LEFT JOIN meters m ON c.id = m.customer_id
      LEFT JOIN disconnection_profiles dp ON c.disconnection_profile_id = dp.id
      LEFT JOIN bills b ON c.id = b.customer_id 
        AND b.status IN ('unpaid', 'partial') 
        AND b.is_cancelled = false
      WHERE c.account_status = 'active'
        AND c.balance > 0
        -- Exclude accounts with complaints
        AND NOT EXISTS (
          SELECT 1 FROM complaints comp 
          WHERE comp.customer_id = c.id 
          AND comp.status NOT IN ('resolved', 'closed')
        )
        -- Exclude accounts with pending adjustments
        AND NOT EXISTS (
          SELECT 1 FROM bill_adjustments ba 
          JOIN bills b2 ON ba.bill_id = b2.id 
          WHERE b2.customer_id = c.id
        )
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (billing_group_id) {
      paramCount++;
      sql += ` AND c.billing_group_id = $${paramCount}`;
      params.push(billing_group_id);
    }
    if (min_balance) {
      paramCount++;
      sql += ` AND c.balance >= $${paramCount}`;
      params.push(parseFloat(min_balance as string));
    }
    if (disconnection_profile_id) {
      paramCount++;
      sql += ` AND c.disconnection_profile_id = $${paramCount}`;
      params.push(disconnection_profile_id);
    }
    if (walk_no) {
      paramCount++;
      sql += ` AND c.walk_no = $${paramCount}`;
      params.push(walk_no);
    }

    sql += ` GROUP BY c.id, c.account_no, c.name, c.telephone, c.walk_no, c.address, 
              c.balance, m.meter_no, dp.name`;

    if (min_months) {
      paramCount++;
      sql += ` HAVING COUNT(b.id) >= $${paramCount}`;
      params.push(parseInt(min_months as string));
    }

    sql += ` ORDER BY c.balance DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Prepare disconnection error:', error);
    res.status(500).json({ success: false, message: 'Failed to prepare disconnection list' });
  }
});

// Create disconnection order
router.post('/orders', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, disconnection_profile_id, reason, ref_no } = req.body;
    const createdBy = (req as any).user?.id;

    const result = await queryOne<any>(
      `INSERT INTO disconnections (customer_id, disc_profile_id, disc_date, reason, ref_no, status, created_by)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 'ordered', $5) RETURNING *`,
      [customer_id, disconnection_profile_id, reason, ref_no, createdBy]
    );

    // Update customer status
    await query('UPDATE customers SET account_status = $1 WHERE id = $2', ['disconnection_pending', customer_id]);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create disconnection error:', error);
    res.status(500).json({ success: false, message: 'Failed to create disconnection order' });
  }
});

// Capture physical disconnection
router.post('/:id/capture', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { disc_by, meter_reading, comments } = req.body;
    const userId = (req as any).user?.id;

    const result = await queryOne<any>(
      `UPDATE disconnections 
       SET status = 'disconnected', disc_by = $1, meter_reading = $2, comments = $3, disconnected_at = NOW(), updated_by = $4
       WHERE id = $5 RETURNING *`,
      [disc_by, meter_reading, comments, userId, id]
    );

    // Update customer status
    await query('UPDATE customers SET account_status = $1 WHERE id = $2', ['disconnected', result.customer_id]);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Capture disconnection error:', error);
    res.status(500).json({ success: false, message: 'Failed to capture disconnection' });
  }
});

// Reconnection list
router.get('/reconnections', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_group_id, date_from, date_to, account_status } = req.query;

    let sql = `
      SELECT 
        d.id,
        c.account_no,
        c.name as customer_name,
        c.balance,
        c.telephone,
        c.route_no,
        c.walk_no,
        m.meter_no,
        d.disc_date,
        d.reconnected_at,
        d.reconnection_fee_paid,
        d.status,
        bg.name as billing_group_name
      FROM disconnections d
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN meters m ON c.id = m.customer_id
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      WHERE d.status = 'disconnected'
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (billing_group_id) {
      paramCount++;
      sql += ` AND c.billing_group_id = $${paramCount}`;
      params.push(billing_group_id);
    }
    if (date_from) {
      paramCount++;
      sql += ` AND d.disc_date >= $${paramCount}`;
      params.push(date_from);
    }
    if (date_to) {
      paramCount++;
      sql += ` AND d.disc_date <= $${paramCount}`;
      params.push(date_to);
    }
    if (account_status) {
      paramCount++;
      sql += ` AND c.account_status = $${paramCount}`;
      params.push(account_status);
    }

    sql += ` ORDER BY d.disc_date DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reconnection list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reconnection list' });
  }
});

// Process reconnection
router.post('/:id/reconnect', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reconnected_by, reconnection_fee_paid, ref_no } = req.body;
    const userId = (req as any).user?.id;

    const result = await queryOne<any>(
      `UPDATE disconnections 
       SET status = 'reconnected', reconnected_by = $1, reconnection_fee_paid = $2, 
           ref_no = $3, reconnected_at = NOW(), updated_by = $4
       WHERE id = $5 RETURNING *`,
      [reconnected_by, reconnection_fee_paid, ref_no, userId, id]
    );

    // Update customer status
    await query('UPDATE customers SET account_status = $1 WHERE id = $2', ['active', result.customer_id]);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reconnection error:', error);
    res.status(500).json({ success: false, message: 'Failed to process reconnection' });
  }
});

// Disconnection history
router.get('/history', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT d.*, c.account_no, c.name as customer_name
               FROM disconnections d
               JOIN customers c ON d.customer_id = c.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND d.customer_id = $${paramCount}`;
      params.push(customer_id);
    }

    paramCount++;
    sql += ` ORDER BY d.disc_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load disconnection history' });
  }
});

// Bulk create disconnection orders
router.post('/orders/bulk', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_ids, disconnection_profile_id, reason, ref_no } = req.body;
    const createdBy = (req as any).user?.id;

    const results = await withTransaction(async (client) => {
      const created = [];
      for (const customer_id of customer_ids) {
        const result = await client.query(
          `INSERT INTO disconnections (customer_id, disc_profile_id, disc_date, reason, ref_no, status, created_by)
           VALUES ($1, $2, CURRENT_DATE, $3, $4, 'ordered', $5) RETURNING *`,
          [customer_id, disconnection_profile_id, reason, ref_no, createdBy]
        );
        await client.query('UPDATE customers SET account_status = $1 WHERE id = $2', ['disconnection_pending', customer_id]);
        created.push(result.rows[0]);
      }
      return created;
    });

    res.status(201).json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('Bulk create disconnection error:', error);
    res.status(500).json({ success: false, message: 'Failed to create disconnection orders' });
  }
});

// Get single disconnection order
router.get('/orders/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne(
      `SELECT d.*, c.account_no, c.name as customer_name, c.telephone, c.address, c.balance,
              m.meter_no, dp.name as profile_name, dp.min_balance, dp.min_months_unpaid
       FROM disconnections d
       JOIN customers c ON d.customer_id = c.id
       LEFT JOIN meters m ON c.id = m.customer_id
       LEFT JOIN disconnection_profiles dp ON d.disc_profile_id = dp.id
       WHERE d.id = $1`,
      [id]
    );
    if (!result) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load order' });
  }
});

// Cancel disconnection order
router.post('/orders/:id/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    const userId = (req as any).user?.id;

    const order = await queryOne<any>('SELECT * FROM disconnections WHERE id = $1', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    await query(
      `UPDATE disconnections SET status = 'cancelled', cancel_reason = $1, cancelled_at = NOW(), updated_by = $2 WHERE id = $3`,
      [cancel_reason, userId, id]
    );
    await query('UPDATE customers SET account_status = $1 WHERE id = $2', ['active', order.customer_id]);

    res.json({ success: true, message: 'Order cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

// Mark customer with non-disconnection code
router.post('/non-disconnect', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, code_id, reason, valid_until } = req.body;
    const createdBy = (req as any).user?.id;

    const result = await queryOne(
      `INSERT INTO customer_non_disconnections (customer_id, code_id, reason, valid_until, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [customer_id, code_id, reason, valid_until, createdBy]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Non-disconnect error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark non-disconnection' });
  }
});

// Get customer's non-disconnection status
router.get('/non-disconnect/:customer_id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.params;
    const result = await query(
      `SELECT cnd.*, ndc.code, ndc.name as code_name
       FROM customer_non_disconnections cnd
       JOIN non_disconnection_codes ndc ON cnd.code_id = ndc.id
       WHERE cnd.customer_id = $1 AND (cnd.valid_until IS NULL OR cnd.valid_until >= CURRENT_DATE)
       ORDER BY cnd.created_at DESC`,
      [customer_id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load non-disconnection status' });
  }
});

// ==================== DISCONNECTION PROFILES ====================

router.get('/profiles', verifyToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM disconnection_profiles ORDER BY name');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load profiles' });
  }
});

router.post('/profiles', verifyToken, async (req: Request, res: Response) => {
  try {
    const { code, name, min_balance, min_months_unpaid, auto_disconnect, description } = req.body;
    const result = await queryOne(
      `INSERT INTO disconnection_profiles (code, name, min_balance, min_months_unpaid, auto_disconnect, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, name, min_balance, min_months_unpaid, auto_disconnect, description]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to create profile' });
  }
});

router.put('/profiles/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, min_balance, min_months_unpaid, auto_disconnect, description, is_active } = req.body;
    const result = await queryOne(
      `UPDATE disconnection_profiles
       SET code = COALESCE($1, code), name = COALESCE($2, name), min_balance = COALESCE($3, min_balance),
           min_months_unpaid = COALESCE($4, min_months_unpaid), auto_disconnect = COALESCE($5, auto_disconnect),
           description = COALESCE($6, description), is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [code, name, min_balance, min_months_unpaid, auto_disconnect, description, is_active, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// ==================== LOOKUPS ====================

router.get('/modes', verifyToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM disconnection_modes WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load modes' });
  }
});

router.get('/non-disconnection-codes', verifyToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM non_disconnection_codes WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load codes' });
  }
});

// ==================== REPORTS ====================

router.get('/report', verifyToken, async (req: Request, res: Response) => {
  try {
    const { date_from, date_to, billing_group_id, area_code, status, profile_id } = req.query;

    let sql = `
      SELECT 
        d.id,
        d.disc_date,
        d.status,
        d.reason,
        d.disc_by,
        d.disconnected_at,
        d.reconnected_at,
        d.reconnected_by,
        d.reconnection_fee_paid,
        c.account_no,
        c.name as customer_name,
        c.telephone,
        c.address,
        bg.name as billing_group_name,
        bg.area_code,
        dp.name as profile_name,
        m.meter_no
      FROM disconnections d
      JOIN customers c ON d.customer_id = c.id
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN disconnection_profiles dp ON d.disc_profile_id = dp.id
      LEFT JOIN meters m ON c.id = m.customer_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (date_from) { paramCount++; sql += ` AND d.disc_date >= $${paramCount}`; params.push(date_from); }
    if (date_to) { paramCount++; sql += ` AND d.disc_date <= $${paramCount}`; params.push(date_to); }
    if (billing_group_id) { paramCount++; sql += ` AND c.billing_group_id = $${paramCount}`; params.push(billing_group_id); }
    if (area_code) { paramCount++; sql += ` AND bg.area_code = $${paramCount}`; params.push(area_code); }
    if (status) { paramCount++; sql += ` AND d.status = $${paramCount}`; params.push(status); }
    if (profile_id) { paramCount++; sql += ` AND d.disc_profile_id = $${paramCount}`; params.push(profile_id); }

    sql += ` ORDER BY d.disc_date DESC`;

    const result = await query(sql, params);

    // Summary stats
    const stats = {
      total: result.length,
      ordered: result.filter((r: any) => r.status === 'ordered').length,
      disconnected: result.filter((r: any) => r.status === 'disconnected').length,
      reconnected: result.filter((r: any) => r.status === 'reconnected').length,
      cancelled: result.filter((r: any) => r.status === 'cancelled').length,
      reconnection_fees: result.reduce((sum: number, r: any) => sum + parseFloat(r.reconnection_fee_paid || 0), 0)
    };

    res.json({ success: true, data: result, summary: stats });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Disconnecters / Reconnecters maintenance
router.get('/personnel', verifyToken, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM employees WHERE is_active = true';
    if (type === 'disconnecter') {
      sql += " AND can_disconnect = true";
    } else if (type === 'reconnecter') {
      sql += " AND can_reconnect = true";
    }
    sql += ' ORDER BY first_name';
    const result = await query(sql, []);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load personnel' });
  }
});

export default router;
