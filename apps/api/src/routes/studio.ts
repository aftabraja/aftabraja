import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit } from '../lib/notify.js';
import { buildDeck, DECK_TYPES } from '../data/deckTemplates.js';
import { CONTRACT_TEMPLATES, fillTemplate, LEGAL_DISCLAIMER } from '../data/contractTemplates.js';

/** Deck Studio + Legal Contract templates, mounted at /api/leagues/:leagueId/studio */
const r = Router({ mergeParams: true });
r.use(requireAuth);

const slideSchema = z.object({
  layout: z.enum(['cover', 'bullets', 'stats', 'table', 'closing']), title: z.string(), subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(), stats: z.array(z.object({ label: z.string(), value: z.string() })).optional(), rows: z.array(z.array(z.string())).optional(),
});

// ---------- Decks ----------
r.get('/decks/types', (_req, res) => res.json(DECK_TYPES));

r.get('/decks', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.deck.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { updatedAt: 'desc' }, select: { id: true, type: true, title: true, audience: true, updatedAt: true } }));
}));

r.post('/decks', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = z.object({ type: z.string(), audience: z.string().optional() }).parse(req.body);
  const t = DECK_TYPES.find((x) => x.key === d.type);
  if (!t) throw new HttpError(400, 'Unknown deck type');
  const l = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: { include: { owners: true } }, opportunities: { orderBy: { price: 'desc' } }, _count: { select: { registrations: true } } },
  });
  const slides = buildDeck(d.type, { ...l, registrations: l._count.registrations }, d.audience);
  const deck = await prisma.deck.create({ data: { leagueId, type: d.type, title: d.audience ? `${t.title} — ${d.audience}` : t.title, audience: d.audience, slides: slides as object[] } });
  await audit(me(req).id, 'create', 'Deck', deck.id);
  res.status(201).json(deck);
}));

r.get('/decks/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.deck.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } }));
}));

r.patch('/decks/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ title: z.string().optional(), slides: z.array(slideSchema).optional() }).parse(req.body);
  res.json(await prisma.deck.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: d }));
}));

r.delete('/decks/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.deck.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

// ---------- Contracts ----------
r.get('/contracts/templates', (_req, res) => res.json({
  disclaimer: LEGAL_DISCLAIMER,
  templates: CONTRACT_TEMPLATES.map(({ body: _b, ...t }) => t),
}));

r.get('/contracts', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.contract.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { updatedAt: 'desc' }, select: { id: true, templateKey: true, title: true, counterparty: true, status: true, version: true, expiresOn: true, updatedAt: true } }));
}));

r.post('/contracts', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = z.object({ templateKey: z.string(), counterparty: z.string().min(1), values: z.record(z.union([z.string(), z.number()])).default({}) }).parse(req.body);
  const c = await createContractDraft(leagueId, d.templateKey, d.counterparty, d.values);
  await audit(me(req).id, 'create', 'Contract', c.id, { template: d.templateKey });
  res.status(201).json(c);
}));

r.get('/contracts/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ...c, disclaimer: LEGAL_DISCLAIMER });
}));

r.patch('/contracts/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({
    title: z.string().optional(), body: z.string().optional(), counterparty: z.string().optional(),
    status: z.enum(['DRAFT', 'SENT', 'ARCHIVED']).optional(), acknowledge: z.boolean().optional(), note: z.string().optional(),
  }).parse(req.body);
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  const editing = d.title !== undefined || d.body !== undefined || d.counterparty !== undefined;
  if (editing && c.status !== 'DRAFT') throw new HttpError(400, c.status === 'SIGNED' ? 'Signed contracts are locked' : 'Only drafts can be edited — withdraw it to draft first');
  if (d.status && d.status !== c.status) {
    const ok = d.status === 'ARCHIVED'
      || (d.status === 'DRAFT' && ['UNDER_LEGAL_REVIEW', 'APPROVED', 'SENT'].includes(c.status))
      || (d.status === 'SENT' && c.status === 'APPROVED');
    if (!ok) throw new HttpError(400, `Cannot move a ${c.status.toLowerCase().replace(/_/g, ' ')} contract to ${d.status.toLowerCase()}`);
    if (d.status === 'SENT' && !c.acknowledgedAt && !d.acknowledge) throw new HttpError(400, 'Acknowledge the legal notice before sending');
  }
  const bodyChanged = (d.body !== undefined && d.body !== c.body) || (d.title !== undefined && d.title !== c.title);
  const version = bodyChanged ? c.version + 1 : c.version;
  const u = await prisma.contract.update({
    where: { id: c.id },
    data: { title: d.title, body: d.body, counterparty: d.counterparty, status: d.status, version, ...(d.acknowledge && { acknowledgedAt: new Date() }) },
  });
  if (bodyChanged) await prisma.contractVersion.create({ data: { contractId: c.id, version, title: u.title, body: u.body, savedBy: me(req).name, note: d.note } });
  if (d.acknowledge) await audit(me(req).id, 'acknowledge-legal-notice', 'Contract', c.id);
  if (d.status && d.status !== c.status) await audit(me(req).id, `status-${d.status.toLowerCase()}`, 'Contract', c.id);
  res.json({ ...u, disclaimer: LEGAL_DISCLAIMER });
}));

r.delete('/contracts/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.contract.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

/** Create a contract draft from a template (also used when a vendor quote is awarded) */
export async function createContractDraft(leagueId: string, templateKey: string, counterparty: string, values: Record<string, string | number>) {
  const t = CONTRACT_TEMPLATES.find((x) => x.key === templateKey);
  if (!t) throw new HttpError(400, 'Unknown template');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const fmt = (x: Date | null) => (x ? x.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const role = { franchise: 'Franchisee', player: 'Player', sponsorship: 'Sponsor', vendor: 'Vendor', venue: 'Venue Owner', broadcast: 'Broadcaster', nda: 'Recipient', 'image-release': 'Participant' }[t.key] ?? 'Counterparty';
  const body = fillTemplate(t.body, { league_name: l.name, season_start: fmt(l.startDate), season_end: fmt(l.endDate), counterparty, counterparty_role: role, ...values });
  const c = await prisma.contract.create({ data: { leagueId, templateKey: t.key, title: `${t.title} — ${counterparty}`, counterparty, body } });
  await prisma.contractVersion.create({ data: { contractId: c.id, version: 1, title: c.title, body: c.body, savedBy: 'Template', note: `Created from ${t.title}` } });
  return c;
}

export default r;
