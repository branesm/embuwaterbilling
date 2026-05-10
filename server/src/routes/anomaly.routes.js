const express = require('express');
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Anomaly detection rules
const ANOMALY_RULES = {
  ZERO_CONSUMPTION: {
    code: 'ZERO_CONSUMPTION',
    name: 'Zero Consumption',
    description: 'No water consumption recorded for consecutive months',
    severity: 'medium',
    check: (current, previous, history) => {
      // Check if current and previous readings are the same
      return current.consumption === 0;
    }
  },
  HIGH_CONSUMPTION: {
    code: 'HIGH_CONSUMPTION',
    name: 'Unusually High Consumption',
    description: 'Consumption is significantly higher than average',
    severity: 'high',
    check: (current, previous, history) => {
      if (history.length < 3) return false;
      const avgConsumption = history.reduce((sum, h) => sum + h.consumption, 0) / history.length;
      return current.consumption > avgConsumption * 2.5; // 2.5x average
    }
  },
  LOW_CONSUMPTION: {
    code: 'LOW_CONSUMPTION',
    name: 'Unusually Low Consumption',
    description: 'Consumption is significantly lower than average',
    severity: 'low',
    check: (current, previous, history) => {
      if (history.length < 3 || current.consumption === 0) return false;
      const avgConsumption = history.reduce((sum, h) => sum + h.consumption, 0) / history.length;
      return current.consumption < avgConsumption * 0.3; // Less than 30% of average
    }
  },
  NEGATIVE_CONSUMPTION: {
    code: 'NEGATIVE_CONSUMPTION',
    name: 'Negative Consumption',
    description: 'Current reading is less than previous reading',
    severity: 'critical',
    check: (current, previous, history) => {
      return current.consumption < 0;
    }
  },
  NO_READING: {
    code: 'NO_READING',
    name: 'Missing Reading',
    description: 'No meter reading recorded for billing period',
    severity: 'high',
    check: (current, previous, history) => {
      return !current.reading_id;
    }
  },
  ESTIMATED_READING: {
    code: 'ESTIMATED_READING',
    name: 'Estimated Reading',
    description: 'Reading was estimated rather than actual',
    severity: 'medium',
    check: (current, previous, history) => {
      return current.is_estimated === 1;
    }
  }
};

// Detect anomalies for a specific meter reading
router.post('/detect', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { meterId, readingId, currentReading, previousReading, consumption, isEstimated } = req.body;

  if (!meterId) {
    return res.status(400).json({ message: 'Meter ID is required' });
  }

  // Get historical readings for this meter (last 6 months)
  const history = await executeQuery(
    `SELECT 
      mr.current_reading - mr.previous_reading as consumption,
      mr.reading_date,
      mr.is_estimated
     FROM meter_readings mr
     WHERE mr.meter_id = ?
     AND mr.id != ?
     ORDER BY mr.reading_date DESC
     LIMIT 6`,
    [meterId, readingId || 0]
  );

  const current = {
    consumption: parseFloat(consumption) || 0,
    reading: parseFloat(currentReading) || 0,
    is_estimated: isEstimated ? 1 : 0,
    reading_id: readingId
  };

  const previous = {
    consumption: parseFloat(previousReading) || 0
  };

  // Run anomaly detection rules
  const detectedAnomalies = [];
  for (const [key, rule] of Object.entries(ANOMALY_RULES)) {
    if (rule.check(current, previous, history)) {
      detectedAnomalies.push({
        code: rule.code,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        detected_at: new Date()
      });
    }
  }

  // Store detected anomalies
  for (const anomaly of detectedAnomalies) {
    await executeQuery(
      `INSERT INTO meter_reading_anomalies 
       (meter_id, reading_id, anomaly_code, anomaly_name, description, severity, detected_by, is_resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
       ON DUPLICATE KEY UPDATE 
       detected_at = CURRENT_TIMESTAMP,
       is_resolved = FALSE`,
      [meterId, readingId || null, anomaly.code, anomaly.name, anomaly.description, anomaly.severity, req.user.id]
    );
  }

  res.json({
    success: true,
    data: {
      anomalies_detected: detectedAnomalies.length,
      anomalies: detectedAnomalies,
      historical_average: history.length > 0 
        ? history.reduce((sum, h) => sum + h.consumption, 0) / history.length 
        : null,
      historical_readings: history.length
    }
  });
}));

// Get all anomalies with filters
router.get('/', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { 
    severity, 
    isResolved, 
    meterId,
    page = 1, 
    limit = 20 
  } = req.query;
  
  let sql = `SELECT a.*, 
             m.serial_number as meter_number,
             c.first_name, c.last_name, c.account_number,
             mr.current_reading, mr.previous_reading,
             mr.current_reading - mr.previous_reading as consumption,
             u.first_name as detected_by_first_name, u.last_name as detected_by_last_name
             FROM meter_reading_anomalies a
             LEFT JOIN meters m ON a.meter_id = m.id
             LEFT JOIN customers c ON m.customer_id = c.id
             LEFT JOIN meter_readings mr ON a.reading_id = mr.id
             LEFT JOIN users u ON a.detected_by = u.id
             WHERE 1=1`;
  const params = [];

  if (severity) { sql += ' AND a.severity = ?'; params.push(severity); }
  if (isResolved !== undefined) { sql += ' AND a.is_resolved = ?'; params.push(isResolved === 'true' ? 1 : 0); }
  if (meterId) { sql += ' AND a.meter_id = ?'; params.push(meterId); }

  const countResult = await executeQuery(
    `SELECT COUNT(*) as total FROM meter_reading_anomalies a WHERE 1=1 
     ${severity ? 'AND a.severity = ?' : ''} 
     ${isResolved !== undefined ? 'AND a.is_resolved = ?' : ''}
     ${meterId ? 'AND a.meter_id = ?' : ''}`,
    [...params]
  );
  const total = countResult[0].total;

  sql += ' ORDER BY a.detected_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const anomalies = await executeQuery(sql, params);

  res.json({
    success: true,
    data: anomalies,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// Get anomaly statistics
router.get('/stats/summary', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  // Overall stats
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_anomalies,
      SUM(CASE WHEN is_resolved = FALSE THEN 1 ELSE 0 END) as unresolved,
      SUM(CASE WHEN severity = 'critical' AND is_resolved = FALSE THEN 1 ELSE 0 END) as critical_unresolved,
      SUM(CASE WHEN severity = 'high' AND is_resolved = FALSE THEN 1 ELSE 0 END) as high_unresolved
    FROM meter_reading_anomalies
  `);

  // By type
  const byType = await executeQuery(`
    SELECT 
      anomaly_code,
      anomaly_name,
      COUNT(*) as count,
      SUM(CASE WHEN is_resolved = FALSE THEN 1 ELSE 0 END) as unresolved
    FROM meter_reading_anomalies
    GROUP BY anomaly_code, anomaly_name
    ORDER BY count DESC
  `);

  // Recent trend (last 30 days)
  const trend = await executeQuery(`
    SELECT 
      DATE(detected_at) as date,
      COUNT(*) as count
    FROM meter_reading_anomalies
    WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(detected_at)
    ORDER BY date DESC
  `);

  res.json({
    success: true,
    data: {
      overview: stats[0],
      byType,
      trend
    }
  });
}));

// Resolve anomaly
router.post('/:id/resolve', verifyToken, authorize('admin', 'manager', 'clerk'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolutionNotes, resolutionType } = req.body;

  await executeQuery(
    `UPDATE meter_reading_anomalies 
     SET is_resolved = TRUE, 
         resolved_at = CURRENT_TIMESTAMP,
         resolved_by = ?,
         resolution_notes = ?,
         resolution_type = ?
     WHERE id = ?`,
    [req.user.id, resolutionNotes || '', resolutionType || 'manual_review', id]
  );

  res.json({
    success: true,
    message: 'Anomaly resolved successfully'
  });
}));

// Bulk detect anomalies for all recent readings
router.post('/bulk-detect', verifyToken, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { billingPeriod } = req.body;

  // Get all readings for the period without anomaly checks
  const readings = await executeQuery(`
    SELECT 
      mr.id as reading_id,
      mr.meter_id,
      mr.current_reading,
      mr.previous_reading,
      mr.current_reading - mr.previous_reading as consumption,
      mr.is_estimated,
      m.customer_id
    FROM meter_readings mr
    JOIN meters m ON mr.meter_id = m.id
    WHERE DATE_FORMAT(mr.reading_date, '%Y-%m') = ?
    AND mr.id NOT IN (
      SELECT DISTINCT reading_id 
      FROM meter_reading_anomalies 
      WHERE reading_id IS NOT NULL
    )
  `, [billingPeriod || new Date().toISOString().slice(0, 7)]);

  let detectedCount = 0;

  for (const reading of readings) {
    // Get historical data
    const history = await executeQuery(
      `SELECT 
        current_reading - previous_reading as consumption
       FROM meter_readings
       WHERE meter_id = ?
       AND id != ?
       ORDER BY reading_date DESC
       LIMIT 6`,
      [reading.meter_id, reading.reading_id]
    );

    const current = {
      consumption: parseFloat(reading.consumption) || 0,
      reading: parseFloat(reading.current_reading) || 0,
      is_estimated: reading.is_estimated,
      reading_id: reading.reading_id
    };

    // Check each rule
    for (const [key, rule] of Object.entries(ANOMALY_RULES)) {
      if (rule.check(current, {}, history)) {
        await executeQuery(
          `INSERT INTO meter_reading_anomalies 
           (meter_id, reading_id, anomaly_code, anomaly_name, description, severity, detected_by, is_resolved)
           VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
          [
            reading.meter_id, 
            reading.reading_id, 
            rule.code, 
            rule.name, 
            rule.description, 
            rule.severity, 
            req.user.id
          ]
        );
        detectedCount++;
      }
    }
  }

  res.json({
    success: true,
    message: `Anomaly detection completed. ${detectedCount} anomalies detected.`,
    data: {
      readings_checked: readings.length,
      anomalies_detected: detectedCount
    }
  });
}));

module.exports = router;
