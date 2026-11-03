import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { checkJersey, JERSEY_SLOTS } from '../lib/jersey.js';

/** Jersey studio: rules, designs, approval workflow, and hand-off to jersey printers. /api/leagues/:leagueId/jerseys */
const r = Router({ mergeParams: true });
r.use(requireAuth);

async function rules(leagueId: string) {
  return (await prisma.jerseyRules.findUnique({ where: { leagueId } })) ?? prisma.jerseyRules.create({ data: { leagueId, maxSizes: { FRONT_CHEST: '25 × 10 cm', SLEEVE_LEFT: '8 × 6 cm', SLEEVE_RIGHT: '8 × 6 cm', LOWER_FRONT: '18 × 6 cm', BACK_TOP: '20 × 6 cm', BACK_BOTTOM: '20 × 6 cm', CHEST_LEFT: '8 × 8 cm', CHEST_RIGHT: '8 × 8 cm' } } });
}

/** Team owners may only work on their own team's designs */
async function canEdit(userId: string, access: string, leagueId: string, teamId: string | null) {
  if (access !== 'team') return true;
  if (!teamId) return false;
  return !!(await prisma.teamOwner.findFirst({ where: { teamId, userId, team: { leagueId } } }));
}

r.get('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const myTeams = access === 'team' ? (await prisma.teamOwner.findMany({ where: { userId: u.id, team: { leagueId } } })).map((o) => o.teamId) : null;
  const [designs, rl, league, teams, sold] = await Promise.all([
    prisma.jerseyDesign.findMany({ where: { leagueId, ...(myTeams && { teamId: { in: myTeams } }) }, orderBy: { updatedAt: 'desc' } }),
    rules(leagueId),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { name: true, shortCode: true, logoUrl: true } }),
    prisma.team.findMany({ where: { leagueId, ...(myTeams && { id: { in: myTeams } }) }, select: { id: true, name: true, shortName: true, logoUrl: true, color: true }, orderBy: { name: 'asc' } }),
    prisma.sponsorshipOpportunity.findMany({ where: { leagueId, status: { in: ['SOLD', 'IN_DISCUSSION'] } }, select: { id: true, title: true, tier: true, status: true } }),
  ]);
  res.json({ designs, rules: rl, league, teams, slots: JERSEY_SLOTS, sponsorships: sold, access });
}));

r.put('/rules', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const slotKeys = JERSEY_SLOTS.map((s) => s.key) as [string, ...string[]];
  const d = z.object({ leagueLogoSlot: z.enum(slotKeys), teamLogoSlot: z.enum(slotKeys), sponsorSlots: z.array(z.enum(slotKeys)), maxSizes: z.record(z.string()), notes: z.string().nullable().optional() }).parse(req.body);
  if (d.leagueLogoSlot === d.teamLogoSlot) throw new HttpError(400, 'League and team logos need different positions');
  const sponsorSlots = d.sponsorSlots.filter((s) => s !== d.leagueLogoSlot && s !== d.teamLogoSlot);
  await rules(leagueId);
  res.json(await prisma.jerseyRules.update({ where: { leagueId }, data: { ...d, sponsorSlots } }));
}));

const designSchema = z.object({
  teamId: z.string().nullable().optional(), name: z.string().min(2), kit: z.enum(['HOME', 'AWAY', 'ALTERNATE', 'TRAINING']).default('HOME'),
  template: z.enum(['classic', 'sash', 'panels', 'hoops', 'gradient', 'chevron']).default('classic'),
  colors: z.object({ body: z.string(), sleeves: z.string(), collar: z.string(), accent: z.string(), text: z.string() }),
  sponsors: z.array(z.object({ slot: z.string(), name: z.string().min(1), logoUrl: z.string().nullable().optional(), opportunityId: z.string().nullable().optional() })).default([]),
  sampleName: z.string().max(14).default('PLAYER'), sampleNumber: z.string().max(3).default('10'),
  roster: z.array(z.object({ name: z.string(), number: z.string().max(3), size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']) })).default([]),
  extraSizes: z.record(z.coerce.number().int().min(0)).default({}),
});

r.post('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const d = designSchema.parse(req.body);
  if (!(await canEdit(u.id, access, leagueId, d.teamId ?? null))) throw new HttpError(403, 'You can only design kits for your own team');
  res.status(201).json(await prisma.jerseyDesign.create({ data: { ...d, leagueId, createdById: u.id } }));
}));

r.get('/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const d = await prisma.jerseyDesign.findFirst({ where: { id: req.params.id, leagueId } });
  if (!d || !(await canEdit(u.id, access, leagueId, d.teamId))) throw new HttpError(404, 'Design not found');
  const rl = await rules(leagueId);
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { logoUrl: true } });
  res.json({ ...d, issues: checkJersey(d as never, rl, !!league.logoUrl) });
}));

r.patch('/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const cur = await prisma.jerseyDesign.findFirst({ where: { id: req.params.id, leagueId } });
  if (!cur || !(await canEdit(u.id, access, leagueId, cur.teamId))) throw new HttpError(404, 'Design not found');
  if (cur.status === 'SUBMITTED' && access === 'team') throw new HttpError(400, 'This design is waiting for league approval');
  const d = designSchema.partial().parse(req.body);
  // Editing an approved design creates a new version that must be approved again
  const reopened = cur.status === 'APPROVED' || cur.status === 'SUBMITTED';
  res.json(await prisma.jerseyDesign.update({ where: { id: cur.id }, data: { ...d, ...(reopened && { status: 'DRAFT', version: cur.version + 1, approvedAt: null, approvedById: null }) } }));
}));

r.delete('/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const cur = await prisma.jerseyDesign.findFirst({ where: { id: req.params.id, leagueId } });
  if (!cur || !(await canEdit(u.id, access, leagueId, cur.teamId))) throw new HttpError(404, 'Design not found');
  await prisma.jerseyDesign.delete({ where: { id: cur.id } });
  res.json({ ok: true });
}));

r.post('/:id/submit', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const d = await prisma.jerseyDesign.findFirst({ where: { id: req.params.id, leagueId } });
  if (!d || !(await canEdit(u.id, access, leagueId, d.teamId))) throw new HttpError(404, 'Design not found');
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const issues = checkJersey(d as never, await rules(leagueId), !!league.logoUrl).filter((i) => i.level === 'error');
  if (issues.length) throw new HttpError(400, `Fix before submitting: ${issues.map((i) => i.message).join('; ')}`);
  await prisma.jerseyDesign.update({ where: { id: d.id }, data: { status: 'SUBMITTED', reviewNote: null } });
  await notify(await leagueManagers(leagueId), `Jersey design submitted: ${d.name}`, { body: `v${d.version} by ${u.name}`, link: `/leagues/${leagueId}/jerseys/${d.id}`, type: 'info' });
  res.json({ ok: true });
}));

r.post('/:id/review', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const { decision, note } = z.object({ decision: z.enum(['APPROVE', 'CHANGES']), note: z.string().optional() }).parse(req.body);
  const d = await prisma.jerseyDesign.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (d.status !== 'SUBMITTED') throw new HttpError(400, 'Only submitted designs can be reviewed');
  if (decision === 'CHANGES' && !note) throw new HttpError(400, 'Tell the designer what to change');
  await prisma.jerseyDesign.update({ where: { id: d.id }, data: decision === 'APPROVE' ? { status: 'APPROVED', approvedById: u.id, approvedAt: new Date(), reviewNote: note ?? null } : { status: 'CHANGES_REQUESTED', reviewNote: note } });
  await notify(d.createdById, decision === 'APPROVE' ? `Jersey approved: ${d.name}` : `Changes requested: ${d.name}`, { body: note, link: `/leagues/${leagueId}/jerseys/${d.id}`, type: decision === 'APPROVE' ? 'success' : 'warning' });
  if (decision === 'APPROVE') await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'jersey-design' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'jersey-design', status: 'DONE' } });
  await audit(u.id, `jersey-${decision.toLowerCase()}`, 'JerseyDesign', d.id);
  res.json({ ok: true });
}));

/** Approved design → RFQ to jersey printers with the production files attached */
r.post('/:id/send-to-vendors', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const b = z.object({ vendorIds: z.array(z.string()).default([]), inviteAll: z.boolean().default(false), neededBy: z.coerce.date().nullable().optional(), files: z.array(z.string()).default([]), specs: z.string().min(5) }).parse(req.body);
  const d = await prisma.jerseyDesign.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (d.status !== 'APPROVED') throw new HttpError(400, 'Only approved designs can go to production');
  const cat = await prisma.vendorCategory.findUniqueOrThrow({ where: { slug: 'jersey-printing' } });
  let ids = b.vendorIds;
  if (b.inviteAll) ids = [...new Set([...ids, ...(await prisma.vendorProfile.findMany({ where: { services: { some: { categoryId: cat.id } }, user: { isActive: true } }, select: { id: true } })).map((v) => v.id)])];
  if (!ids.length) throw new HttpError(400, 'Choose at least one jersey printer');
  const roster = (d.roster as { size: string }[]) ?? [];
  const extra = (d.extraSizes as Record<string, number>) ?? {};
  const qty = roster.length + Object.values(extra).reduce((a, n) => a + n, 0);
  const n = await prisma.rfq.aggregate({ where: { leagueId }, _max: { number: true } });
  const rfq = await prisma.rfq.create({ data: { leagueId, number: (n._max.number ?? 0) + 1, title: `Jersey printing — ${d.name} (v${d.version})`, categorySlug: 'jersey-printing', specs: b.specs, quantity: `${qty} pieces`, neededBy: b.neededBy ?? null, attachments: b.files, createdById: u.id, invites: { create: ids.map((vendorId) => ({ vendorId })) } } });
  await prisma.jerseyDesign.update({ where: { id: d.id }, data: { rfqId: rfq.id } });
  const vendors = await prisma.vendorProfile.findMany({ where: { id: { in: ids } }, select: { userId: true } });
  await notify(vendors.map((v) => v.userId), `New jersey printing request: ${d.name}`, { body: `${qty} pieces · design files attached`, link: '/vendor?tab=rfqs', type: 'success' });
  res.status(201).json({ rfqId: rfq.id });
}));

export default r;
