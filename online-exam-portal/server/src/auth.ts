// US01: login. US02: role-based access control.
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError } from './http.js';
import { logActivity } from './activityLog.js';
import { clearLoginFailures, loginLockMinutes, recordLoginFailure } from './security.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Makes `req.user` available (typed) after `requireAuth`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Long enough for a full day, so nobody is logged out in the middle of an exam.
const TOKEN_LIFETIME = '24h';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new HttpError(500, 'Server is not configured: JWT_SECRET is missing.');
  return secret;
}

/** POST /api/auth/login */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email and password are required.');
  }
  const cleanEmail = email.trim().toLowerCase();

  const lockMinutes = loginLockMinutes(cleanEmail, req.ip);
  if (lockMinutes > 0) {
    throw new HttpError(
      429,
      `Too many failed attempts. Try again in ${lockMinutes} minute${lockMinutes === 1 ? '' : 's'}.`
    );
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    recordLoginFailure(cleanEmail, req.ip);
    await logActivity(user?.id ?? null, 'LOGIN_FAILED', `Failed login for ${cleanEmail}`);
    // Same message either way, so the response doesn't reveal which emails exist.
    throw new HttpError(401, 'Invalid email or password.');
  }

  clearLoginFailures(cleanEmail, req.ip);
  const token = jwt.sign({ sub: user.id }, jwtSecret(), { expiresIn: TOKEN_LIFETIME });
  await logActivity(user.id, 'LOGIN', `${user.name} logged in`);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

/** POST /api/auth/logout — the token simply expires; this records the logout. */
export async function logout(req: Request, res: Response) {
  await logActivity(req.user!.id, 'LOGOUT', `${req.user!.name} logged out`);
  res.json({ message: 'Logged out.' });
}

/** GET /api/auth/me — used to restore the session after a page refresh. */
export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

/** Rejects the request with 401 unless it carries a valid token for an existing user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Please log in to continue.');
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, jwtSecret());
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') throw new Error('bad token');
    userId = payload.sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  // The role is read from the database, so a changed role takes effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new HttpError(401, 'Your account no longer exists.');

  req.user = user;
  next();
}

/** Rejects the request with 403 unless the logged-in user has one of the given roles. */
export function requireRole(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw new HttpError(401, 'Please log in to continue.');
    if (!roles.includes(user.role)) {
      await logActivity(user.id, 'ACCESS_DENIED', `${user.role} tried ${req.method} ${req.baseUrl}${req.path}`);
      throw new HttpError(403, 'You do not have permission to access this feature.');
    }
    next();
  };
}
