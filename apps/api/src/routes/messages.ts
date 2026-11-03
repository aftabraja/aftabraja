import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { notify } from '../lib/notify.js';

const r = Router();
r.use(requireAuth);

const userSel = { select: { id: true, name: true, role: true, vendorProfile: { select: { companyName: true } }, sponsorProfile: { select: { companyName: true } } } };

r.get('/', ah(async (req, res) => {
  const uid = me(req).id;
  const convos = await prisma.conversation.findMany({
    where: { participants: { some: { userId: uid } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: { include: { user: userSel } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      league: { select: { id: true, name: true } },
    },
  });
  res.json(convos.map((c) => {
    const mine = c.participants.find((p) => p.userId === uid);
    const last = c.messages[0];
    return { ...c, lastMessage: last ?? null, unread: !!last && last.senderId !== uid && (!mine?.lastReadAt || mine.lastReadAt < last.createdAt) };
  }));
}));

r.get('/unread-count', ah(async (req, res) => {
  const uid = me(req).id;
  const parts = await prisma.conversationParticipant.findMany({ where: { userId: uid }, include: { conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } } } });
  res.json({ count: parts.filter((p) => { const l = p.conversation.messages[0]; return l && l.senderId !== uid && (!p.lastReadAt || p.lastReadAt < l.createdAt); }).length });
}));

// Start (or reuse) a 1:1 conversation
r.post('/', ah(async (req, res) => {
  const d = z.object({ toUserId: z.string(), subject: z.string().optional(), leagueId: z.string().optional(), body: z.string().min(1) }).parse(req.body);
  const u = me(req);
  if (d.toUserId === u.id) throw new HttpError(400, 'You cannot message yourself');
  const to = await prisma.user.findUnique({ where: { id: d.toUserId } });
  if (!to) throw new HttpError(404, 'Recipient not found');
  let convo = await prisma.conversation.findFirst({
    where: { AND: [{ participants: { some: { userId: u.id } } }, { participants: { some: { userId: to.id } } }], leagueId: d.leagueId ?? null, participants: { every: { userId: { in: [u.id, to.id] } } } },
  });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { subject: d.subject, leagueId: d.leagueId, participants: { create: [{ userId: u.id }, { userId: to.id }] } } });
  }
  await prisma.message.create({ data: { conversationId: convo.id, senderId: u.id, body: d.body } });
  await prisma.conversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
  await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: convo.id, userId: u.id } }, data: { lastReadAt: new Date() } });
  await notify(to.id, `New message from ${u.name}`, { body: d.body.slice(0, 140), link: `/messages/${convo.id}` });
  res.status(201).json(convo);
}));

async function assertParticipant(conversationId: string, userId: string) {
  const p = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!p) throw new HttpError(404, 'Conversation not found');
}

r.get('/:cid', ah(async (req, res) => {
  const uid = me(req).id;
  if (me(req).role !== 'SUPER_ADMIN') await assertParticipant(req.params.cid, uid);
  const convo = await prisma.conversation.findUniqueOrThrow({
    where: { id: req.params.cid },
    include: { participants: { include: { user: userSel } }, messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } }, league: { select: { id: true, name: true } } },
  });
  await prisma.conversationParticipant.updateMany({ where: { conversationId: convo.id, userId: uid }, data: { lastReadAt: new Date() } });
  res.json(convo);
}));

r.post('/:cid/messages', ah(async (req, res) => {
  const u = me(req);
  await assertParticipant(req.params.cid, u.id);
  const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
  const msg = await prisma.message.create({ data: { conversationId: req.params.cid, senderId: u.id, body } });
  await prisma.conversation.update({ where: { id: req.params.cid }, data: { updatedAt: new Date() } });
  await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: req.params.cid, userId: u.id } }, data: { lastReadAt: new Date() } });
  const others = await prisma.conversationParticipant.findMany({ where: { conversationId: req.params.cid, userId: { not: u.id } } });
  await notify(others.map((o) => o.userId), `New message from ${u.name}`, { body: body.slice(0, 140), link: `/messages/${req.params.cid}` });
  res.status(201).json(msg);
}));

export default r;
