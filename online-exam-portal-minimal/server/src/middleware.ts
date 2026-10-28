import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type AuthRequest = Request & { auth?: { id: string; role: Role } };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  const secret = process.env.JWT_SECRET;

  if (scheme !== 'Bearer' || !token || !secret) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, secret) as unknown as { sub: string; role: Role };
    req.auth = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'You do not have access to this feature' });
    }
    return next();
  };
}