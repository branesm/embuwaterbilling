import express, { Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
});

const documentUpload = upload.fields([
  { name: 'id_copy', maxCount: 1 },
  { name: 'kra_pin_certificate', maxCount: 1 },
  { name: 'plot_copy_or_letter', maxCount: 1 }
]);

// Search customers
router.get('/search', verifyToken, async (req: Request, res: Response) => {
  try {
    const { q, status, billing_group_id, zone_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `SELECT c.*, 
               cc.name as category_name,
               bg.name as billing_group_name,
               z.name as zone_name
               FROM customers c
               LEFT JOIN customer_categories cc ON c.category_id = cc.id
               LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
               LEFT JOIN zones z ON c.zone_id = z.id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (q) {
      paramCount++;
      sql += ` AND (c.name ILIKE $${paramCount} OR c.account_no ILIKE $${paramCount} OR c.telephone ILIKE $${paramCount} OR c.national_id ILIKE $${paramCount} OR c.kra_pin ILIKE $${paramCount})`;
      params.push(`%${q}%`);
    }
    if (status) {
      paramCount++;
      sql += ` AND c.account_status = $${paramCount}`;
      params.push(status);
    }
    if (billing_group_id) {
      paramCount++;
      sql += ` AND c.billing_group_id = $${paramCount}`;
      params.push(billing_group_id);
    }
    if (zone_id) {
      paramCount++;
      sql += ` AND c.zone_id = $${paramCount}`;
      params.push(zone_id);
    }

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM (${sql}) as sub`,
      params
    );

    paramCount++;
    sql += ` ORDER BY c.name LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(offset);

    const customers = await query(sql, params);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.total || '0'),
        pages: Math.ceil(parseInt(countResult?.total || '0') / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Check for duplicate customers
router.post('/check-duplicates', verifyToken, async (req: Request, res: Response) => {
  try {
    const { national_id, plot_no, kra_pin } = req.body;
    const duplicates: Array<{ field: string; value: string; customer: any }> = [];

    if (national_id) {
      const existing = await queryOne<any>(
        'SELECT id, account_no, name FROM customers WHERE national_id = $1',
        [national_id]
      );
      if (existing) duplicates.push({ field: 'national_id', value: national_id, customer: existing });
    }

    if (plot_no) {
      const existing = await queryOne<any>(
        'SELECT id, account_no, name FROM customers WHERE plot_no = $1',
        [plot_no]
      );
      if (existing) duplicates.push({ field: 'plot_no', value: plot_no, customer: existing });
    }

    if (kra_pin) {
      const existing = await queryOne<any>(
        'SELECT id, account_no, name FROM customers WHERE kra_pin = $1',
        [kra_pin]
      );
      if (existing) duplicates.push({ field: 'kra_pin', value: kra_pin, customer: existing });
    }

    res.json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      duplicates
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({ success: false, message: 'Duplicate check failed' });
  }
});

// Lookup endpoints
router.get('/lookup/customer-types', verifyToken, async (req: Request, res: Response) => {
  try {
    const types = await query('SELECT * FROM customer_types WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Customer types error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer types' });
  }
});

router.get('/lookup/companies', verifyToken, async (req: Request, res: Response) => {
  try {
    const companies = await query('SELECT * FROM companies WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error('Companies error:', error);
    res.status(500).json({ success: false, message: 'Failed to load companies' });
  }
});

router.get('/lookup/bill-dispatch-methods', verifyToken, async (req: Request, res: Response) => {
  try {
    const methods = await query('SELECT * FROM bill_dispatch_methods WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: methods });
  } catch (error) {
    console.error('Bill dispatch methods error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bill dispatch methods' });
  }
});

// List inactive customers
router.get('/status/inactive', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_group_id, zone_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    let where = "WHERE c.account_status = 'inactive'";
    const params: any[] = [];
    if (billing_group_id) { where += ` AND c.billing_group_id = $${params.length + 1}`; params.push(billing_group_id); }
    if (zone_id) { where += ` AND c.zone_id = $${params.length + 1}`; params.push(zone_id); }
    const countResult = await queryOne<any>(`SELECT COUNT(*) as total FROM customers c ${where}`, params);
    const data = await query(
      `SELECT c.*, bg.name as billing_group_name, z.name as zone_name FROM customers c
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       LEFT JOIN zones z ON c.zone_id = z.id
       ${where} ORDER BY c.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), offset]
    );
    res.json({ success: true, data, total: parseInt(countResult?.total || '0') });
  } catch (error) {
    console.error('Inactive customers error:', error);
    res.status(500).json({ success: false, message: 'Failed to load inactive customers' });
  }
});

// List pending applications
router.get('/status/pending', verifyToken, async (req: Request, res: Response) => {
  try {
    const { billing_group_id, zone_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    let where = "WHERE c.account_status = 'pending'";
    const params: any[] = [];
    if (billing_group_id) { where += ` AND c.billing_group_id = $${params.length + 1}`; params.push(billing_group_id); }
    if (zone_id) { where += ` AND c.zone_id = $${params.length + 1}`; params.push(zone_id); }
    const countResult = await queryOne<any>(`SELECT COUNT(*) as total FROM customers c ${where}`, params);
    const data = await query(
      `SELECT c.*, bg.name as billing_group_name, z.name as zone_name FROM customers c
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       LEFT JOIN zones z ON c.zone_id = z.id
       ${where} ORDER BY c.application_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), offset]
    );
    res.json({ success: true, data, total: parseInt(countResult?.total || '0') });
  } catch (error) {
    console.error('Pending customers error:', error);
    res.status(500).json({ success: false, message: 'Failed to load pending applications' });
  }
});

// Get customer by ID with full details
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await queryOne<any>(
      `SELECT c.*,
       cc.name as category_name,
       bg.name as billing_group_name,
       z.name as zone_name,
       t.name as typology_name,
       ct.name as customer_type_name,
       comp.name as company_name,
       bdm.name as bill_dispatch_method_name,
       dp.name as disconnection_profile_name,
       u.username as status_changed_by_name
       FROM customers c
       LEFT JOIN customer_categories cc ON c.category_id = cc.id
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       LEFT JOIN zones z ON c.zone_id = z.id
       LEFT JOIN customer_typologies t ON c.typology_id = t.id
       LEFT JOIN customer_types ct ON c.customer_type_id = ct.id
       LEFT JOIN companies comp ON c.company_id = comp.id
       LEFT JOIN bill_dispatch_methods bdm ON c.bill_dispatch_method_id = bdm.id
       LEFT JOIN disconnection_profiles dp ON c.disconnection_profile_id = dp.id
       LEFT JOIN users u ON c.status_changed_by = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get meter
    const meters = await query('SELECT * FROM meters WHERE customer_id = $1', [id]);
    // Get recent bills
    const bills = await query('SELECT * FROM bills WHERE customer_id = $1 ORDER BY bill_date DESC LIMIT 10', [id]);
    // Get recent payments
    const payments = await query('SELECT * FROM payments WHERE customer_id = $1 ORDER BY payment_date DESC LIMIT 10', [id]);
    // Get contract history
    const history = await query('SELECT * FROM contract_history WHERE customer_id = $1 ORDER BY created_at DESC', [id]);
    // Get documents
    const documents = await query('SELECT * FROM customer_documents WHERE customer_id = $1 ORDER BY created_at DESC', [id]);
    // Get status history
    const statusHistory = await query(
      `SELECT h.*, u.username as changed_by_name FROM customer_status_history h
       LEFT JOIN users u ON h.changed_by = u.id WHERE h.customer_id = $1 ORDER BY h.created_at DESC`, [id]
    );
    // Get connection payments
    const connectionPayments = await query('SELECT * FROM connection_payments WHERE customer_id = $1 ORDER BY created_at DESC', [id]);
    // Get terminations
    const terminations = await query(
      `SELECT t.*, u.username as processed_by_name FROM customer_terminations t
       LEFT JOIN users u ON t.processed_by = u.id WHERE t.customer_id = $1 ORDER BY t.created_at DESC`, [id]
    );

    res.json({
      success: true,
      data: {
        ...customer,
        meters,
        bills,
        payments,
        history,
        documents,
        statusHistory,
        connectionPayments,
        terminations
      }
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer' });
  }
});

// Create customer with documents
router.post('/', verifyToken, requirePermission('customers', 'create'), documentUpload, async (req: Request, res: Response) => {
  try {
    const {
      account_no, conn_no, name, first_name, last_name, national_id, kra_pin,
      category_id, typology_id, billing_group_id, route_id,
      walk_no, zone_id, address, town, po_box, plot_no,
      telephone, email, dma_id, deposit_amount,
      customer_type_id, landlord_name, house_no, estate, application_date,
      employer_cert, comments, charge_refuse, company_id,
      connected_to_sewer, managed_by_ewasco, latitude, longitude,
      bill_dispatch_method_id, disconnection_profile_id
    } = req.body;

    // Check for duplicates
    const duplicateChecks: Array<{ field: string; value: string }> = [];
    if (national_id) duplicateChecks.push({ field: 'national_id', value: national_id });
    if (plot_no) duplicateChecks.push({ field: 'plot_no', value: plot_no });
    if (kra_pin) duplicateChecks.push({ field: 'kra_pin', value: kra_pin });

    for (const check of duplicateChecks) {
      const existing = await queryOne<any>(
        `SELECT id, account_no, name FROM customers WHERE ${check.field} = $1`,
        [check.value]
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `A customer with this ${check.field.replace('_', ' ')} already exists`,
          duplicate: { field: check.field, customer: existing }
        });
      }
    }

    // Validate mandatory documents
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const missingDocs: string[] = [];
    if (!files?.id_copy) missingDocs.push('ID Copy');
    if (!files?.kra_pin_certificate) missingDocs.push('KRA PIN Certificate');
    if (!files?.plot_copy_or_letter) missingDocs.push('Plot Copy or Letter');

    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing mandatory documents: ${missingDocs.join(', ')}`
      });
    }

    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const customerResult = await client.query(
        `INSERT INTO customers (account_no, conn_no, name, first_name, last_name, national_id, kra_pin,
         category_id, typology_id, billing_group_id, route_id, walk_no, zone_id,
         address, town, po_box, plot_no, telephone, email, dma_id, deposit_amount,
         customer_type_id, landlord_name, house_no, estate, application_date,
         employer_cert, comments, charge_refuse, company_id,
         connected_to_sewer, managed_by_ewasco, latitude, longitude,
         bill_dispatch_method_id, disconnection_profile_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
         $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
         RETURNING *`,
        [account_no, conn_no, name, first_name, last_name, national_id, kra_pin,
         category_id, typology_id, billing_group_id, route_id,
         walk_no, zone_id, address, town, po_box, plot_no,
         telephone, email, dma_id, deposit_amount || 0,
         customer_type_id, landlord_name, house_no, estate, application_date,
         employer_cert, comments, charge_refuse, company_id,
         connected_to_sewer, managed_by_ewasco, latitude, longitude,
         bill_dispatch_method_id, disconnection_profile_id]
      );

      const customer = customerResult.rows[0];

      // Save documents
      const docTypes: Array<{ field: string; type: string }> = [
        { field: 'id_copy', type: 'id_copy' },
        { field: 'kra_pin_certificate', type: 'kra_pin_certificate' },
        { field: 'plot_copy_or_letter', type: 'plot_copy_or_letter' }
      ];

      for (const doc of docTypes) {
        const fileArray = files[doc.field];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          await client.query(
            `INSERT INTO customer_documents (customer_id, document_type, file_name, file_path, mime_type, file_size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [customer.id, doc.type, file.originalname, file.filename, file.mimetype, file.size, userId]
          );
        }
      }

      return customer;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

// Upload documents for existing customer
router.post('/:id/documents', verifyToken, documentUpload, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = $1', [id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const docTypes: Array<{ field: string; type: string }> = [
      { field: 'id_copy', type: 'id_copy' },
      { field: 'kra_pin_certificate', type: 'kra_pin_certificate' },
      { field: 'plot_copy_or_letter', type: 'plot_copy_or_letter' }
    ];

    const uploadedDocs: any[] = [];

    for (const doc of docTypes) {
      const fileArray = files[doc.field];
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const result = await queryOne(
          `INSERT INTO customer_documents (customer_id, document_type, file_name, file_path, mime_type, file_size, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [id, doc.type, file.originalname, file.filename, file.mimetype, file.size, userId]
        );
        uploadedDocs.push(result);
      }
    }

    res.status(201).json({ success: true, data: uploadedDocs });
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload documents' });
  }
});

// Get customer documents
router.get('/:id/documents', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const documents = await query(
      `SELECT cd.*, u.username as uploaded_by_name
       FROM customer_documents cd
       LEFT JOIN users u ON cd.uploaded_by = u.id
       WHERE cd.customer_id = $1 ORDER BY cd.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to load documents' });
  }
});

// Update customer
router.put('/:id', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'name', 'first_name', 'last_name', 'national_id', 'kra_pin', 'category_id',
      'typology_id', 'billing_group_id', 'route_id', 'walk_no', 'zone_id',
      'address', 'town', 'po_box', 'plot_no', 'telephone', 'email',
      'dma_id', 'account_status', 'deposit_amount',
      'customer_type_id', 'landlord_name', 'house_no', 'estate', 'application_date',
      'employer_cert', 'comments', 'charge_refuse', 'company_id',
      'connected_to_sewer', 'managed_by_ewasco', 'latitude', 'longitude',
      'bill_dispatch_method_id', 'disconnection_profile_id', 'conn_no'
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
      `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
});

// Activate customer account
router.put('/:id/activate', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { connection_fee, deposit_amount, receipt_no, fee_receipt_no, deposit_receipt_no, fee_date, deposit_date, comments } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const prev = await client.query('SELECT account_status FROM customers WHERE id = $1', [id]);
      if (prev.rows.length === 0) throw new Error('Customer not found');
      const previousStatus = prev.rows[0].account_status;

      const updated = await client.query(
        `UPDATE customers SET account_status = 'active', status_reason = $1, status_reference = $2,
         status_changed_by = $3, status_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 RETURNING *`,
        [comments, receipt_no, userId, id]
      );

      await client.query(
        `INSERT INTO customer_status_history (customer_id, previous_status, new_status, reason, reference, changed_by)
         VALUES ($1, $2, 'active', $3, $4, $5)`,
        [id, previousStatus, comments, receipt_no, userId]
      );

      if (connection_fee && parseFloat(connection_fee) > 0) {
        await client.query(
          `INSERT INTO connection_payments (customer_id, payment_type, amount, receipt_no, payment_date, fee_date, comments, processed_by)
           VALUES ($1, 'connection_fee', $2, $3, CURRENT_DATE, $4, $5, $6)`,
          [id, connection_fee, fee_receipt_no || receipt_no, fee_date, comments, userId]
        );
      }
      if (deposit_amount && parseFloat(deposit_amount) > 0) {
        await client.query(
          `INSERT INTO connection_payments (customer_id, payment_type, amount, receipt_no, payment_date, deposit_date, comments, processed_by)
           VALUES ($1, 'deposit', $2, $3, CURRENT_DATE, $4, $5, $6)`,
          [id, deposit_amount, deposit_receipt_no || receipt_no, deposit_date, comments, userId]
        );
        await client.query('UPDATE customers SET deposit_amount = COALESCE(deposit_amount,0) + $1 WHERE id = $2', [deposit_amount, id]);
      }

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Activate customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to activate customer' });
  }
});

// Inactivate customer account
router.put('/:id/inactivate', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, reference, inactivate_date } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const prev = await client.query('SELECT account_status FROM customers WHERE id = $1', [id]);
      if (prev.rows.length === 0) throw new Error('Customer not found');
      const previousStatus = prev.rows[0].account_status;

      const updated = await client.query(
        `UPDATE customers SET account_status = 'inactive', status_reason = $1, status_reference = $2,
         status_changed_by = $3, status_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         last_suspension_date = COALESCE($4, CURRENT_DATE)
         WHERE id = $5 RETURNING *`,
        [reason, reference, userId, inactivate_date, id]
      );

      await client.query(
        `INSERT INTO customer_status_history (customer_id, previous_status, new_status, reason, reference, changed_by)
         VALUES ($1, $2, 'inactive', $3, $4, $5)`,
        [id, previousStatus, reason, reference, userId]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Inactivate customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to inactivate customer' });
  }
});

// Reactivate customer account
router.put('/:id/reactivate', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, reference } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const prev = await client.query('SELECT account_status FROM customers WHERE id = $1', [id]);
      if (prev.rows.length === 0) throw new Error('Customer not found');
      const previousStatus = prev.rows[0].account_status;

      const updated = await client.query(
        `UPDATE customers SET account_status = 'active', status_reason = $1, status_reference = $2,
         status_changed_by = $3, status_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         last_reconnection_date = CURRENT_DATE
         WHERE id = $4 RETURNING *`,
        [reason, reference, userId, id]
      );

      await client.query(
        `INSERT INTO customer_status_history (customer_id, previous_status, new_status, reason, reference, changed_by)
         VALUES ($1, $2, 'active', $3, $4, $5)`,
        [id, previousStatus, reason, reference, userId]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reactivate customer error:', error);
    res.status(500).json({ success: false, message: 'Failed to reactivate customer' });
  }
});

// Terminate customer account
router.put('/:id/terminate', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reference, ledger_no, terminate_date, termination_comments, deposit_refunded } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const prev = await client.query('SELECT account_status, balance, deposit_amount FROM customers WHERE id = $1', [id]);
      if (prev.rows.length === 0) throw new Error('Customer not found');
      const { account_status: previousStatus, balance: outstandingDebt, deposit_amount } = prev.rows[0];

      if (parseFloat(outstandingDebt || 0) > 0) {
        throw new Error(`Cannot terminate customer with outstanding debt of ${outstandingDebt}`);
      }

      const updated = await client.query(
        `UPDATE customers SET account_status = 'terminated', status_reason = $1, status_reference = $2,
         status_ledger_no = $3, status_changed_by = $4, status_changed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP, terminate_date = COALESCE($5, CURRENT_DATE)
         WHERE id = $6 RETURNING *`,
        [termination_comments, reference, ledger_no, userId, terminate_date, id]
      );

      await client.query(
        `INSERT INTO customer_status_history (customer_id, previous_status, new_status, reason, reference, ledger_no, changed_by)
         VALUES ($1, $2, 'terminated', $3, $4, $5, $6)`,
        [id, previousStatus, termination_comments, reference, ledger_no, userId]
      );

      await client.query(
        `INSERT INTO customer_terminations (customer_id, reference, ledger_no, terminate_date, termination_comments,
         outstanding_debt, deposit_refunded, processed_by)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8)`,
        [id, reference, ledger_no, terminate_date, termination_comments, outstandingDebt, deposit_refunded || 0, userId]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Terminate customer error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to terminate customer' });
  }
});

// Contract transfer wizard
router.post('/:id/transfer', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_name, new_first_name, new_last_name, new_national_id, new_telephone, new_email, transfer_reason, reference_no } = req.body;
    const userId = (req as any).user?.id;

    const result = await withTransaction(async (client) => {
      const old = await client.query('SELECT account_no, name, national_id FROM customers WHERE id = $1', [id]);
      if (old.rows.length === 0) throw new Error('Customer not found');
      const oldData = old.rows[0];

      await client.query(
        `INSERT INTO contract_transfers (customer_id, old_account_no, old_name, old_national_id, new_name,
         new_first_name, new_last_name, new_national_id, new_telephone, new_email, transfer_reason, reference_no, processed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, oldData.account_no, oldData.name, oldData.national_id, new_name, new_first_name, new_last_name,
         new_national_id, new_telephone, new_email, transfer_reason, reference_no, userId]
      );

      const updated = await client.query(
        `UPDATE customers SET name = $1, first_name = $2, last_name = $3, national_id = $4,
         telephone = COALESCE($5, telephone), email = COALESCE($6, email), updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [new_name, new_first_name, new_last_name, new_national_id, new_telephone, new_email, id]
      );

      await client.query(
        `INSERT INTO contract_history (customer_id, change_type, old_values, new_values, changed_by, change_reason)
         VALUES ($1, 'contract_transfer', $2, $3, $4, $5)`,
        [id, JSON.stringify({ name: oldData.name, national_id: oldData.national_id }),
         JSON.stringify({ name: new_name, national_id: new_national_id }), userId, transfer_reason]
      );

      return updated.rows[0];
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Contract transfer error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to transfer contract' });
  }
});

// Get status history
router.get('/:id/status-history', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await query(
      `SELECT h.*, u.username as changed_by_name FROM customer_status_history h
       LEFT JOIN users u ON h.changed_by = u.id WHERE h.customer_id = $1 ORDER BY h.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Status history error:', error);
    res.status(500).json({ success: false, message: 'Failed to load status history' });
  }
});

// Get connection payments
router.get('/:id/connection-payments', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payments = await query(
      `SELECT cp.*, u.username as processed_by_name FROM connection_payments cp
       LEFT JOIN users u ON cp.processed_by = u.id WHERE cp.customer_id = $1 ORDER BY cp.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Connection payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to load connection payments' });
  }
});

// Add connection payment
router.post('/:id/connection-payments', verifyToken, requirePermission('customers', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_type, amount, receipt_no, payment_date, fee_date, deposit_date, payment_mode, bank_account, reference, comments } = req.body;
    const userId = (req as any).user?.id;

    const result = await queryOne<any>(
      `INSERT INTO connection_payments (customer_id, payment_type, amount, receipt_no, payment_date, fee_date, deposit_date,
       payment_mode, bank_account, reference, comments, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [id, payment_type, amount, receipt_no, payment_date, fee_date, deposit_date, payment_mode, bank_account, reference, comments, userId]
    );

    if (payment_type === 'deposit') {
      await query('UPDATE customers SET deposit_amount = COALESCE(deposit_amount,0) + $1 WHERE id = $2', [amount, id]);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Add connection payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add connection payment' });
  }
});

// Get terminations
router.get('/:id/terminations', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const terminations = await query(
      `SELECT t.*, u.username as processed_by_name FROM customer_terminations t
       LEFT JOIN users u ON t.processed_by = u.id WHERE t.customer_id = $1 ORDER BY t.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: terminations });
  } catch (error) {
    console.error('Terminations error:', error);
    res.status(500).json({ success: false, message: 'Failed to load terminations' });
  }
});

// Customer statement
router.get('/:id/statement', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    const transactions = await query<any>(
      `SELECT 
        'bill' as type,
        bill_no as reference,
        bill_date as date,
        total_amount as debit,
        0 as credit,
        balance,
        status
       FROM bills WHERE customer_id = $1
         AND ($2::date IS NULL OR bill_date >= $2::date)
         AND ($3::date IS NULL OR bill_date <= $3::date)
       UNION ALL
       SELECT 
        'payment' as type,
        receipt_no as reference,
        payment_date as date,
        0 as debit,
        amount as credit,
        0 as balance,
        status
       FROM payments WHERE customer_id = $1
         AND ($2::date IS NULL OR payment_date >= $2::date)
         AND ($3::date IS NULL OR payment_date <= $3::date)
         AND is_cancelled = false
       ORDER BY date DESC`,
      [id, from_date || null, to_date || null]
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Statement error:', error);
    res.status(500).json({ success: false, message: 'Failed to load statement' });
  }
});

export default router;
