import express, { Request, Response } from 'express';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Get all tariff categories
router.get('/categories', verifyToken, async (req: Request, res: Response) => {
  try {
    const categories = await query('SELECT * FROM tariff_categories WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load tariff categories' });
  }
});

// Create tariff category
router.post('/categories', verifyToken, async (req: Request, res: Response) => {
  try {
    const { code, name, description } = req.body;
    const result = await queryOne(
      'INSERT INTO tariff_categories (code, name, description) VALUES ($1, $2, $3) RETURNING *',
      [code, name, description]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tariff category' });
  }
});

// Update tariff category
router.put('/categories/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, description, is_active } = req.body;
    const result = await queryOne(
      'UPDATE tariff_categories SET code = $1, name = $2, description = $3, is_active = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [code, name, description, is_active !== undefined ? is_active : true, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Failed to update tariff category' });
  }
});

// Deactivate tariff category
router.delete('/categories/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queryOne('UPDATE tariff_categories SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Tariff category deactivated' });
  } catch (error) {
    console.error('Deactivate category error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate tariff category' });
  }
});

// Get tariff lines for a category
router.get('/lines/:categoryId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const lines = await query(
      `SELECT * FROM tariff_lines 
       WHERE tariff_category_id = $1 
       AND is_active = true
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY min_units`,
      [categoryId]
    );
    res.json({ success: true, data: lines });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load tariff lines' });
  }
});

// Create tariff line
router.post('/lines', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      tariff_category_id, min_units, max_units, rate,
      fixed_charge, effective_from, effective_to
    } = req.body;

    const result = await queryOne(
      `INSERT INTO tariff_lines (tariff_category_id, min_units, max_units, rate, fixed_charge, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tariff_category_id, min_units, max_units, rate, fixed_charge, effective_from, effective_to]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create tariff line error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tariff line' });
  }
});

// Update tariff line
router.put('/lines/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { min_units, max_units, rate, fixed_charge, effective_to } = req.body;

    const result = await queryOne(
      `UPDATE tariff_lines 
       SET min_units = $1, max_units = $2, rate = $3, fixed_charge = $4, effective_to = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [min_units, max_units, rate, fixed_charge, effective_to, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update tariff line error:', error);
    res.status(500).json({ success: false, message: 'Failed to update tariff line' });
  }
});

// Deactivate tariff line
router.delete('/lines/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queryOne('UPDATE tariff_lines SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Tariff line deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to deactivate tariff line' });
  }
});

// Duplicate tariff to new effective date
router.post('/duplicate', verifyToken, async (req: Request, res: Response) => {
  try {
    const { from_category_id, new_effective_from } = req.body;
    const createdBy = (req as any).user?.id;

    // Get existing active lines
    const existingLines = await query(
      `SELECT * FROM tariff_lines 
       WHERE tariff_category_id = $1 AND is_active = true
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY min_units`,
      [from_category_id]
    );

    if (existingLines.length === 0) {
      return res.status(404).json({ success: false, message: 'No active tariff lines found' });
    }

    // Deactivate old lines by setting effective_to
    await query(
      'UPDATE tariff_lines SET effective_to = $1 WHERE tariff_category_id = $2 AND is_active = true AND effective_to IS NULL',
      [new Date(new_effective_from).toISOString().split('T')[0], from_category_id]
    );

    // Insert new lines with new effective date
    const insertedLines = [];
    for (const line of existingLines) {
      const result = await queryOne(
        `INSERT INTO tariff_lines (tariff_category_id, min_units, max_units, rate, fixed_charge, effective_from, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [from_category_id, line.min_units, line.max_units, line.rate, line.fixed_charge, new_effective_from, createdBy]
      );
      insertedLines.push(result);
    }

    res.status(201).json({ success: true, data: insertedLines });
  } catch (error) {
    console.error('Duplicate tariff error:', error);
    res.status(500).json({ success: false, message: 'Failed to duplicate tariff' });
  }
});

// Assign tariff category to customer
router.post('/assign', verifyToken, async (req: Request, res: Response) => {
  try {
    const { customer_id, tariff_category_id } = req.body;
    const result = await queryOne(
      'UPDATE customers SET tariff_category_id = $1 WHERE id = $2 RETURNING *',
      [tariff_category_id, customer_id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign tariff' });
  }
});

export default router;
