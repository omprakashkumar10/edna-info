import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseConfig: { projectId?: string } = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
  }
} catch {
  firebaseConfig = {};
}

const projectId = firebaseConfig.projectId && firebaseConfig.projectId !== 'remixed-project-id'
  ? firebaseConfig.projectId
  : undefined;

const adminApp = projectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId })
  : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    emailVerified: boolean;
    isAdmin: boolean;
  };
}

const BOOTSTRAP_ADMIN_EMAIL = 'omprakash773919@gmail.com';

export function getAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  const fromEnv = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([BOOTSTRAP_ADMIN_EMAIL, ...fromEnv]));
}

export function isAllowlistedAdmin(email: string | undefined, emailVerified: boolean): boolean {
  if (!email || !emailVerified) return false;
  return getAdminAllowlist().includes(email.toLowerCase());
}

// In-memory login attempt rate limiter (lockout after 5 failed attempts in 15 min)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginAttempt(identifier: string): { allowed: boolean; remainingAttempts: number; retryAfterSec: number } {
  const key = identifier.toLowerCase().trim() || 'anonymous';
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  if (entry && entry.lockedUntil <= now && entry.lockedUntil > 0) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: 5, retryAfterSec: 0 };
  }
  const count = entry?.count || 0;
  return { allowed: true, remainingAttempts: Math.max(0, 5 - count), retryAfterSec: 0 };
}

export function recordFailedLoginAttempt(identifier: string): { locked: boolean; retryAfterSec: number; remainingAttempts: number } {
  const key = identifier.toLowerCase().trim() || 'anonymous';
  const now = Date.now();
  const existing = loginAttempts.get(key);
  const count = (existing && existing.lockedUntil === 0 ? existing.count : 0) + 1;
  if (count >= 5) {
    const lockedUntil = now + 15 * 60 * 1000;
    loginAttempts.set(key, { count, lockedUntil });
    return { locked: true, retryAfterSec: 900, remainingAttempts: 0 };
  }
  loginAttempts.set(key, { count, lockedUntil: 0 });
  return { locked: false, retryAfterSec: 0, remainingAttempts: 5 - count };
}

export function clearLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier.toLowerCase().trim());
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!adminApp) {
    res.status(503).json({ error: 'Firebase authentication is not configured on the server.' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Invalid Authorization token.' });
    return;
  }

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(idToken);
    const email = decoded.email || '';
    const emailVerified = Boolean(decoded.email_verified);
    req.user = {
      uid: decoded.uid,
      email,
      emailVerified,
      isAdmin: isAllowlistedAdmin(email, emailVerified),
    };
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed';
    res.status(401).json({ error: `Unauthorized: ${msg}` });
  }
}

export function verifyPasscodeScrypt(passcode: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(passcode, storedSalt, 64);
  const target = Buffer.from(storedHash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}
