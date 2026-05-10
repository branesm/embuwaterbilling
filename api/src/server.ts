import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import meterRoutes from './routes/meter.routes';
import billingRoutes from './routes/billing.routes';
import paymentRoutes from './routes/payment.routes';
import reportRoutes from './routes/report.routes';
import adminRoutes from './routes/admin.routes';
import debtRoutes from './routes/debt.routes';
import disconnectionRoutes from './routes/disconnections.routes';
import complaintRoutes from './routes/complaints.routes';
import tariffRoutes from './routes/tariff.routes';
import parameterRoutes from './routes/parameters.routes';
import nrwRoutes from './routes/nrw.routes';
import readingRoutes from './routes/readings.routes';
import mpesaRoutes from './routes/mpesa.routes';
import smsRoutes from './routes/sms.routes';
import portalRoutes from './routes/portal.routes';
import workOrderRoutes from './routes/workorder.routes';
import technicianRoutes from './routes/technician.routes';
import { initializeJobs } from './services/jobs.service';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debt', debtRoutes);
app.use('/api/disconnections', disconnectionRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/tariffs', tariffRoutes);
app.use('/api/parameters', parameterRoutes);
app.use('/api/nrw', nrwRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/technicians', technicianRoutes);

// Initialize scheduled jobs
initializeJobs();

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`EWASCO API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
