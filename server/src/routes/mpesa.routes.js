const express = require('express');
const axios = require('axios');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// M-Pesa Configuration
const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  passkey: process.env.MPESA_PASSKEY,
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  env: process.env.MPESA_ENV || 'sandbox',
  initiatorName: process.env.MPESA_INITIATOR_NAME,
  initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD,
  b2cShortcode: process.env.MPESA_B2C_SHORTCODE || '600986',
  b2cPartyB: process.env.MPESA_B2C_PARTY_B || '600000'
};

// Get base URL based on environment
const getBaseUrl = () => {
  return MPESA_CONFIG.env === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';
};

// Generate password for STK Push
const generatePassword = (shortcode, passkey, timestamp) => {
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
};

// Get access token from M-Pesa
const getAccessToken = async () => {
  const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
  
  const response = await axios.get(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  
  return response.data.access_token;
};

// Get M-Pesa transactions
router.get('/transactions', verifyToken, authorize('admin', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  
  let sql = 'SELECT * FROM mpesa_transactions WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const transactions = await executeQuery(sql, params);
  res.json({ success: true, data: transactions });
}));

// M-Pesa C2B Validation URL (called by Safaricom)
router.post('/c2b/validation', asyncHandler(async (req, res) => {
  const { BillRefNumber, MSISDN, TransAmount } = req.body;
  
  // Verify account exists
  const customers = await executeQuery(
    'SELECT id FROM customers WHERE account_number = ?',
    [BillRefNumber]
  );
  
  if (customers.length === 0) {
    return res.json({
      ResultCode: 1,
      ResultDesc: 'Invalid account number'
    });
  }
  
  res.json({
    ResultCode: 0,
    ResultDesc: 'Success'
  });
}));

// M-Pesa C2B Confirmation URL (called by Safaricom)
router.post('/c2b/confirmation', asyncHandler(async (req, res) => {
  const payload = req.body;
  
  // Store transaction
  await executeQuery(
    `INSERT INTO mpesa_transactions (transaction_type, trans_id, trans_time, trans_amount,
     business_shortcode, bill_ref_number, msisdn, first_name, middle_name, last_name,
     result_code, result_desc, raw_payload, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
    [
      'C2B', payload.TransID, payload.TransTime, payload.TransAmount,
      payload.BusinessShortCode, payload.BillRefNumber, payload.MSISDN,
      payload.FirstName, payload.MiddleName, payload.LastName,
      '0', 'Success', JSON.stringify(payload)
    ]
  );
  
  // TODO: Auto-reconcile by matching BillRefNumber to customer and creating payment
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
}));

// STK Push initiate
router.post('/stkpush', verifyToken, authorize('admin', 'manager', 'clerk', 'cashier'), asyncHandler(async (req, res) => {
  const { phoneNumber, amount, accountReference, description, callbackUrl } = req.body;
  
  if (!phoneNumber || !amount || !accountReference) {
    return res.status(400).json({ message: 'Phone number, amount, and account reference are required' });
  }
  
  // Format phone number (remove + and ensure 254 prefix)
  let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  }
  
  // Generate timestamp in format YYYYMMDDHHMMSS
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
  
  // Generate password
  const password = generatePassword(MPESA_CONFIG.shortcode, MPESA_CONFIG.passkey, timestamp);
  
  // Get access token
  const accessToken = await getAccessToken();
  
  // Prepare STK Push request
  const stkPushData = {
    BusinessShortCode: MPESA_CONFIG.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: formattedPhone,
    PartyB: MPESA_CONFIG.shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl || `${process.env.FRONTEND_URL}/api/mpesa/stk-callback`,
    AccountReference: accountReference.substring(0, 12),
    TransactionDesc: (description || 'Water Bill Payment').substring(0, 13)
  };
  
  // Send STK Push request
  const response = await axios.post(
    `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
    stkPushData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  // Store transaction in database
  await executeQuery(
    `INSERT INTO mpesa_transactions (transaction_type, merchant_request_id, checkout_request_id,
     trans_amount, msisdn, bill_ref_number, result_code, result_desc, raw_payload, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      'STK_PUSH',
      response.data.MerchantRequestID,
      response.data.CheckoutRequestID,
      amount,
      formattedPhone,
      accountReference,
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
}));

// STK Push Callback (called by Safaricom)
router.post('/stk-callback', asyncHandler(async (req, res) => {
  const { Body } = req.body;
  const stkCallback = Body.stkCallback;
  
  const resultCode = stkCallback.ResultCode;
  const checkoutRequestId = stkCallback.CheckoutRequestID;
  const resultDesc = stkCallback.ResultDesc;
  
  let callbackMetadata = {};
  if (resultCode === 0 && stkCallback.CallbackMetadata) {
    stkCallback.CallbackMetadata.Item.forEach(item => {
      callbackMetadata[item.Name] = item.Value;
    });
  }
  
  // Update transaction status
  await executeQuery(
    `UPDATE mpesa_transactions 
     SET result_code = ?, result_desc = ?, mpesa_receipt_number = ?, 
         transaction_date = ?, raw_payload = ?, status = ?
     WHERE checkout_request_id = ?`,
    [
      resultCode,
      resultDesc,
      callbackMetadata.MpesaReceiptNumber || null,
      callbackMetadata.TransactionDate || null,
      JSON.stringify(req.body),
      resultCode === 0 ? 'completed' : 'failed',
      checkoutRequestId
    ]
  );
  
  // If successful, auto-reconcile payment
  if (resultCode === 0) {
    const transaction = await executeQuery(
      'SELECT bill_ref_number, trans_amount FROM mpesa_transactions WHERE checkout_request_id = ?',
      [checkoutRequestId]
    );
    
    if (transaction.length > 0) {
      // Find customer by account number
      const customers = await executeQuery(
        'SELECT id FROM customers WHERE account_number = ?',
        [transaction[0].bill_ref_number]
      );
      
      if (customers.length > 0) {
        // Create payment record
        await executeQuery(
          `INSERT INTO payments (customer_id, amount, payment_method, payment_date, 
           reference_number, notes, received_by, is_reconciled)
           VALUES (?, ?, 'mpesa', NOW(), ?, 'M-Pesa STK Push Payment', NULL, TRUE)`,
          [customers[0].id, transaction[0].trans_amount, callbackMetadata.MpesaReceiptNumber]
        );
      }
    }
  }
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
}));

// B2C Payment Request (Business to Customer - Send money to customer)
router.post('/b2c', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { phoneNumber, amount, remarks, occasion } = req.body;
  
  if (!phoneNumber || !amount) {
    return res.status(400).json({ message: 'Phone number and amount are required' });
  }
  
  // Format phone number
  let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  }
  
  // Generate unique command ID
  const commandId = `B2C-${Date.now()}`;
  
  // Get access token
  const accessToken = await getAccessToken();
  
  // Prepare B2C request
  const b2cData = {
    InitiatorName: MPESA_CONFIG.initiatorName,
    SecurityCredential: Buffer.from(MPESA_CONFIG.initiatorPassword).toString('base64'),
    CommandID: 'BusinessPayment',
    Amount: Math.round(amount),
    PartyA: MPESA_CONFIG.b2cShortcode,
    PartyB: formattedPhone,
    Remarks: remarks || 'B2C Payment',
    QueueTimeOutURL: `${process.env.FRONTEND_URL}/api/mpesa/b2c-timeout`,
    ResultURL: `${process.env.FRONTEND_URL}/api/mpesa/b2c-result`,
    Occasion: occasion || 'Payment'
  };
  
  // Send B2C request
  const response = await axios.post(
    `${getBaseUrl()}/mpesa/b2c/v1/paymentrequest`,
    b2cData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  // Store transaction
  await executeQuery(
    `INSERT INTO mpesa_transactions (transaction_type, merchant_request_id, trans_id,
     trans_amount, msisdn, result_code, result_desc, raw_payload, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      'B2C',
      response.data.ConversationID,
      commandId,
      amount,
      formattedPhone,
      response.data.ResponseCode,
      response.data.ResponseDescription,
      JSON.stringify(response.data)
    ]
  );
  
  res.json({
    success: response.data.ResponseCode === '0',
    message: response.data.ResponseDescription,
    data: {
      conversationId: response.data.ConversationID,
      originatorConversationId: response.data.OriginatorConversationID
    }
  });
}));

// B2C Result URL (called by Safaricom)
router.post('/b2c-result', asyncHandler(async (req, res) => {
  const result = req.body.Result;
  const conversationId = result.ConversationID;
  const resultCode = result.ResultCode;
  const resultDesc = result.ResultDesc;
  
  let resultParams = {};
  if (result.ResultParameters) {
    result.ResultParameters.ResultParameter.forEach(param => {
      resultParams[param.Key] = param.Value;
    });
  }
  
  // Update transaction
  await executeQuery(
    `UPDATE mpesa_transactions 
     SET result_code = ?, result_desc = ?, mpesa_receipt_number = ?, 
         transaction_date = ?, raw_payload = ?, status = ?
     WHERE merchant_request_id = ?`,
    [
      resultCode,
      resultDesc,
      resultParams.TransactionReceipt || null,
      resultParams.TransactionCompletedDateTime || null,
      JSON.stringify(req.body),
      resultCode === 0 ? 'completed' : 'failed',
      conversationId
    ]
  );
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
}));

// B2C Timeout URL (called by Safaricom)
router.post('/b2c-timeout', asyncHandler(async (req, res) => {
  const result = req.body.Result;
  const conversationId = result.ConversationID;
  
  // Update transaction as timed out
  await executeQuery(
    `UPDATE mpesa_transactions 
     SET result_code = ?, result_desc = ?, raw_payload = ?, status = 'timeout'
     WHERE merchant_request_id = ?`,
    [
      result.ResultCode,
      result.ResultDesc,
      JSON.stringify(req.body),
      conversationId
    ]
  );
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
}));

// Account Balance Query
router.post('/balance', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  
  // Get access token
  const accessToken = await getAccessToken();
  
  // Prepare balance query
  const balanceData = {
    Initiator: MPESA_CONFIG.initiatorName,
    SecurityCredential: Buffer.from(MPESA_CONFIG.initiatorPassword).toString('base64'),
    CommandID: 'AccountBalance',
    PartyA: MPESA_CONFIG.shortcode,
    IdentifierType: '4',
    Remarks: remarks || 'Balance Query',
    QueueTimeOutURL: `${process.env.FRONTEND_URL}/api/mpesa/balance-timeout`,
    ResultURL: `${process.env.FRONTEND_URL}/api/mpesa/balance-result`
  };
  
  // Send balance query
  const response = await axios.post(
    `${getBaseUrl()}/mpesa/accountbalance/v1/query`,
    balanceData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  res.json({
    success: response.data.ResponseCode === '0',
    message: response.data.ResponseDescription,
    data: {
      conversationId: response.data.ConversationID,
      originatorConversationId: response.data.OriginatorConversationID
    }
  });
}));

module.exports = router;
