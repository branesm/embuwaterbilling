import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { queryOne } from '../config/database';

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  next();
};

export const requirePermission = (module: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const group = await queryOne<{ permissions: Record<string, string[]> }>(
      'SELECT permissions FROM user_groups WHERE id = $1',
      [req.user.group_id]
    );

    if (!group) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const permissions = group.permissions || {};
    const modulePerms = permissions[module] || [];
    
    if (modulePerms.includes(action) || modulePerms.includes('all')) {
      next();
      return;
    }

    res.status(403).json({ success: false, message: `Permission denied: ${module}.${action}` });
  };
};

export const requireRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const group = await queryOne<{ name: string }>(
      'SELECT name FROM user_groups WHERE id = $1',
      [req.user.group_id]
    );

    if (!group || !roles.includes(group.name)) {
      res.status(403).json({ success: false, message: 'Role access denied' });
      return;
    }

    next();
  };
};
