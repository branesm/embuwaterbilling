const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');
const { auditLog } = require('./middleware/auditLog');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const customerRoutes = require('./routes/customer.routes');
const meterRoutes = require('./routes/meter.routes');
const readingRoutes = require('./routes/reading.routes');
const billingRoutes = require('./routes/billing.routes');
const paymentRoutes = require('./routes/payment.routes');
const zoneRoutes = require('./routes/zone.routes');
const routeRoutes = require('./routes/route.routes');
const tariffRoutes = require('./routes/tariff.routes');
const reportRoutes = require('./routes/report.routes');
const settingRoutes = require('./routes/setting.routes');
const smsRoutes = require('./routes/sms.routes');
const mpesaRoutes = require('./routes/mpesa.routes');
const portalRoutes = require('./routes/portal.routes');
const workOrderRoutes = require('./routes/workorder.routes');
const technicianRoutes = require('./routes/technician.routes');
const deviceRoutes = require('./routes/device.routes');
const contractRoutes = require('./routes/contract.routes');
const complaintRoutes = require('./routes/complaint.routes');
const disconnectionRoutes = require('./routes/disconnection.routes');
const wasrebRoutes = require('./routes/wasreb.routes');
const anomalyRoutes = require('./routes/anomaly.routes');
const uploadRoutes = require('./routes/upload.routes');
const arrearsRoutes = require('./routes/arrears.routes');
const readingBookRoutes = require('./routes/readingbook.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Audit logging
app.use(auditLog);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/tariffs', tariffRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/disconnections', disconnectionRoutes);
app.use('/api/wasreb', wasrebRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/arrears', arrearsRoutes);
app.use('/api/reading-books', readingBookRoutes);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`EWASCO Water Billing Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
