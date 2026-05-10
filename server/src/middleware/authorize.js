// Role-based access control middleware factory
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        required: allowedRoles,
        current: role
      });
    }

    next();
  };
};

// Check if user has specific permission
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const rolePermissions = {
      admin: ['*'], // Admin has all permissions
      manager: [
        'users:read',
        'customers:read', 'customers:write',
        'meters:read', 'meters:write',
        'readings:read',
        'billing:read', 'billing:write',
        'payments:read', 'payments:write',
        'reports:read', 'reports:write',
        'settings:read',
        'zones:read', 'routes:read',
        'tariffs:read'
      ],
      clerk: [
        'customers:read', 'customers:write',
        'meters:read', 'meters:write',
        'readings:read', 'readings:write',
        'billing:read', 'billing:write',
        'payments:read',
        'zones:read', 'routes:read'
      ],
      cashier: [
        'customers:read',
        'payments:read', 'payments:write',
        'billing:read'
      ],
      reader: [
        'readings:read', 'readings:write',
        'routes:read'
      ]
    };

    const userPermissions = rolePermissions[req.user.role] || [];
    
    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ 
      message: 'Access denied. Missing required permission.',
      permission
    });
  };
};

// Check if user owns resource or is admin
const ownerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId === req.user.id) {
        return next();
      }

      return res.status(403).json({ message: 'Access denied. Not the resource owner.' });
    } catch (error) {
      console.error('Owner check error:', error);
      return res.status(500).json({ message: 'Error checking resource ownership' });
    }
  };
};

module.exports = {
  authorize,
  hasPermission,
  ownerOrAdmin
};
