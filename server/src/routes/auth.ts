import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError, parse } from '../middleware/error.js';
import { clearSession, requireAuth, setSession, uid } from '../middleware/auth.js';
import { config } from '../config.js';
import { sendMail } from '../services/mail.js';

export const authRouter = Router();

const publicUser = (u: { id: string; email: string; name: string; locale: string; phone: string | null; createdAt: Date }) => ({
  id: u.id, email: u.email, name: u.name, locale: u.locale, phone: u.phone, createdAt: u.createdAt,
});

const password = z.string().min(8, 'Password must be at least 8 characters').max(128).regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number');
const email = z.string().trim().toLowerCase().email();

authRouter.post('/signup', ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(100), email, password, locale: z.enum(['en', 'ar']).optional() }), req.body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, 'An account with this email already exists');
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, locale: body.locale ?? 'en', passwordHash: await bcrypt.hash(body.password, 12) },
  });
  setSession(res, user.id);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post('/login', ah(async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1) }), req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
}));

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, ah(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: uid(req) } });
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
}));

authRouter.patch('/me', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(100).optional(), locale: z.enum(['en', 'ar']).optional(), phone: z.string().max(30).nullable().optional() }), req.body);
  const user = await prisma.user.update({ where: { id: uid(req) }, data: body });
  res.json({ user: publicUser(user) });
}));

authRouter.post('/change-password', requireAuth, ah(async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  res.json({ ok: true });
}));

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

authRouter.post('/forgot-password', ah(async (req, res) => {
  const body = parse(z.object({ email }), req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  let devResetUrl: string | undefined;
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) } });
    const url = `${config.webOrigin}/reset-password?token=${token}`;
    const sent = await sendMail(user.email, 'Smart Farm password reset', `Reset your password (valid for 1 hour): ${url}`);
    if (!sent && !config.isProd) {
      console.log(`[dev] Password reset link for ${user.email}: ${url}`);
      devResetUrl = url;
    }
  }
  res.json({ ok: true, message: 'If the email exists, a reset link has been sent.', ...(devResetUrl ? { devResetUrl } : {}) });
}));

authRouter.post('/reset-password', ah(async (req, res) => {
  const body = parse(z.object({ token: z.string().min(10), password }), req.body);
  const user = await prisma.user.findFirst({ where: { resetTokenHash: sha256(body.token), resetTokenExpires: { gt: new Date() } } });
  if (!user) throw new HttpError(400, 'Reset link is invalid or has expired');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.password, 12), resetTokenHash: null, resetTokenExpires: null } });
  res.json({ ok: true });
}));
