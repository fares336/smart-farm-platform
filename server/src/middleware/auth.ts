import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const AUTH_COOKIE = 'sf_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function setSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: MAX_AGE_SEC });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: MAX_AGE_SEC * 1000,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = req.cookies?.[AUTH_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

export function uid(req: Request): string {
  if (!req.userId) throw new Error('requireAuth missing');
  return req.userId;
}
