import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Generic CRUD for lookup tables
const lookupTables: Record<string, string> = {
  'billing-groups': 'billing_groups',
  'billing-routes': 'billing_routes',
  'zones': 'zones',
  'customer-categories': 'customer_categories',
  'customer-typologies': 'customer_typologies',
  'payment-modes': 'payment_modes',
  'reading-codes': 'reading_codes',
  'disconnection-profiles': 'disconnection_profiles',
  'departments': 'departments',
  'meter-types': 'meter_types',
  'financial-periods': 'financial_periods',
};

// Get all records for a lookup table
router.get('/:table', verifyToken, async (req: Request, res: Response) => {
  try {
    const { table } = req.params;
    const dbTable = lookupTables[table];
    if (!dbTable) {
      return res.status(400).json({ success: false, message: 'Unknown table' });
    }

    const records = await query(`SELECT * FROM ${dbTable} ORDER BY name, code`);
    res.json({ success: true, data: records });
  } catch (error) {
    console.error(`Parameters list error for ${req.params.table}:`, error);
    res.status(500).json({ success: false, message: 'Failed to load records' });
  }
});

// Get single record
router.get('/:table/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    const dbTable = lookupTables[table];
    if (!dbTable) {
      return res.status(400).json({ success: false, message: 'Unknown table' });
    }

    const record = await queryOne(`SELECT * FROM ${dbTable} WHERE id = $1`, [id]);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load record' });
  }
});

// Create record (generic)
router.post('/:table', verifyToken, async (req: Request, res: Response) => {
  try {
    const { table } = req.params;
    const dbTable = lookupTables[table];
    if (!dbTable) {
      return res.status(400).json({ success: false, message: 'Unknown table' });
    }

    const data = req.body;
    const fields = Object.keys(data).filter(k => k !== 'id');
    const values = fields.map(f => data[f]);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const result = await queryOne(
      `INSERT INTO ${dbTable} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error(`Create error for ${req.params.table}:`, error);
    res.status(500).json({ success: false, message: 'Failed to create record' });
  }
});

// Update record (generic)
router.put('/:table/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    const dbTable = lookupTables[table];
    if (!dbTable) {
      return res.status(400).json({ success: false, message: 'Unknown table' });
    }

    const data = req.body;
    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
    const values = fields.map(f => data[f]);
    values.push(id);

    const result = await queryOne(
      `UPDATE ${dbTable} SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`Update error for ${req.params.table}:`, error);
    res.status(500).json({ success: false, message: 'Failed to update record' });
  }
});

// Delete / Deactivate record
router.delete('/:table/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    const dbTable = lookupTables[table];
    if (!dbTable) {
      return res.status(400).json({ success: false, message: 'Unknown table' });
    }

    // Try soft delete first
    try {
      await queryOne(`UPDATE ${dbTable} SET is_active = false WHERE id = $1`, [id]);
      res.json({ success: true, message: 'Record deactivated' });
    } catch {
      // If no is_active column, do hard delete
      await queryOne(`DELETE FROM ${dbTable} WHERE id = $1`, [id]);
      res.json({ success: true, message: 'Record deleted' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete record' });
  }
});

// System settings
router.get('/settings/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

router.put('/settings/:key', verifyToken, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { setting_value } = req.body;
    const result = await queryOne(
      'UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2 RETURNING *',
      [setting_value, key]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

export default router;
