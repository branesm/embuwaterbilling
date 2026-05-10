import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// ==================== DMA REGIONS ====================

// Get DMA regions hierarchy
router.get('/regions', verifyToken, async (req: Request, res: Response) => {
  try {
    const regions = await query(
      `SELECT dr.*, p.name as parent_name,
              (SELECT COUNT(*) FROM customers WHERE dma_id = dr.id) as connection_count
       FROM dma_regions dr
       LEFT JOIN dma_regions p ON dr.parent_id = p.id
       WHERE dr.is_active = true
       ORDER BY dr.code`
    );
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load regions' });
  }
});

// Create DMA region
router.post('/regions', verifyToken, async (req: Request, res: Response) => {
  try {
    const { code, name, parent_id, region_type } = req.body;
    const result = await queryOne(
      'INSERT INTO dma_regions (code, name, parent_id, region_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, name, parent_id, region_type]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create region error:', error);
    res.status(500).json({ success: false, message: 'Failed to create region' });
  }
});

// Update DMA region
router.put('/regions/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, parent_id, region_type, is_active } = req.body;
    const result = await queryOne(
      `UPDATE dma_regions SET code = $1, name = $2, parent_id = $3, region_type = $4, is_active = COALESCE($5, is_active) WHERE id = $6 RETURNING *`,
      [code, name, parent_id, region_type, is_active, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update region error:', error);
    res.status(500).json({ success: false, message: 'Failed to update region' });
  }
});

// Delete DMA region (soft delete)
router.delete('/regions/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne(
      'UPDATE dma_regions SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete region error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete region' });
  }
});

// ==================== MASTER METERS ====================

// Get master meters
router.get('/master-meters', verifyToken, async (req: Request, res: Response) => {
  try {
    const { dma_id } = req.query;
    let sql = `SELECT mm.*, 
                      in_dma.name as inflow_dma_name,
                      out_dma.name as outflow_dma_name
               FROM master_meters mm
               LEFT JOIN dma_regions in_dma ON mm.inflow_dma_id = in_dma.id
               LEFT JOIN dma_regions out_dma ON mm.outflow_dma_id = out_dma.id
               WHERE mm.is_active = true`;
    const params: any[] = [];

    if (dma_id) {
      sql += ` AND (mm.inflow_dma_id = $1 OR mm.outflow_dma_id = $1)`;
      params.push(dma_id);
    }
    sql += ' ORDER BY mm.serial_no';

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load master meters' });
  }
});

// Create master meter
router.post('/master-meters', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      serial_no, location, meter_size, meter_status,
      install_date, northings, eastings, height,
      inflow_dma_id, outflow_dma_id
    } = req.body;

    const result = await queryOne(
      `INSERT INTO master_meters (serial_no, location, meter_size, meter_status, install_date,
       northings, eastings, height, inflow_dma_id, outflow_dma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [serial_no, location, meter_size, meter_status, install_date,
       northings, eastings, height, inflow_dma_id, outflow_dma_id]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to create master meter' });
  }
});

// Update master meter
router.put('/master-meters/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      serial_no, location, meter_size, meter_status,
      install_date, northings, eastings, height,
      inflow_dma_id, outflow_dma_id, is_active
    } = req.body;

    const result = await queryOne(
      `UPDATE master_meters SET serial_no = $1, location = $2, meter_size = $3, meter_status = $4,
       install_date = $5, northings = $6, eastings = $7, height = $8,
       inflow_dma_id = $9, outflow_dma_id = $10, is_active = COALESCE($11, is_active)
       WHERE id = $12 RETURNING *`,
      [serial_no, location, meter_size, meter_status, install_date,
       northings, eastings, height, inflow_dma_id, outflow_dma_id, is_active, id]
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to update master meter' });
  }
});

// Delete master meter (soft delete)
router.delete('/master-meters/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne(
      'UPDATE master_meters SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete master meter' });
  }
});

// ==================== NRW READINGS ====================

// Get NRW readings
router.get('/readings', verifyToken, async (req: Request, res: Response) => {
  try {
    const { dma_id, billing_period_id } = req.query;

    let sql = `SELECT nr.*, mm.serial_no, mm.location,
                      COALESCE(u.first_name, '') || ' ' || COALESCE(u.other_names, '') as reader_name,
                      nr.current_reading - nr.previous_reading as consumption,
                      LAG(nr.reading_date) OVER (PARTITION BY nr.master_meter_id ORDER BY nr.reading_date) as prev_reading_date
               FROM nrw_readings nr
               JOIN master_meters mm ON nr.master_meter_id = mm.id
               LEFT JOIN users u ON nr.reader_id = u.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (dma_id) {
      paramCount++;
      sql += ` AND (mm.inflow_dma_id = $${paramCount} OR mm.outflow_dma_id = $${paramCount})`;
      params.push(dma_id);
    }
    if (billing_period_id) {
      paramCount++;
      sql += ` AND nr.billing_period_id = $${paramCount}`;
      params.push(billing_period_id);
    }

    sql += ' ORDER BY nr.reading_date DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load NRW readings' });
  }
});

// Create NRW reading
router.post('/readings', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      master_meter_id, billing_period_id, reading_date,
      current_reading, previous_reading, reader_id, comments
    } = req.body;

    const result = await queryOne(
      `INSERT INTO nrw_readings (master_meter_id, billing_period_id, reading_date,
       current_reading, previous_reading, reader_id, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [master_meter_id, billing_period_id, reading_date, current_reading, previous_reading, reader_id, comments]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create NRW reading error:', error);
    res.status(500).json({ success: false, message: 'Failed to create NRW reading' });
  }
});

// ==================== LINK CUSTOMERS TO DMA ====================

// Get customers by DMA
router.get('/customers/:dmaId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { dmaId } = req.params;
    const customers = await query(
      `SELECT c.id, c.account_no, c.name, c.balance, m.meter_no
       FROM customers c
       LEFT JOIN meters m ON c.id = m.customer_id
       WHERE c.dma_id = $1 AND c.account_status = 'active'
       ORDER BY c.account_no`,
      [dmaId]
    );
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load DMA customers' });
  }
});

// Assign customer to DMA
router.post('/assign-customer', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, dma_id } = req.body;
    const result = await queryOne(
      'UPDATE customers SET dma_id = $1 WHERE id = $2 RETURNING *',
      [dma_id, customer_id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign customer to DMA' });
  }
});

// ==================== NRW REPORTS ====================

// NRW summary by DMA
router.get('/report/summary', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_period_id } = req.query;

    let sql = `
      SELECT 
        dr.id,
        dr.code,
        dr.name,
        COUNT(DISTINCT c.id) as total_connections,
        COALESCE(SUM(nr.current_reading - nr.previous_reading), 0) as dma_input,
        COALESCE(SUM(b.consumption), 0) as billed_consumption,
        COALESCE(SUM(nr.current_reading - nr.previous_reading), 0) - 
          COALESCE(SUM(b.consumption), 0) as nrw_volume,
        CASE WHEN COALESCE(SUM(nr.current_reading - nr.previous_reading), 0) > 0 
          THEN ROUND(((COALESCE(SUM(nr.current_reading - nr.previous_reading), 0) - 
            COALESCE(SUM(b.consumption), 0)) / 
            SUM(nr.current_reading - nr.previous_reading)) * 100, 2)
          ELSE 0 
        END as nrw_percentage
      FROM dma_regions dr
      LEFT JOIN customers c ON c.dma_id = dr.id AND c.account_status = 'active'
      LEFT JOIN bills b ON c.id = b.customer_id
      LEFT JOIN master_meters mm ON mm.inflow_dma_id = dr.id
      LEFT JOIN nrw_readings nr ON mm.id = nr.master_meter_id
    `;

    const params: any[] = [];
    if (billing_period_id) {
      sql += ' WHERE nr.billing_period_id = $1 OR nr.billing_period_id IS NULL';
      params.push(billing_period_id);
    }

    sql += ` GROUP BY dr.id, dr.code, dr.name ORDER BY dr.code`;

    const result = await query(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('NRW summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate NRW summary' });
  }
});

export default router;
