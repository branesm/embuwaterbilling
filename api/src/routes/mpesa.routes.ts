import express, { Request, Response } from 'express';
import axios from 'axios';
import { query, queryOne, withTransaction } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = express.Router();

// M-Pesa Configuration
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  passkey: process.env.MPESA_PASSKEY || '',
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  env: process.env.MPESA_ENV || 'sandbox',
};

const getBaseUrl = () => {
  return MPESA_CONFIG.env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
};

const generatePassword = (shortcode: string, passkey: string, timestamp: string) => {
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
};

const getAccessToken = async (): Promise<string> => {
  const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
  const response = await axios.get(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return response.data.access_token;
};

const formatPhone = (phone: string) => {
  let formatted = phone.replace(/[+\s]/g, '');
  if (formatted.startsWith('0')) formatted = '254' + formatted.substring(1);
  return formatted;
};

// Get M-Pesa transactions
router.get('/transactions', verifyToken, requirePermission('payments', 'view'), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = 'SELECT * FROM mpesa_transactions WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), offset);

    const transactions = await query(sql, params);

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM mpesa_transactions ${status ? 'WHERE status = $1' : ''}`,
      status ? [status] : []
    );

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult?.count || '0')
      }
    });
  } catch (error) {
    console.error('M-Pesa transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load transactions' });
  }
});

// STK Push initiate
router.post('/stkpush', verifyToken, requirePermission('payments', 'create'), async (req: Request, res: Response) => {
  try {
    const { phone_number, amount, account_reference, description, callback_url } = req.body;

    if (!phone_number || !amount || !account_reference) {
      return res.status(400).json({ success: false, message: 'Phone number, amount, and account reference are required' });
    }

    if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.passkey) {
      return res.status(503).json({ success: false, message: 'M-Pesa not configured' });
    }

    const formattedPhone = formatPhone(phone_number);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
    const password = generatePassword(MPESA_CONFIG.shortcode, MPESA_CONFIG.passkey, timestamp);
    const accessToken = await getAccessToken();

    const stkPushData = {
      BusinessShortCode: MPESA_CONFIG.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callback_url || `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/mpesa/stk-callback`,
      AccountReference: account_reference.substring(0, 12),
      TransactionDesc: (description || 'Water Bill Payment').substring(0, 13)
    };

    const response = await axios.post(
      `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
      stkPushData,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    await queryOne(
      `INSERT INTO mpesa_transactions (transaction_type, merchant_request_id, checkout_request_id,
       trans_amount, msisdn, bill_ref_number, result_code, result_desc, raw_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [
        'STK_PUSH',
        response.data.MerchantRequestID,
        response.data.CheckoutRequestID,
        amount,
        formattedPhone,
        account_reference,
        response.data.ResponseCode,
        response.data.ResponseDescription,
        JSON.stringify(response.data)
      ]
    );

    res.json({
      success: response.data.ResponseCode === '0',
      message: response.data.ResponseDescription,
      data: {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        customerMessage: response.data.CustomerMessage
      }
    });
  } catch (error: any) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.errorMessage || 'STK Push failed' });
  }
});

// STK Push Callback (called by Safaricom)
router.post('/stk-callback', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;
    const stkCallback = Body?.stkCallback;
    if (!stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: 'Received' });
    }

    const resultCode = stkCallback.ResultCode;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultDesc = stkCallback.ResultDesc;

    let callbackMetadata: Record<string, any> = {};
    if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      stkCallback.CallbackMetadata.Item.forEach((item: any) => {
        callbackMetadata[item.Name] = item.Value;
      });
    }

    await query(
      `UPDATE mpesa_transactions
       SET result_code = $1, result_desc = $2, mpesa_receipt_number = $3,
           transaction_date = $4, raw_payload = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE checkout_request_id = $7`,
      [
        String(resultCode),
        resultDesc,
        callbackMetadata.MpesaReceiptNumber || null,
        callbackMetadata.TransactionDate ? new Date(callbackMetadata.TransactionDate) : null,
        JSON.stringify(req.body),
        resultCode === 0 ? 'completed' : 'failed',
        checkoutRequestId
      ]
    );

    // Auto-reconcile on success
    if (resultCode === 0) {
      const tx = await queryOne<any>(
        'SELECT bill_ref_number, trans_amount FROM mpesa_transactions WHERE checkout_request_id = $1',
        [checkoutRequestId]
      );

      if (tx) {
        const customer = await queryOne<any>(
          'SELECT id FROM customers WHERE account_no = $1',
          [tx.bill_ref_number]
        );

        if (customer) {
          const receiptNo = `MPESA-${Date.now()}`;
          const paymentResult = await queryOne<any>(
            `INSERT INTO payments (receipt_no, customer_id, amount, payment_date,
             payment_mode_id, reference, cashier_id, notes)
             VALUES ($1, $2, $3, CURRENT_DATE,
             (SELECT id FROM payment_modes WHERE code = 'MPESA'),
             $4, NULL, $5) RETURNING *`,
            [receiptNo, customer.id, tx.trans_amount, callbackMetadata.MpesaReceiptNumber, 'M-Pesa STK Push Payment']
          );

          await query(
            'UPDATE mpesa_transactions SET is_reconciled = true, payment_id = $1 WHERE checkout_request_id = $2',
            [paymentResult?.id, checkoutRequestId]
          );

          // Update customer balance
          await query(
            'UPDATE customers SET balance = balance - $1 WHERE id = $2',
            [tx.trans_amount, customer.id]
          );
        }
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('STK callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

// C2B Validation URL (called by Safaricom)
router.post('/c2b/validation', async (req: Request, res: Response) => {
  try {
    const { BillRefNumber } = req.body;
    const customer = await queryOne('SELECT id FROM customers WHERE account_no = $1', [BillRefNumber]);

    if (!customer) {
      return res.json({ ResultCode: 1, ResultDesc: 'Invalid account number' });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B validation error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// C2B Confirmation URL (called by Safaricom)
router.post('/c2b/confirmation', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    const txResult = await queryOne<any>(
      `INSERT INTO mpesa_transactions (transaction_type, trans_id, trans_time, trans_amount,
       business_shortcode, bill_ref_number, msisdn, first_name, middle_name, last_name,
       result_code, result_desc, raw_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed') RETURNING *`,
      [
        'C2B', payload.TransID, payload.TransTime, payload.TransAmount,
        payload.BusinessShortCode, payload.BillRefNumber, payload.MSISDN,
        payload.FirstName, payload.MiddleName, payload.LastName,
        '0', 'Success', JSON.stringify(payload)
      ]
    );

    // Auto-reconcile
    const customer = await queryOne<any>(
      'SELECT id FROM customers WHERE account_no = $1',
      [payload.BillRefNumber]
    );

    if (customer) {
      const receiptNo = `MPESA-${Date.now()}`;
      const paymentResult = await queryOne<any>(
        `INSERT INTO payments (receipt_no, customer_id, amount, payment_date,
         payment_mode_id, reference, cashier_id, notes)
         VALUES ($1, $2, $3, CURRENT_DATE,
         (SELECT id FROM payment_modes WHERE code = 'MPESA'),
         $4, NULL, $5) RETURNING *`,
        [receiptNo, customer.id, payload.TransAmount, payload.TransID, 'M-Pesa C2B Payment']
      );

      await query(
        'UPDATE mpesa_transactions SET is_reconciled = true, payment_id = $1 WHERE id = $2',
        [paymentResult?.id, txResult?.id]
      );

      await query(
        'UPDATE customers SET balance = balance - $1 WHERE id = $2',
        [payload.TransAmount, customer.id]
      );
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('C2B confirmation error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

// Manual reconcile transaction
router.post('/reconcile/:id', verifyToken, requirePermission('payments', 'edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customer_id } = req.body;

    const tx = await queryOne<any>('SELECT * FROM mpesa_transactions WHERE id = $1', [id]);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (tx.is_reconciled) {
      return res.status(400).json({ success: false, message: 'Already reconciled' });
    }

    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const receiptNo = `MPESA-${Date.now()}`;
    const paymentResult = await queryOne<any>(
      `INSERT INTO payments (receipt_no, customer_id, amount, payment_date,
       payment_mode_id, reference, cashier_id, notes)
       VALUES ($1, $2, $3, CURRENT_DATE,
       (SELECT id FROM payment_modes WHERE code = 'MPESA'),
       $4, NULL, $5) RETURNING *`,
      [receiptNo, customer.id, tx.trans_amount, tx.mpesa_receipt_number || tx.trans_id, 'M-Pesa Manual Reconciliation']
    );

    await query(
      'UPDATE mpesa_transactions SET is_reconciled = true, payment_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [paymentResult?.id, id]
    );

    await query(
      'UPDATE customers SET balance = balance - $1 WHERE id = $2',
      [tx.trans_amount, customer.id]
    );

    res.json({ success: true, message: 'Reconciled successfully', data: paymentResult });
  } catch (error) {
    console.error('Reconcile error:', error);
    res.status(500).json({ success: false, message: 'Reconciliation failed' });
  }
});

// Get M-Pesa config status (masked)
router.get('/config', verifyToken, requirePermission('payments', 'view'), async (req: Request, res: Response) => {
  try {
    const isConfigured = !!MPESA_CONFIG.consumerKey && !!MPESA_CONFIG.passkey;
    res.json({
      success: true,
      data: {
        configured: isConfigured,
        environment: MPESA_CONFIG.env,
        shortcode: MPESA_CONFIG.shortcode,
        hasConsumerKey: !!MPESA_CONFIG.consumerKey,
        hasPasskey: !!MPESA_CONFIG.passkey
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load config' });
  }
});

export default router;
