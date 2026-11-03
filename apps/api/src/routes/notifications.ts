import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const uid = me(req).id;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: uid, readAt: null } }),
  ]);
  res.json({ items, unread });
}));

r.post('/read-all', ah(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: me(req).id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

r.post('/:id/read', ah(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: me(req).id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

export default r;
