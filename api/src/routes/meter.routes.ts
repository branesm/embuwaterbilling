import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Get all meters with filters
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const { status, customer_id, meter_type_id, q, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT m.*, mt.type_id as meter_type_name, c.name as customer_name, c.account_no
               FROM meters m
               LEFT JOIN meter_types mt ON m.meter_type_id = mt.id
               LEFT JOIN customers c ON m.customer_id = c.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (q) {
      paramCount++;
      sql += ` AND (m.meter_no ILIKE $${paramCount} OR m.barcode_no ILIKE $${paramCount} OR c.name ILIKE $${paramCount} OR c.account_no ILIKE $${paramCount})`;
      params.push(`%${q}%`);
    }
    if (status) {
      paramCount++;
      sql += ` AND m.meter_status = $${paramCount}`;
      params.push(status);
    }
    if (customer_id) {
      paramCount++;
      sql += ` AND m.customer_id = $${paramCount}`;
      params.push(customer_id);
    }
    if (meter_type_id) {
      paramCount++;
      sql += ` AND m.meter_type_id = $${paramCount}`;
      params.push(meter_type_id);
    }

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`,
      params
    );

    paramCount++;
    sql += ` ORDER BY m.meter_no LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const meters = await query(sql, params);

    res.json({
      success: true,
      data: meters,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0'),
        pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Meter list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load meters' });
  }
});

// Create meter
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      meter_no, meter_type_id, meter_location, customer_id,
      install_date, barcode_no, digits, max_reading, condition, supplier, manufacture_date, expected_years, comments
    } = req.body;

    const result = await queryOne<any>(
      `INSERT INTO meters (meter_no, meter_type_id, meter_location, customer_id,
       install_date, barcode_no, digits, max_reading, condition, supplier, manufacture_date, expected_years, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [meter_no, meter_type_id, meter_location, customer_id,
       install_date, barcode_no, digits || 6, max_reading, condition, supplier, manufacture_date, expected_years, comments]
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to create meter' });
  }
});

// ==================== STATS DASHBOARD ====================

router.get('/stats/dashboard', verifyToken, async (req: Request, res: Response) => {
  try {
    const totalResult = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM meters');
    const activeResult = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM meters WHERE meter_status = 'active'");
    const faultyResult = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM meters WHERE meter_status = 'faulty'");
    const storeResult = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM meters WHERE meter_status = 'in_store'");
    const byType = await query(
      `SELECT mt.type_id as name, COUNT(*) as count FROM meters m
       JOIN meter_types mt ON m.meter_type_id = mt.id GROUP BY mt.type_id`
    );
    const byStatus = await query(
      `SELECT meter_status as status, COUNT(*) as count FROM meters GROUP BY meter_status`
    );

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult?.count || '0'),
        active: parseInt(activeResult?.count || '0'),
        faulty: parseInt(faultyResult?.count || '0'),
        in_store: parseInt(storeResult?.count || '0'),
        by_type: byType,
        by_status: byStatus
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// ==================== METER TYPES CRUD ====================

router.get('/types/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const types = await query('SELECT * FROM meter_types WHERE is_active = true ORDER BY type_id');
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load meter types' });
  }
});

router.get('/types', verifyToken, async (req: Request, res: Response) => {
  try {
    const types = await query('SELECT * FROM meter_types ORDER BY id DESC');
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load meter types' });
  }
});

router.post('/types', verifyToken, async (req: Request, res: Response) => {
  try {
    const { type_id, manufacturer, category, model, meter_size, normal_consumption, number_of_digits, tariff_for_rent, rent_value, expected_years } = req.body;
    const result = await queryOne(
      `INSERT INTO meter_types (type_id, manufacturer, category, model, meter_size, normal_consumption, number_of_digits, tariff_for_rent, rent_value, expected_years)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [type_id, manufacturer, category, model, meter_size, normal_consumption, number_of_digits || 6, tariff_for_rent, rent_value || 0, expected_years]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create type error:', error);
    res.status(500).json({ success: false, message: 'Failed to create meter type' });
  }
});

router.put('/types/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'type_id', 'manufacturer', 'category', 'model', 'meter_size',
      'normal_consumption', 'number_of_digits', 'tariff_for_rent',
      'rent_value', 'expected_years', 'is_active'
    ];
    const columns = Object.keys(req.body).filter(k => allowedFields.includes(k));
    if (columns.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    const values = columns.map(k => req.body[k]);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    values.push(id);
    const result = await queryOne(
      `UPDATE meter_types SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update type error:', error);
    res.status(500).json({ success: false, message: 'Failed to update meter type' });
  }
});

router.delete('/types/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM meter_types WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete type error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete meter type' });
  }
});

// ==================== MASTER METERS CRUD ====================

router.get('/master-meters', verifyToken, async (req: Request, res: Response) => {
  try {
    const mm = await query(
      `SELECT mm.*, d_in.name as inflow_dma_name, d_out.name as outflow_dma_name
       FROM master_meters mm
       LEFT JOIN dma_regions d_in ON mm.inflow_dma_id = d_in.id
       LEFT JOIN dma_regions d_out ON mm.outflow_dma_id = d_out.id
       ORDER BY mm.serial_no`
    );
    res.json({ success: true, data: mm });
  } catch (error) {
    console.error('Master meters error:', error);
    res.status(500).json({ success: false, message: 'Failed to load master meters' });
  }
});

router.post('/master-meters', verifyToken, async (req: Request, res: Response) => {
  try {
    const { serial_no, location, meter_size, install_date, northings, eastings, height, inflow_dma_id, outflow_dma_id } = req.body;
    const result = await queryOne(
      `INSERT INTO master_meters (serial_no, location, meter_size, install_date, northings, eastings, height, inflow_dma_id, outflow_dma_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [serial_no, location, meter_size, install_date, northings, eastings, height, inflow_dma_id, outflow_dma_id]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to create master meter' });
  }
});

router.put('/master-meters/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'serial_no', 'location', 'meter_size', 'meter_status', 'install_date',
      'northings', 'eastings', 'height', 'inflow_dma_id', 'outflow_dma_id',
      'current_reading', 'is_active'
    ];
    const columns = Object.keys(req.body).filter(k => allowedFields.includes(k));
    if (columns.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }
    const values = columns.map(k => req.body[k]);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    values.push(id);
    const result = await queryOne(
      `UPDATE master_meters SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to update master meter' });
  }
});

router.delete('/master-meters/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM master_meters WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete master meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete master meter' });
  }
});

// ==================== DMA REGIONS ====================

router.get('/dma-regions', verifyToken, async (req: Request, res: Response) => {
  try {
    const regions = await query('SELECT * FROM dma_regions WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('DMA regions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load DMA regions' });
  }
});

// ==================== PARAMETER ROUTES (must be after all specific paths) ====================

// Get single meter with details
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const meter = await queryOne(
      `SELECT m.*, mt.type_id as meter_type_name, c.name as customer_name, c.account_no
       FROM meters m
       LEFT JOIN meter_types mt ON m.meter_type_id = mt.id
       LEFT JOIN customers c ON m.customer_id = c.id
       WHERE m.id = $1`,
      [id]
    );
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }
    res.json({ success: true, data: meter });
  } catch (error) {
    console.error('Get meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to load meter' });
  }
});

// Update meter
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'meter_no', 'meter_type_id', 'meter_location', 'customer_id',
      'meter_status', 'install_date', 'barcode_no', 'digits',
      'max_reading', 'current_reading', 'condition', 'comments'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        paramCount++;
        setClauses.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    paramCount++;
    values.push(id);

    const result = await queryOne<any>(
      `UPDATE meters SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update meter error:', error);
    res.status(500).json({ success: false, message: 'Failed to update meter' });
  }
});

// Get meter movements
router.get('/:id/movements', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const movements = await query(
      `SELECT mm.*, fc.name as from_customer_name, tc.name as to_customer_name, u.username as performed_by_name
       FROM meter_movements mm
       LEFT JOIN customers fc ON mm.from_customer_id = fc.id
       LEFT JOIN customers tc ON mm.to_customer_id = tc.id
       LEFT JOIN users u ON mm.performed_by = u.id
       WHERE mm.meter_id = $1 ORDER BY mm.movement_date DESC`,
      [id]
    );
    res.json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load movements' });
  }
});

// Record meter movement
router.post('/:id/movement', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { movement_type, to_customer_id, to_status, reference_no, comments } = req.body;
    const userId = (req as any).user?.id;

    const meter = await queryOne<any>('SELECT * FROM meters WHERE id = $1', [id]);
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO meter_movements (meter_id, movement_type, from_customer_id, to_customer_id,
         from_status, to_status, performed_by, reference_no, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, movement_type, meter.customer_id, to_customer_id, meter.meter_status, to_status, userId, reference_no, comments]
      );

      if (to_customer_id !== undefined || to_status) {
        await client.query(
          'UPDATE meters SET customer_id = $1, meter_status = $2 WHERE id = $3',
          [to_customer_id, to_status || meter.meter_status, id]
        );
      }
    });

    res.json({ success: true, message: 'Movement recorded' });
  } catch (error) {
    console.error('Meter movement error:', error);
    res.status(500).json({ success: false, message: 'Failed to record movement' });
  }
});

// Get meter servicing history
router.get('/:id/servicing', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const servicing = await query(
      `SELECT ms.*, c.name as customer_name, u.username as serviced_by_name
       FROM meter_servicing ms
       LEFT JOIN customers c ON ms.customer_id = c.id
       LEFT JOIN users u ON ms.serviced_by = u.id
       WHERE ms.meter_id = $1 ORDER BY ms.service_date DESC`,
      [id]
    );
    res.json({ success: true, data: servicing });
  } catch (error) {
    console.error('Servicing history error:', error);
    res.status(500).json({ success: false, message: 'Failed to load servicing history' });
  }
});

// Record meter servicing
router.post('/:id/servicing', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reading, service_date, meter_status, comments } = req.body;
    const userId = (req as any).user?.id;

    const meter = await queryOne<any>('SELECT customer_id FROM meters WHERE id = $1', [id]);
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO meter_servicing (meter_id, customer_id, serviced_by, reading, service_date, meter_status, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, meter.customer_id, userId, reading, service_date, meter_status, comments]
      );

      if (meter_status) {
        await client.query('UPDATE meters SET meter_status = $1 WHERE id = $2', [meter_status, id]);
      }

      return inserted.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Servicing error:', error);
    res.status(500).json({ success: false, message: 'Failed to record servicing' });
  }
});

// Record meter replacement
router.post('/:id/replace', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_meter_id, old_final_reading, new_initial_reading, reason, replacement_date } = req.body;
    const userId = (req as any).user?.id;

    const meter = await queryOne<any>('SELECT customer_id, meter_status FROM meters WHERE id = $1', [id]);
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO meter_replacements (old_meter_id, new_meter_id, customer_id, replacement_date, old_final_reading, new_initial_reading, reason, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, new_meter_id, meter.customer_id, replacement_date, old_final_reading, new_initial_reading || 0, reason, userId]
      );

      await client.query(
        "UPDATE meters SET meter_status = 'removed', current_reading = $1 WHERE id = $2",
        [old_final_reading, id]
      );

      if (new_meter_id) {
        await client.query(
          'UPDATE meters SET customer_id = $1, meter_status = $2, current_reading = $3, install_date = $4 WHERE id = $5',
          [meter.customer_id, 'active', new_initial_reading || 0, replacement_date, new_meter_id]
        );
      }
    });

    res.json({ success: true, message: 'Replacement recorded' });
  } catch (error) {
    console.error('Replacement error:', error);
    res.status(500).json({ success: false, message: 'Failed to record replacement' });
  }
});

// Get meter replacements
router.get('/:id/replacements', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const replacements = await query(
      `SELECT mr.*, nm.meter_no as new_meter_no, c.name as customer_name, u.username as performed_by_name
       FROM meter_replacements mr
       LEFT JOIN meters nm ON mr.new_meter_id = nm.id
       LEFT JOIN customers c ON mr.customer_id = c.id
       LEFT JOIN users u ON mr.performed_by = u.id
       WHERE mr.old_meter_id = $1 OR mr.new_meter_id = $1
       ORDER BY mr.replacement_date DESC`,
      [id]
    );
    res.json({ success: true, data: replacements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load replacements' });
  }
});

export default router;
