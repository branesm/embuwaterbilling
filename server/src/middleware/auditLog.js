const { executeQuery } = require('../config/database');

// Audit log middleware
const auditLog = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json method to capture response
  res.json = function(data) {
    res.responseData = data;
    return originalJson(data);
  };

  // Capture request start time
  req.startTime = Date.now();

  // Continue to next middleware
  res.on('finish', async () => {
    try {
      // Only log mutating operations
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (!mutatingMethods.includes(req.method)) {
        return;
      }

      // Skip auth endpoints (except user creation)
      if (req.path.includes('/auth/login') || req.path.includes('/auth/refresh')) {
        return;
      }

      const userId = req.user?.id || null;
      const action = `${req.method} ${req.path}`;
      const entityType = req.path.split('/')[2] || 'unknown';
      const entityId = req.params.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Log to database (fire and forget)
      await executeQuery(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          action,
          entityType,
          entityId,
          JSON.stringify(req.body),
          JSON.stringify(res.responseData || {}),
          ipAddress,
          userAgent
        ]
      );
    } catch (error) {
      // Log error but don't fail the request
      console.error('Audit log error:', error);
    }
  });

  next();
};

// Manual audit log function for service layer
const logAudit = async ({
  userId,
  userType = 'staff',
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await executeQuery(
      `INSERT INTO audit_logs 
       (user_id, user_type, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        userType,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Manual audit log error:', error);
  }
};

module.exports = {
  auditLog,
  logAudit
};
