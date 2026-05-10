import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Get meter readings with filters
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, billing_period_id, route_id, reader_id, is_billed, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT mr.*, c.name as customer_name, c.account_no, m.meter_no,
                      br.code as route_code, rc.code as reading_code_name
               FROM meter_readings mr
               JOIN customers c ON mr.customer_id = c.id
               JOIN meters m ON mr.meter_id = m.id
               LEFT JOIN billing_routes br ON c.route_no = br.code
               LEFT JOIN reading_codes rc ON mr.reading_code_id = rc.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (customer_id) {
      paramCount++;
      sql += ` AND mr.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (billing_period_id) {
      paramCount++;
      sql += ` AND mr.billing_period_id = $${paramCount}`;
      params.push(billing_period_id);
    }
    if (route_id) {
      paramCount++;
      sql += ` AND c.route_no = $${paramCount}`;
      params.push(route_id);
    }
    if (reader_id) {
      paramCount++;
      sql += ` AND mr.reader_id = $${paramCount}`;
      params.push(reader_id);
    }
    if (is_billed !== undefined) {
      paramCount++;
      sql += ` AND mr.is_billed = $${paramCount}`;
      params.push(is_billed === 'true');
    }

    paramCount++;
    sql += ` ORDER BY mr.reading_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const readings = await query(sql, params);
    res.json({ success: true, data: readings });
  } catch (error) {
    console.error('Readings list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load readings' });
  }
});

// Create meter reading
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      customer_id, meter_id, billing_period_id, reading_date,
      current_reading, previous_reading, reading_code_id, reader_id, comments
    } = req.body;

    const consumption = parseFloat(current_reading) - parseFloat(previous_reading);

    // Check for anomalies
    const customer = await queryOne<{ average_consumption: number }>(
      'SELECT average_consumption FROM customers WHERE id = $1',
      [customer_id]
    );

    const isAnomaly = customer && consumption > (customer.average_consumption * 2);

    const result = await queryOne(
      `INSERT INTO meter_readings (customer_id, meter_id, billing_period_id, reading_date,
       current_reading, previous_reading, consumption, reading_code_id, reader_id, comments, is_anomaly)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [customer_id, meter_id, billing_period_id, reading_date,
       current_reading, previous_reading, consumption, reading_code_id, reader_id, comments, isAnomaly]
    );

    // Update meter current reading
    await query('UPDATE meters SET current_reading = $1 WHERE id = $2', [current_reading, meter_id]);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create reading error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reading' });
  }
});

// Bulk upload readings
router.post('/bulk', verifyToken, async (req: Request, res: Response) => {
  try {
    const { readings, billing_period_id } = req.body;
    const readerId = (req as any).user?.id;

    const results = [];
    const errors = [];

    for (const reading of readings) {
      try {
        const { customer_id, meter_id, reading_date, current_reading, previous_reading } = reading;
        const consumption = parseFloat(current_reading) - parseFloat(previous_reading);

        const result = await queryOne(
          `INSERT INTO meter_readings (customer_id, meter_id, billing_period_id, reading_date,
           current_reading, previous_reading, consumption, reader_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [customer_id, meter_id, billing_period_id, reading_date,
           current_reading, previous_reading, consumption, readerId]
        );

        await query('UPDATE meters SET current_reading = $1 WHERE id = $2', [current_reading, meter_id]);
        results.push(result);
      } catch (err: any) {
        errors.push({ reading, error: err.message });
      }
    }

    res.json({ success: true, data: { inserted: results.length, errors } });
  } catch (error) {
    console.error('Bulk readings error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk readings' });
  }
});

// Get reading anomalies
router.get('/anomalies', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_period_id } = req.query;
    let sql = `SELECT mr.*, c.name as customer_name, c.account_no, m.meter_no
               FROM meter_readings mr
               JOIN customers c ON mr.customer_id = c.id
               JOIN meters m ON mr.meter_id = m.id
               WHERE mr.is_anomaly = true`;
    const params: any[] = [];

    if (billing_period_id) {
      sql += ' AND mr.billing_period_id = $1';
      params.push(billing_period_id);
    }
    sql += ' ORDER BY mr.reading_date DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load anomalies' });
  }
});

// Get reading book (route-based list for meter readers)
router.get('/book/:routeId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { billing_period_id } = req.query;

    const customers = await query(
      `SELECT c.id as customer_id, c.name, c.account_no, c.walk_no,
              m.id as meter_id, m.meter_no, m.digits, m.current_reading as previous_reading
       FROM customers c
       JOIN meters m ON c.id = m.customer_id
       WHERE c.route_no = $1 AND c.account_status = 'active'
       ORDER BY c.walk_no, c.account_no`,
      [routeId]
    );

    // Get existing readings for this period
    let existingReadings: any[] = [];
    if (billing_period_id) {
      existingReadings = await query(
        'SELECT customer_id, current_reading, consumption FROM meter_readings WHERE billing_period_id = $1',
        [billing_period_id]
      );
    }

    const readingMap = new Map(existingReadings.map(r => [r.customer_id, r]));

    const book = customers.map(c => ({
      ...c,
      current_reading: readingMap.get(c.customer_id)?.current_reading || null,
      consumption: readingMap.get(c.customer_id)?.consumption || null
    }));

    res.json({ success: true, data: book });
  } catch (error) {
    console.error('Reading book error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reading book' });
  }
});

export default router;
