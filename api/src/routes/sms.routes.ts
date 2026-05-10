import express, { Request, Response } from 'express';
import axios from 'axios';
import { query, queryOne } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

const AFRICASTALKING_CONFIG = {
  apiKey: process.env.AFRICASTALKING_API_KEY || '',
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
  senderId: process.env.AFRICASTALKING_SENDER_ID || 'EWASCO',
};

const isSmsConfigured = () => !!AFRICASTALKING_CONFIG.apiKey;

// Send SMS via Africa's Talking
const sendSms = async (phoneNumbers: string[], message: string): Promise<any> => {
  if (!isSmsConfigured()) {
    return { simulated: true, message: 'SMS not configured - simulated send' };
  }

  const formattedPhones = phoneNumbers.map(p => {
    let phone = p.replace(/[+\s]/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    return phone;
  });

  const response = await axios.post(
    'https://api.africastalking.com/version1/messaging',
    new URLSearchParams({
      username: AFRICASTALKING_CONFIG.username,
      to: formattedPhones.join(','),
      message,
      from: AFRICASTALKING_CONFIG.senderId,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': AFRICASTALKING_CONFIG.apiKey,
      }
    }
  );

  return response.data;
};

// Get SMS templates
router.get('/templates', verifyToken, requirePermission('customers', 'view'), async (req: Request, res: Response) => {
  try {
    const templates = await query('SELECT * FROM sms_templates WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('SMS templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to load templates' });
  }
});

// Create SMS template
router.post('/templates', verifyToken, requirePermission('settings', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, purpose, template, variables } = req.body;
    const userId = (req as any).user?.id;
    const result = await queryOne(
      `INSERT INTO sms_templates (name, purpose, template, variables, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, purpose, template, JSON.stringify(variables || []), userId]
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create SMS template error:', error);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
});

// Update SMS template
router.put('/templates/:id', verifyToken, requirePermission('settings', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, purpose, template, variables, is_active } = req.body;
    const result = await queryOne(
      `UPDATE sms_templates SET name = $1, purpose = $2, template = $3, variables = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [name, purpose, template, JSON.stringify(variables || []), is_active !== undefined ? is_active : true, id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update SMS template error:', error);
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
});

// Delete SMS template
router.delete('/templates/:id', verifyToken, requirePermission('settings', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queryOne('UPDATE sms_templates SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Template deactivated' });
  } catch (error) {
    console.error('Delete SMS template error:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate template' });
  }
});

// Get SMS logs
router.get('/logs', verifyToken, requirePermission('customers', 'view'), async (req: Request, res: Response) => {
  try {
    const { status, customer_id, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = 'SELECT * FROM sms_logs WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND customer_id = $${params.length + 1}`;
      params.push(customer_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), offset);

    const logs = await query(sql, params);

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM sms_logs WHERE 1=1 ${status ? 'AND status = $1' : ''} ${customer_id ? (status ? 'AND customer_id = $2' : 'AND customer_id = $1') : ''}`,
      status && customer_id ? [status, customer_id] : status ? [status] : customer_id ? [customer_id] : []
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.count || '0')
      }
    });
  } catch (error) {
    console.error('SMS logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to load logs' });
  }
});

// Send SMS
router.post('/send', verifyToken, requirePermission('customers', 'create'), async (req: Request, res: Response) => {
  try {
    const { customer_id, phone_number, message, message_type = 'manual' } = req.body;
    const userId = (req as any).user?.id;

    if (!phone_number || !message) {
      return res.status(400).json({ success: false, message: 'Phone number and message are required' });
    }

    // Send via Africa's Talking or simulate
    const providerResponse = await sendSms([phone_number], message);
    const isSimulated = providerResponse.simulated;
    const smsStatus = isSimulated ? 'pending' : 'sent';

    const logResult = await queryOne(
      `INSERT INTO sms_logs (customer_id, phone_number, message, message_type, status, provider_response, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
      [customer_id || null, phone_number, message, message_type, smsStatus, JSON.stringify(providerResponse)]
    );

    res.json({
      success: true,
      message: isSimulated ? 'SMS simulated (Africa\'s Talking not configured)' : 'SMS sent successfully',
      data: logResult,
      simulated: isSimulated
    });
  } catch (error: any) {
    console.error('Send SMS error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to send SMS' });
  }
});

// Send bulk SMS
router.post('/send-bulk', verifyToken, requirePermission('customers', 'create'), async (req: Request, res: Response) => {
  try {
    const { customer_ids, template_id, custom_message } = req.body;
    const userId = (req as any).user?.id;

    if ((!customer_ids || customer_ids.length === 0) || (!template_id && !custom_message)) {
      return res.status(400).json({ success: false, message: 'Customer IDs and template or message required' });
    }

    let template = custom_message;
    if (template_id) {
      const templateResult = await queryOne<any>('SELECT * FROM sms_templates WHERE id = $1 AND is_active = true', [template_id]);
      if (!templateResult) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      template = templateResult.template;
    }

    // Fetch customers
    const placeholders = customer_ids.map((_: any, i: number) => `$${i + 1}`).join(',');
    const customers = await query<any>(
      `SELECT id, name, account_no, telephone, balance FROM customers WHERE id IN (${placeholders}) AND account_status = 'active'`,
      customer_ids
    );

    const results = [];
    for (const customer of customers) {
      if (!customer.telephone) continue;

      let personalizedMessage = template
        .replace(/{{name}}/g, customer.name || 'Customer')
        .replace(/{{account_no}}/g, customer.account_no || '')
        .replace(/{{balance}}/g, parseFloat(customer.balance || 0).toFixed(2));

      const providerResponse = await sendSms([customer.telephone], personalizedMessage);
      const isSimulated = providerResponse.simulated;
      const smsStatus = isSimulated ? 'pending' : 'sent';

      const logResult = await queryOne(
        `INSERT INTO sms_logs (customer_id, phone_number, message, message_type, status, provider_response, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
        [customer.id, customer.telephone, personalizedMessage, 'bulk', smsStatus, JSON.stringify(providerResponse)]
      );

      results.push(logResult);
    }

    res.json({
      success: true,
      message: `Sent to ${results.length} customers`,
      data: results,
      simulated: !isSmsConfigured()
    });
  } catch (error: any) {
    console.error('Bulk SMS error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to send bulk SMS' });
  }
});

// Get SMS config status
router.get('/config', verifyToken, requirePermission('customers', 'view'), async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        configured: isSmsConfigured(),
        username: AFRICASTALKING_CONFIG.username,
        senderId: AFRICASTALKING_CONFIG.senderId,
        hasApiKey: !!AFRICASTALKING_CONFIG.apiKey
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load config' });
  }
});

export default router;
