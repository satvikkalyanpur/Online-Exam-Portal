// US18: protecting credentials and exam data.
//
// Passwords are stored as bcrypt hashes (auth.ts), every API route checks the
// user's role (routes.ts), and students never receive correct answers before
// an exam has closed. This file adds browser security headers and slows down
// password guessing.
import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
}

/** API responses contain personal data, so browsers must not cache them. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

// After 5 wrong passwords for the same email from the same address, further
// attempts are refused for 15 minutes.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const failures = new Map<string, { count: number; firstAt: number }>();

function loginKey(email: string, ip: string | undefined) {
  return `${email}|${ip ?? ''}`;
}

/** Minutes left on a lock, or 0 if this email may try to log in. */
export function loginLockMinutes(email: string, ip: string | undefined): number {
  const entry = failures.get(loginKey(email, ip));
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAt;
  if (elapsed > LOCK_MS) {
    failures.delete(loginKey(email, ip));
    return 0;
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((LOCK_MS - elapsed) / 60_000) : 0;
}

export function recordLoginFailure(email: string, ip: string | undefined) {
  const key = loginKey(email, ip);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCK_MS) {
    failures.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(email: string, ip: string | undefined) {
  failures.delete(loginKey(email, ip));
}
