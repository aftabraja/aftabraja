import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, signToken } from '../lib/auth.js';
import { PLAN_PRICES } from '../lib/util.js';
import { audit, notify } from '../lib/notify.js';
import { appUrl, layout, sendEmail } from '../lib/mailer.js';
import { consumeToken, issueToken } from '../lib/tokens.js';

const r = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  role: z.enum(['LEAGUE_OWNER', 'PLAYER', 'VENDOR', 'SPONSOR', 'TALENT_AGENT']),
  companyName: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  playingRole: z.string().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms of Service and Privacy Policy' }) }),
});

export async function publicUser(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, role: true, avatarUrl: true, createdAt: true,
      vendorProfile: { select: { id: true, companyName: true } },
      sponsorProfile: { select: { id: true, companyName: true } },
      agencyProfile: { select: { id: true, agencyName: true } },
      playerProfile: { select: { id: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}

r.post('/register', ah(async (req, res) => {
  const d = registerSchema.parse(req.body);
  const email = d.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');
  if ((d.role === 'VENDOR' || d.role === 'SPONSOR' || d.role === 'TALENT_AGENT') && !d.companyName) throw new HttpError(400, 'Company name is required');

  const user = await prisma.user.create({
    data: {
      name: d.name, email, phone: d.phone, role: d.role, acceptedTermsAt: new Date(),
      passwordHash: await bcrypt.hash(d.password, 10),
      subscriptions: {
        create: { plan: d.role, amount: PLAN_PRICES[d.role] ?? 0, status: 'TRIAL', validTill: new Date(Date.now() + 14 * 864e5) },
      },
      ...(d.role === 'VENDOR' && { vendorProfile: { create: { companyName: d.companyName!, city: d.city } } }),
      ...(d.role === 'SPONSOR' && { sponsorProfile: { create: { companyName: d.companyName!, city: d.city, industry: d.industry } } }),
      ...(d.role === 'TALENT_AGENT' && { agencyProfile: { create: { agencyName: d.companyName!, city: d.city } } }),
      ...(d.role === 'PLAYER' && { playerProfile: { create: { city: d.city, playingRole: d.playingRole } } }),
    },
  });
  await audit(user.id, 'register', 'User', user.id, { role: d.role });
  await sendEmail(email, 'Welcome to SportsIQ', layout(`Welcome, ${d.name}!`, '<p>Your SportsIQ account is ready. Your 14-day free trial has started.</p>', { label: 'Open SportsIQ', url: `${appUrl()}/login` }));
  res.status(201).json({ token: signToken(user), user: await publicUser(user.id) });
}));

r.post('/login', ah(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await audit(user?.id, 'login-failed', 'User', user?.id, { email: email.toLowerCase(), ip: req.ip });
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated');
  res.json({ token: signToken(user), user: await publicUser(user.id) });
}));

r.get('/me', requireAuth, ah(async (req, res) => {
  res.json(await publicUser(me(req).id));
}));

r.patch('/me', requireAuth, ah(async (req, res) => {
  const d = z.object({ name: z.string().min(2).optional(), phone: z.string().optional(), avatarUrl: z.string().optional() }).parse(req.body);
  await prisma.user.update({ where: { id: me(req).id }, data: d });
  res.json(await publicUser(me(req).id));
}));

r.post('/change-password', requireAuth, ah(async (req, res) => {
  const d = z.object({ current: z.string(), next: z.string().min(8) }).parse(req.body);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
  if (!(await bcrypt.compare(d.current, u.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(d.next, 10) } });
  res.json({ ok: true });
}));

// ---------- Password reset ----------
r.post('/forgot-password', ah(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Same response whether or not the account exists (prevents account discovery)
  if (user && user.isActive) {
    const token = await issueToken(user.id, 'RESET', 1);
    await sendEmail(user.email, 'Reset your SportsIQ password', layout('Reset your password', `<p>Hi ${user.name},</p><p>We received a request to reset your password. This link is valid for 1 hour and can be used once. If you didn't ask for this, you can ignore this email.</p>`, { label: 'Choose a new password', url: `${appUrl()}/reset-password?token=${token}` }));
    await audit(user.id, 'password-reset-requested', 'User', user.id);
  }
  res.json({ ok: true, message: 'If an account exists for this email, a reset link has been sent.' });
}));

// Used by both password reset and account invitations
r.post('/set-password', ah(async (req, res) => {
  const d = z.object({ token: z.string().min(20), password: z.string().min(8, 'Password must be at least 8 characters'), acceptTerms: z.boolean().optional() }).parse(req.body);
  const t = await consumeToken(d.token);
  if (t.purpose === 'INVITE' && !t.user.acceptedTermsAt && !d.acceptTerms) throw new HttpError(400, 'Please accept the Terms of Service and Privacy Policy');
  const user = await prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await bcrypt.hash(d.password, 10), ...(d.acceptTerms && { acceptedTermsAt: new Date() }) } });
  await prisma.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await audit(user.id, t.purpose === 'INVITE' ? 'invite-accepted' : 'password-reset', 'User', user.id);
  res.json({ token: signToken(user), user: await publicUser(user.id) });
}));

r.get('/token-info', ah(async (req, res) => {
  const { token } = z.object({ token: z.string() }).parse(req.query);
  const crypto = await import('node:crypto');
  const t = await prisma.authToken.findUnique({ where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') }, include: { user: { select: { name: true, email: true, acceptedTermsAt: true } } } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new HttpError(400, 'This link is invalid or has expired.');
  res.json({ purpose: t.purpose, name: t.user.name, email: t.user.email, needsTerms: t.purpose === 'INVITE' && !t.user.acceptedTermsAt });
}));

// ---------- DPDP: data access & erasure requests ----------
r.get('/me/export', requireAuth, ah(async (req, res) => {
  const id = me(req).id;
  const data = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, role: true, createdAt: true, acceptedTermsAt: true,
      playerProfile: { include: { registrations: true } }, vendorProfile: { include: { services: true } }, sponsorProfile: true, agencyProfile: { include: { talents: true } },
      subscriptions: true, notifications: true, messages: { select: { body: true, createdAt: true, conversationId: true } },
    },
  });
  res.setHeader('Content-Disposition', 'attachment; filename="sportsiq-my-data.json"');
  res.json({ exportedAt: new Date().toISOString(), ...data });
}));

r.post('/me/delete-request', requireAuth, ah(async (req, res) => {
  const u = await prisma.user.update({ where: { id: me(req).id }, data: { deletionRequestedAt: new Date() } });
  const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  await notify(admins.map((a) => a.id), `Account deletion requested: ${u.name}`, { body: u.email, link: '/admin/users', type: 'warning' });
  await audit(u.id, 'deletion-requested', 'User', u.id);
  res.json({ ok: true });
}));

export default r;
