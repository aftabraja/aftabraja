import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, signToken } from '../lib/auth.js';
import { PLAN_PRICES } from '../lib/util.js';
import { audit } from '../lib/notify.js';

const r = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  role: z.enum(['LEAGUE_OWNER', 'PLAYER', 'VENDOR', 'SPONSOR']),
  companyName: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  playingRole: z.string().optional(),
});

export async function publicUser(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, email: true, name: true, phone: true, role: true, avatarUrl: true, createdAt: true,
      vendorProfile: { select: { id: true, companyName: true } },
      sponsorProfile: { select: { id: true, companyName: true } },
      playerProfile: { select: { id: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}

r.post('/register', ah(async (req, res) => {
  const d = registerSchema.parse(req.body);
  const email = d.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');
  if ((d.role === 'VENDOR' || d.role === 'SPONSOR') && !d.companyName) throw new HttpError(400, 'Company name is required');

  const user = await prisma.user.create({
    data: {
      name: d.name, email, phone: d.phone, role: d.role,
      passwordHash: await bcrypt.hash(d.password, 10),
      subscriptions: {
        create: { plan: d.role, amount: PLAN_PRICES[d.role] ?? 0, status: 'TRIAL', validTill: new Date(Date.now() + 14 * 864e5) },
      },
      ...(d.role === 'VENDOR' && { vendorProfile: { create: { companyName: d.companyName!, city: d.city } } }),
      ...(d.role === 'SPONSOR' && { sponsorProfile: { create: { companyName: d.companyName!, city: d.city, industry: d.industry } } }),
      ...(d.role === 'PLAYER' && { playerProfile: { create: { city: d.city, playingRole: d.playingRole } } }),
    },
  });
  await audit(user.id, 'register', 'User', user.id, { role: d.role });
  res.status(201).json({ token: signToken(user), user: await publicUser(user.id) });
}));

r.post('/login', ah(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
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

export default r;
