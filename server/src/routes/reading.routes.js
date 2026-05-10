const express = require('express');
const { executeQuery, withTransaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Detect anomalies in reading
const detectAnomalies = async (meterId, consumption, customerId) => {
  const anomalies = [];
  
  if (consumption < 0) {
    anomalies.push({ type: 'negative_consumption', message: 'Negative consumption detected - possible tampering' });
  }
  
  if (consumption === 0) {
    anomalies.push({ type: 'zero_consumption', message: 'Zero consumption - possible faulty meter' });
  }
  
  // Get average of last 3 months
  const avgResult = await executeQuery(
    `SELECT AVG(consumption) as avg_consumption 
     FROM meter_readings 
     WHERE meter_id = ? AND is_estimated = FALSE 
     ORDER BY reading_date DESC LIMIT 3`,
    [meterId]
  );
  
  const avgConsumption = avgResult[0]?.avg_consumption;
  
  if (avgConsumption && avgConsumption > 0) {
    if (consumption > avgConsumption * 3) {
      anomalies.push({ type: 'high_consumption', message: 'Consumption > 3x average - possible leak' });
    }
    if (consumption < avgConsumption * 0.3 && consumption > 0) {
      anomalies.push({ type: 'low_consumption', message: 'Consumption < 30% of average - possible bypass' });
    }
  }
  
  return anomalies;
};

// Get readings
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk', 'reader'), asyncHandler(async (req, res) => {
  const { meter, customer, route, page = 1, limit = 20 } = req.query;
  
  let sql = `SELECT r.*, m.serial_number, c.account_number, c.first_name, c.last_name,
             u.first_name as reader_first_name, u.last_name as reader_last_name
             FROM meter_readings r 
             LEFT JOIN meters m ON r.meter_id = m.id 
             LEFT JOIN customers c ON r.customer_id = c.id
             LEFT JOIN users u ON r.reader_id = u.id WHERE 1=1`;
  const params = [];

  if (meter) { sql += ' AND r.meter_id = ?'; params.push(meter); }
  if (customer) { sql += ' AND r.customer_id = ?'; params.push(customer); }
  if (route) { sql += ' AND r.route_id = ?'; params.push(route); }

  sql += ' ORDER BY r.reading_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const readings = await executeQuery(sql, params);

  res.json({ success: true, data: readings });
}));

// Create reading
router.post('/', verifyToken, authorize('admin', 'manager', 'clerk', 'reader'), asyncHandler(async (req, res) => {
  const { meterId, customerId, readingDate, currentReading, notes, routeId } = req.body;

  if (!meterId || !customerId || !readingDate || currentReading === undefined) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  await withTransaction(async (connection) => {
    // Get previous reading
    const prevResult = await connection.execute(
      'SELECT current_reading FROM meter_readings WHERE meter_id = ? ORDER BY reading_date DESC LIMIT 1',
      [meterId]
    );
    
    const previousReading = prevResult[0][0]?.current_reading || 0;
    const consumption = parseFloat(currentReading) - parseFloat(previousReading);
    
    // Detect anomalies
    const anomalies = await detectAnomalies(meterId, consumption, customerId);
    
    // Insert reading
    const [result] = await connection.execute(
      `INSERT INTO meter_readings (meter_id, customer_id, reading_date, current_reading, 
       previous_reading, consumption, reader_id, route_id, notes, anomaly_flags, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [meterId, customerId, readingDate, currentReading, previousReading, consumption, 
       req.user.id, routeId || null, notes || null, JSON.stringify(anomalies)]
    );
    
    // Update meter current reading
    await connection.execute(
      'UPDATE meters SET current_reading = ? WHERE id = ?',
      [currentReading, meterId]
    );
    
    return { id: result.insertId, anomalies };
  });

  res.status(201).json({ success: true, message: 'Reading recorded successfully' });
}));

module.exports = router;
