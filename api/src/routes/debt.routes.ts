import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';
import * as XLSX from 'xlsx';

const router = express.Router();

// ==================== PAYMENT ARRANGEMENTS ====================

// Create payment arrangement
router.post('/arrangements', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, total_debt, first_installment, num_installments, engagement_date } = req.body;
    const createdBy = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const scheduleResult = await client.query(
        `INSERT INTO payment_schedules (customer_id, total_debt, first_installment, num_installments, engagement_date, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
        [customer_id, total_debt, first_installment, num_installments, engagement_date, createdBy]
      );

      const scheduleId = scheduleResult.rows[0].id;
      const remaining = parseFloat(total_debt) - parseFloat(first_installment);
      const regularAmount = remaining / (parseInt(num_installments) - 1);

      const installments = [];
      let currentDate = new Date(engagement_date);

      // First installment
      installments.push({
        schedule_id: scheduleId,
        due_date: new Date(currentDate),
        amount: parseFloat(first_installment)
      });

      // Remaining installments (monthly)
      for (let i = 1; i < parseInt(num_installments); i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        installments.push({
          schedule_id: scheduleId,
          due_date: new Date(currentDate),
          amount: regularAmount
        });
      }

      for (const inst of installments) {
        await client.query(
          `INSERT INTO payment_installments (schedule_id, due_date, amount, status)
           VALUES ($1, $2, $3, 'pending')`,
          [inst.schedule_id, inst.due_date, inst.amount]
        );
      }

      return scheduleResult.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Arrangement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create arrangement' });
  }
});

// Get payment arrangements
router.get('/arrangements', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, status, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT ps.*, c.name as customer_name, c.account_no
               FROM payment_schedules ps
               JOIN customers c ON ps.customer_id = c.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND ps.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (status) {
      paramCount++;
      sql += ` AND ps.status = $${paramCount}`;
      params.push(status);
    }

    paramCount++;
    sql += ` ORDER BY ps.engagement_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const arrangements = await query(sql, params);
    res.json({ success: true, data: arrangements });
  } catch (error) {
    console.error('Arrangements list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load arrangements' });
  }
});

// Get arrangement detail with installments
router.get('/arrangements/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const arrangement = await queryOne(
      `SELECT ps.*, c.name as customer_name, c.account_no, c.telephone, c.email, c.balance
       FROM payment_schedules ps
       JOIN customers c ON ps.customer_id = c.id
       WHERE ps.id = $1`,
      [id]
    );
    if (!arrangement) {
      return res.status(404).json({ success: false, message: 'Arrangement not found' });
    }
    const installments = await query(
      'SELECT * FROM payment_installments WHERE schedule_id = $1 ORDER BY due_date',
      [id]
    );
    res.json({ success: true, data: { ...arrangement, installments } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load arrangement' });
  }
});

// Update arrangement
router.put('/arrangements/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { total_debt, first_installment, num_installments, engagement_date, status } = req.body;
    const result = await queryOne(
      `UPDATE payment_schedules
       SET total_debt = COALESCE($1, total_debt),
           first_installment = COALESCE($2, first_installment),
           num_installments = COALESCE($3, num_installments),
           engagement_date = COALESCE($4, engagement_date),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [total_debt, first_installment, num_installments, engagement_date, status, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update arrangement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update arrangement' });
  }
});

// Cancel arrangement
router.post('/arrangements/:id/cancel', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cancelledBy = (req as any).user?.id;
    await queryOne(
      `UPDATE payment_schedules SET status = 'cancelled', cancel_reason = $1, cancelled_by = $2, cancelled_at = NOW()
       WHERE id = $3`,
      [reason, cancelledBy, id]
    );
    res.json({ success: true, message: 'Arrangement cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel arrangement' });
  }
});

// ==================== AGED ANALYSIS ====================

// Aged analysis by zone
router.get('/aged-analysis/zone', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_group_id, view = 'summary', months = '6' } = req.query;
    const monthsCount = parseInt(months as string);
    const isDetailed = view === 'detailed';

    let sql = `
      WITH bill_aging AS (
        SELECT 
          c.id as customer_id,
          c.name,
          c.account_no,
          bg.name as billing_group_name,
          bg.code as billing_group_code,
          b.total_amount,
          b.balance,
          b.bill_date,
          b.bill_no,
          CASE 
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '1 month' THEN 'current'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '2 months' THEN '1_month'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '3 months' THEN '2_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '4 months' THEN '3_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '5 months' THEN '4_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '6 months' THEN '5_months'
            ELSE 'over_6_months'
          END as age_bucket
        FROM customers c
        JOIN bills b ON c.id = b.customer_id
        LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
        WHERE b.status IN ('unpaid', 'partial') AND b.is_cancelled = false
    `;

    const params: any[] = [];
    if (billing_group_id) {
      sql += ` AND c.billing_group_id = $1`;
      params.push(billing_group_id);
    }

    sql += `)`;

    if (isDetailed) {
      sql += `
        SELECT 
          billing_group_name,
          billing_group_code,
          customer_id,
          account_no,
          name as customer_name,
          age_bucket,
          bill_no,
          bill_date,
          balance
        FROM bill_aging
        ORDER BY billing_group_name, balance DESC
      `;
    } else {
      sql += `
        SELECT 
          billing_group_name,
          COUNT(DISTINCT customer_id) as customer_count,
          SUM(CASE WHEN age_bucket = 'current' THEN balance ELSE 0 END) as current_amount,
          SUM(CASE WHEN age_bucket = '1_month' THEN balance ELSE 0 END) as month_1,
          SUM(CASE WHEN age_bucket = '2_months' THEN balance ELSE 0 END) as month_2,
          SUM(CASE WHEN age_bucket = '3_months' THEN balance ELSE 0 END) as month_3,
          SUM(CASE WHEN age_bucket = '4_months' THEN balance ELSE 0 END) as month_4,
          SUM(CASE WHEN age_bucket = '5_months' THEN balance ELSE 0 END) as month_5,
          SUM(CASE WHEN age_bucket = 'over_6_months' THEN balance ELSE 0 END) as over_6_months,
          SUM(balance) as total_balance
        FROM bill_aging
        GROUP BY billing_group_name
        ORDER BY billing_group_name
      `;
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result, view, months: monthsCount });
  } catch (error) {
    console.error('Aged analysis error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate aged analysis' });
  }
});

// Aged analysis by area (EMB, GKA, KRT, KTH, KYM, TWN)
router.get('/aged-analysis/area', verifyToken, async (req: Request, res: Response) => {
  try {
    const { area_code, view = 'summary', months = '6' } = req.query;
    const monthsCount = parseInt(months as string);
    const isDetailed = view === 'detailed';

    let sql = `
      WITH bill_aging AS (
        SELECT 
          c.id as customer_id,
          c.name,
          c.account_no,
          bg.area_code,
          b.total_amount,
          b.balance,
          b.bill_date,
          b.bill_no,
          CASE 
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '1 month' THEN 'current'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '2 months' THEN '1_month'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '3 months' THEN '2_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '4 months' THEN '3_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '5 months' THEN '4_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '6 months' THEN '5_months'
            ELSE 'over_6_months'
          END as age_bucket
        FROM customers c
        JOIN bills b ON c.id = b.customer_id
        LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
        WHERE b.status IN ('unpaid', 'partial') AND b.is_cancelled = false
    `;

    const params: any[] = [];
    if (area_code) {
      sql += ` AND bg.area_code = $1`;
      params.push(area_code);
    }

    sql += `)`;

    if (isDetailed) {
      sql += `
        SELECT 
          area_code,
          customer_id,
          account_no,
          name as customer_name,
          age_bucket,
          bill_no,
          bill_date,
          balance
        FROM bill_aging
        ORDER BY area_code, balance DESC
      `;
    } else {
      sql += `
        SELECT 
          COALESCE(area_code, 'UNKNOWN') as area_code,
          COUNT(DISTINCT customer_id) as customer_count,
          SUM(CASE WHEN age_bucket = 'current' THEN balance ELSE 0 END) as current_amount,
          SUM(CASE WHEN age_bucket = '1_month' THEN balance ELSE 0 END) as month_1,
          SUM(CASE WHEN age_bucket = '2_months' THEN balance ELSE 0 END) as month_2,
          SUM(CASE WHEN age_bucket = '3_months' THEN balance ELSE 0 END) as month_3,
          SUM(CASE WHEN age_bucket = '4_months' THEN balance ELSE 0 END) as month_4,
          SUM(CASE WHEN age_bucket = '5_months' THEN balance ELSE 0 END) as month_5,
          SUM(CASE WHEN age_bucket = 'over_6_months' THEN balance ELSE 0 END) as over_6_months,
          SUM(balance) as total_balance
        FROM bill_aging
        GROUP BY area_code
        ORDER BY area_code
      `;
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result, view, months: monthsCount });
  } catch (error) {
    console.error('Aged analysis area error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate aged analysis by area' });
  }
});

// Aged analysis by customer category
router.get('/aged-analysis/category', verifyToken, async (req: Request, res: Response) => {
  try {
    let sql = `
      WITH bill_aging AS (
        SELECT 
          c.id as customer_id,
          cc.name as category_name,
          b.balance,
          CASE 
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '1 month' THEN 'current'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '2 months' THEN '1_month'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '3 months' THEN '2_months'
            WHEN b.bill_date >= CURRENT_DATE - INTERVAL '6 months' THEN '3_to_6_months'
            ELSE 'over_6_months'
          END as age_bucket
        FROM customers c
        JOIN bills b ON c.id = b.customer_id
        JOIN customer_categories cc ON c.category_id = cc.id
        WHERE b.status IN ('unpaid', 'partial') AND b.is_cancelled = false
      )
      SELECT 
        category_name,
        COUNT(DISTINCT customer_id) as customer_count,
        SUM(CASE WHEN age_bucket = 'current' THEN balance ELSE 0 END) as current_amount,
        SUM(CASE WHEN age_bucket = '1_month' THEN balance ELSE 0 END) as month_1,
        SUM(CASE WHEN age_bucket = '2_months' THEN balance ELSE 0 END) as month_2,
        SUM(CASE WHEN age_bucket = '3_to_6_months' THEN balance ELSE 0 END) as months_3_6,
        SUM(CASE WHEN age_bucket = 'over_6_months' THEN balance ELSE 0 END) as over_6_months,
        SUM(balance) as total_balance
      FROM bill_aging
      GROUP BY category_name
      ORDER BY total_balance DESC
    `;

    const result = await query(sql, []);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Aged analysis category error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate aged analysis' });
  }
});

// Debtors report
router.get('/debtors', verifyToken, async (req: Request, res: Response) => {
  try {
    const { min_balance, billing_group_id, category_id, area_code, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `
      SELECT 
        c.id,
        c.account_no,
        c.name,
        c.telephone,
        c.email,
        bg.name as billing_group_name,
        bg.area_code,
        cc.name as category_name,
        c.balance as total_balance,
        COUNT(b.id) as unpaid_bills,
        MIN(b.bill_date) as oldest_bill_date,
        MAX(b.due_date) as latest_due_date
      FROM customers c
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN customer_categories cc ON c.category_id = cc.id
      LEFT JOIN bills b ON c.id = b.customer_id AND b.status IN ('unpaid', 'partial') AND b.is_cancelled = false
      WHERE c.account_status = 'active'
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (min_balance) {
      paramCount++;
      sql += ` AND c.balance >= $${paramCount}`;
      params.push(parseFloat(min_balance as string));
    }
    if (billing_group_id) {
      paramCount++;
      sql += ` AND c.billing_group_id = $${paramCount}`;
      params.push(billing_group_id);
    }
    if (category_id) {
      paramCount++;
      sql += ` AND c.category_id = $${paramCount}`;
      params.push(category_id);
    }
    if (area_code) {
      paramCount++;
      sql += ` AND bg.area_code = $${paramCount}`;
      params.push(area_code);
    }

    sql += ` GROUP BY c.id, c.account_no, c.name, c.telephone, c.email, bg.name, bg.area_code, cc.name, c.balance
             HAVING COUNT(b.id) > 0`;

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`,
      params
    );

    paramCount++;
    sql += ` ORDER BY c.balance DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(sql, params);
    res.json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0'),
        pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Debtors report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate debtors report' });
  }
});

// Export aged analysis to Excel
router.get('/aged-analysis/export', verifyToken, async (req: Request, res: Response) => {
  try {
    const { type = 'zone', view = 'summary' } = req.query;
    const endpoint = type === 'area' ? '/aged-analysis/area' : '/aged-analysis/zone';
    const data = await query(`SELECT * FROM (${endpoint}) as sub`, []);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aged Analysis');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="aged-analysis-${type}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export' });
  }
});

// Export debtors to Excel
router.get('/debtors/export', verifyToken, async (req: Request, res: Response) => {
  try {
    const { min_balance, billing_group_id } = req.query;
    let sql = `
      SELECT 
        c.account_no,
        c.name,
        c.telephone,
        c.email,
        bg.name as billing_group,
        cc.name as category,
        c.balance as total_balance,
        COUNT(b.id) as unpaid_bills,
        MIN(b.bill_date) as oldest_bill_date
      FROM customers c
      LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
      LEFT JOIN customer_categories cc ON c.category_id = cc.id
      LEFT JOIN bills b ON c.id = b.customer_id AND b.status IN ('unpaid', 'partial') AND b.is_cancelled = false
      WHERE c.account_status = 'active'
    `;
    const params: any[] = [];
    if (min_balance) { sql += ` AND c.balance >= $1`; params.push(parseFloat(min_balance as string)); }
    sql += ` GROUP BY c.id, c.account_no, c.name, c.telephone, c.email, bg.name, cc.name, c.balance HAVING COUNT(b.id) > 0 ORDER BY c.balance DESC`;

    const data = await query(sql, params);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debtors');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="debtors-report.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export' });
  }
});

export default router;
