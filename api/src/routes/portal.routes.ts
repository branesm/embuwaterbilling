import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database';
import { verifyCustomerToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ewasco_jwt_secret_key_2024_secure';

// Customer portal login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { account_no, pin } = req.body;

    if (!account_no || !pin) {
      return res.status(400).json({ success: false, message: 'Account number and PIN required' });
    }

    const customer = await queryOne<any>(
      'SELECT * FROM customers WHERE account_no = $1 AND portal_enabled = true',
      [account_no]
    );

    if (!customer) {
      return res.status(401).json({ success: false, message: 'Invalid account number or account disabled' });
    }

    // Check PIN - if no portal_pin set, allow login with last 4 digits of phone as fallback
    const validPin = customer.portal_pin === pin ||
      (!customer.portal_pin && customer.telephone && customer.telephone.endsWith(pin));

    if (!validPin) {
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }

    const token = jwt.sign(
      {
        customerId: customer.id,
        account_no: customer.account_no,
        name: customer.name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token
    await queryOne(
      'INSERT INTO customer_portal_tokens (customer_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'24 hours\')',
      [customer.id, token]
    );

    res.json({
      success: true,
      data: {
        token,
        customer: {
          id: customer.id,
          account_no: customer.account_no,
          name: customer.name,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          telephone: customer.telephone,
          address: customer.address,
          town: customer.town,
          balance: parseFloat(customer.balance || 0),
          account_status: customer.account_status,
        }
      }
    });
  } catch (error) {
    console.error('Portal login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get customer profile
router.get('/profile', verifyCustomerToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.customerId;
    const customer = await queryOne<any>(
      `SELECT c.*, z.name as zone_name, bg.name as billing_group_name
       FROM customers c
       LEFT JOIN zones z ON c.zone_id = z.id
       LEFT JOIN billing_groups bg ON c.billing_group_id = bg.id
       WHERE c.id = $1`,
      [customerId]
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get active meter
    const meters = await query(
      'SELECT * FROM meters WHERE customer_id = $1 AND meter_status = $2',
      [customerId, 'active']
    );

    res.json({
      success: true,
      data: {
        ...customer,
        balance: parseFloat(customer.balance || 0),
        deposit_amount: parseFloat(customer.deposit_amount || 0),
        meters,
      }
    });
  } catch (error) {
    console.error('Portal profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

// Get customer bills
router.get('/bills', verifyCustomerToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.customerId;
    const bills = await query(
      `SELECT b.*, fp.name as period_name
       FROM bills b
       LEFT JOIN financial_periods fp ON b.billing_period_id = fp.id
       WHERE b.customer_id = $1
       ORDER BY b.bill_date DESC`,
      [customerId]
    );

    res.json({
      success: true,
      data: bills.map((b: any) => ({
        ...b,
        total_amount: parseFloat(b.total_amount || 0),
        amount_paid: parseFloat(b.amount_paid || 0),
        balance: parseFloat(b.balance || 0),
        water_charge: parseFloat(b.water_charge || 0),
        sewer_charge: parseFloat(b.sewer_charge || 0),
        fixed_charge: parseFloat(b.fixed_charge || 0),
      }))
    });
  } catch (error) {
    console.error('Portal bills error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bills' });
  }
});

// Get customer payments
router.get('/payments', verifyCustomerToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.customerId;
    const payments = await query(
      `SELECT p.*, pm.name as payment_mode
       FROM payments p
       LEFT JOIN payment_modes pm ON p.payment_mode_id = pm.id
       WHERE p.customer_id = $1
       ORDER BY p.payment_date DESC`,
      [customerId]
    );

    res.json({
      success: true,
      data: payments.map((p: any) => ({
        ...p,
        amount: parseFloat(p.amount || 0),
      }))
    });
  } catch (error) {
    console.error('Portal payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payments' });
  }
});

// Get consumption history
router.get('/consumption', verifyCustomerToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.customerId;
    const { months = '12' } = req.query;

    const readings = await query(
      `SELECT reading_date, previous_reading, current_reading, consumption, is_estimated, anomaly_flag
       FROM meter_readings
       WHERE customer_id = $1
       AND reading_date >= CURRENT_DATE - INTERVAL '${months} months'
       ORDER BY reading_date ASC`,
      [customerId]
    );

    // Calculate monthly aggregates
    const monthly = await query(
      `SELECT
         DATE_TRUNC('month', reading_date) as month,
         SUM(consumption) as total_consumption,
         COUNT(*) as reading_count,
         AVG(consumption) as avg_consumption
       FROM meter_readings
       WHERE customer_id = $1
       AND reading_date >= CURRENT_DATE - INTERVAL '${months} months'
       GROUP BY DATE_TRUNC('month', reading_date)
       ORDER BY month ASC`,
      [customerId]
    );

    res.json({
      success: true,
      data: {
        readings: readings.map((r: any) => ({
          ...r,
          consumption: parseFloat(r.consumption || 0),
          previous_reading: parseFloat(r.previous_reading || 0),
          current_reading: parseFloat(r.current_reading || 0),
        })),
        monthly: monthly.map((m: any) => ({
          ...m,
          total_consumption: parseFloat(m.total_consumption || 0),
          avg_consumption: parseFloat(m.avg_consumption || 0),
        })),
      }
    });
  } catch (error) {
    console.error('Portal consumption error:', error);
    res.status(500).json({ success: false, message: 'Failed to load consumption' });
  }
});

// Change PIN
router.post('/change-pin', verifyCustomerToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.customerId;
    const { current_pin, new_pin } = req.body;

    if (!current_pin || !new_pin || new_pin.length < 4) {
      return res.status(400).json({ success: false, message: 'Current PIN and new PIN (min 4 chars) required' });
    }

    const customer = await queryOne<any>('SELECT portal_pin, telephone FROM customers WHERE id = $1', [customerId]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const validPin = customer.portal_pin === current_pin ||
      (!customer.portal_pin && customer.telephone && customer.telephone.endsWith(current_pin));

    if (!validPin) {
      return res.status(401).json({ success: false, message: 'Current PIN is incorrect' });
    }

    await query('UPDATE customers SET portal_pin = $1 WHERE id = $2', [new_pin, customerId]);
    res.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ success: false, message: 'Failed to change PIN' });
  }
});

export default router;
