import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { audit, notify } from '../lib/notify.js';

/**
 * Talent marketplace: agencies / managers list the cricketers they represent (active and retired).
 * Brands send endorsement enquiries; leagues hire legends for league seasons or appearances.
 * Mounted at /api/talent
 */
const r = Router();
r.use(requireAuth);

export const AUTHORISATION_TEXT =
  'I confirm that I (or my agency) hold a valid written agreement with this player authorising me to represent them and to publish their name, image, profile and availability on SportsIQ, and that the information is accurate. I will remove the profile immediately if that authorisation ends.';

const PURPOSES = ['ENDORSEMENT', 'LEAGUE', 'APPEARANCE'] as const;
const agentSel = { agency: { select: { id: true, agencyName: true, kind: true, city: true, verified: true, userId: true } } };

// ---------- Discovery (brands, leagues, admins) ----------
r.get('/', ah(async (req, res) => {
  const q = z.object({
    q: z.string().optional(), status: z.enum(['ACTIVE', 'RETIRED']).optional(), purpose: z.enum(PURPOSES).optional(),
    role: z.string().optional(), maxFee: z.coerce.number().optional(), verified: z.enum(['true']).optional(),
  }).parse(req.query);
  const feeField = q.purpose === 'LEAGUE' ? 'leagueFeeMin' : q.purpose === 'APPEARANCE' ? 'appearanceFeeMin' : 'endorseFeeMin';
  const where: Prisma.TalentWhereInput = {
    isPublished: true, authorisedAt: { not: null }, agency: { user: { isActive: true } },
    ...(q.status && { status: q.status }),
    ...(q.purpose === 'ENDORSEMENT' && { forEndorsement: true }),
    ...(q.purpose === 'LEAGUE' && { forLeagues: true }),
    ...(q.purpose === 'APPEARANCE' && { forAppearances: true }),
    ...(q.role && { playingRole: q.role }),
    ...(q.verified && { verified: true }),
    ...(q.maxFee && { OR: [{ [feeField]: { lte: q.maxFee } }, { [feeField]: null }] }),
    ...(q.q && { AND: [{ OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { bio: { contains: q.q, mode: 'insensitive' } }, { teamsPlayed: { has: q.q } }, { state: { contains: q.q, mode: 'insensitive' } }] }] }),
  };
  res.json(await prisma.talent.findMany({ where, include: agentSel, orderBy: [{ verified: 'desc' }, { followers: 'desc' }, { matches: 'desc' }], take: 200 }));
}));

// ---------- Agent workspace ----------
r.get('/me/workspace', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const agency = await prisma.agencyProfile.findUnique({ where: { userId: me(req).id }, include: { talents: { orderBy: { createdAt: 'desc' } } } });
  if (!agency) throw new HttpError(404, 'Agency profile not found');
  const enquiries = await prisma.talentEnquiry.findMany({
    where: { talent: { agencyId: agency.id } }, orderBy: { createdAt: 'desc' },
    include: { talent: { select: { id: true, name: true } }, fromUser: { select: { id: true, name: true, role: true, sponsorProfile: { select: { companyName: true } } } } },
  });
  res.json({ agency, enquiries, authorisationText: AUTHORISATION_TEXT });
}));

r.patch('/me/agency', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const d = z.object({ agencyName: z.string().min(2).optional(), kind: z.enum(['Agency', 'Personal manager']).optional(), city: z.string().nullable().optional(), website: z.string().nullable().optional(), description: z.string().nullable().optional() }).parse(req.body);
  res.json(await prisma.agencyProfile.update({ where: { userId: me(req).id }, data: d }));
}));

const fee = z.coerce.number().int().min(0).nullable().optional();
const talentSchema = z.object({
  name: z.string().min(2), photoUrl: z.string().nullable().optional(), status: z.enum(['ACTIVE', 'RETIRED']).default('ACTIVE'),
  playingRole: z.string().nullable().optional(), battingStyle: z.string().nullable().optional(), bowlingStyle: z.string().nullable().optional(),
  country: z.string().default('India'), state: z.string().nullable().optional(), bornYear: z.coerce.number().int().min(1930).max(2015).nullable().optional(),
  bio: z.string().nullable().optional(), highlights: z.array(z.string()).default([]), teamsPlayed: z.array(z.string()).default([]), levels: z.array(z.string()).default([]),
  matches: z.coerce.number().int().min(0).default(0), runs: z.coerce.number().int().min(0).default(0), wickets: z.coerce.number().int().min(0).default(0),
  followers: z.coerce.number().int().min(0).nullable().optional(), languages: z.array(z.string()).default([]),
  forEndorsement: z.boolean().default(true), forLeagues: z.boolean().default(false), forAppearances: z.boolean().default(true),
  endorseFeeMin: fee, endorseFeeMax: fee, leagueFeeMin: fee, leagueFeeMax: fee, appearanceFeeMin: fee, appearanceFeeMax: fee,
  brandRestrictions: z.string().nullable().optional(),
});

async function myAgency(userId: string) {
  const a = await prisma.agencyProfile.findUnique({ where: { userId } });
  if (!a) throw new HttpError(404, 'Agency profile not found');
  return a;
}

r.post('/me/talents', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const a = await myAgency(me(req).id);
  const t = await prisma.talent.create({ data: { ...talentSchema.parse(req.body), agencyId: a.id } });
  await audit(me(req).id, 'create', 'Talent', t.id);
  res.status(201).json(t);
}));

r.patch('/me/talents/:id', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const a = await myAgency(me(req).id);
  // Material profile changes send the profile back for verification
  const t = await prisma.talent.update({ where: { id: req.params.id, agencyId: a.id }, data: { ...talentSchema.partial().parse(req.body), verified: false } });
  res.json(t);
}));

r.post('/me/talents/:id/publish', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const a = await myAgency(me(req).id);
  const { publish, authorised } = z.object({ publish: z.boolean(), authorised: z.boolean().optional() }).parse(req.body);
  const cur = await prisma.talent.findFirst({ where: { id: req.params.id, agencyId: a.id } });
  if (!cur) throw new HttpError(404, 'Player not found');
  if (publish && !cur.authorisedAt && !authorised) throw new HttpError(400, 'Confirm that you are authorised to represent this player before publishing');
  if (publish && !cur.photoUrl) throw new HttpError(400, 'Add a profile photo before publishing');
  if (publish && !cur.forEndorsement && !cur.forLeagues && !cur.forAppearances) throw new HttpError(400, 'Choose at least one availability');
  const t = await prisma.talent.update({ where: { id: cur.id }, data: { isPublished: publish, ...(authorised && !cur.authorisedAt && { authorisedAt: new Date() }) } });
  await audit(me(req).id, publish ? 'publish' : 'unpublish', 'Talent', t.id, { authorised: !!t.authorisedAt });
  res.json(t);
}));

r.delete('/me/talents/:id', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const a = await myAgency(me(req).id);
  await prisma.talent.delete({ where: { id: req.params.id, agencyId: a.id } });
  res.json({ ok: true });
}));

r.patch('/enquiries/:id', requireRole('TALENT_AGENT'), ah(async (req, res) => {
  const a = await myAgency(me(req).id);
  const { status } = z.object({ status: z.enum(['NEW', 'IN_DISCUSSION', 'CONFIRMED', 'DECLINED']) }).parse(req.body);
  const e = await prisma.talentEnquiry.findFirst({ where: { id: req.params.id, talent: { agencyId: a.id } }, include: { talent: true } });
  if (!e) throw new HttpError(404, 'Enquiry not found');
  const u = await prisma.talentEnquiry.update({ where: { id: e.id }, data: { status } });
  await notify(e.fromUserId, `${e.talent.name}: enquiry ${status.replace('_', ' ').toLowerCase()}`, { link: e.conversationId ? `/messages/${e.conversationId}` : '/talent', type: status === 'DECLINED' ? 'warning' : 'success' });
  res.json(u);
}));

// Enquiries I have sent (brands / leagues)
r.get('/enquiries/sent', ah(async (req, res) => {
  res.json(await prisma.talentEnquiry.findMany({ where: { fromUserId: me(req).id }, orderBy: { createdAt: 'desc' }, include: { talent: { select: { id: true, name: true, photoUrl: true, agency: { select: { agencyName: true } } } } } }));
}));

r.get('/:id', ah(async (req, res) => {
  const t = await prisma.talent.findUnique({ where: { id: req.params.id }, include: agentSel });
  if (!t) throw new HttpError(404, 'Player not found');
  const u = me(req);
  if (!t.isPublished && u.role !== 'SUPER_ADMIN' && t.agency.userId !== u.id) throw new HttpError(404, 'Player not found');
  res.json(t);
}));

// Brands / leagues contact the agent
r.post('/:id/enquiries', ah(async (req, res) => {
  const u = me(req);
  if (u.role === 'TALENT_AGENT' || u.role === 'PLAYER') throw new HttpError(403, 'Only brands and leagues can send enquiries');
  const d = z.object({ purpose: z.enum(PURPOSES), organisation: z.string().optional(), leagueId: z.string().optional(), budget: z.coerce.number().int().min(0).optional(), dates: z.string().optional(), message: z.string().min(10) }).parse(req.body);
  const t = await prisma.talent.findFirst({ where: { id: req.params.id, isPublished: true }, include: { agency: true } });
  if (!t) throw new HttpError(404, 'Player not found');
  const allowed = { ENDORSEMENT: t.forEndorsement, LEAGUE: t.forLeagues, APPEARANCE: t.forAppearances }[d.purpose];
  if (!allowed) throw new HttpError(400, `${t.name} is not available for this right now`);
  const label = { ENDORSEMENT: 'Endorsement', LEAGUE: 'League signing', APPEARANCE: 'Appearance' }[d.purpose];
  const body = [`${label} enquiry for ${t.name}`, d.organisation && `From: ${d.organisation}`, d.budget && `Budget: ₹${d.budget.toLocaleString('en-IN')}`, d.dates && `Dates: ${d.dates}`, '', d.message].filter((x) => x !== undefined && x !== '').join('\n');
  const convo = await prisma.conversation.create({
    data: { subject: `${label}: ${t.name}`, leagueId: d.leagueId, participants: { create: [{ userId: u.id, lastReadAt: new Date() }, { userId: t.agency.userId }] }, messages: { create: { senderId: u.id, body } } },
  });
  const e = await prisma.talentEnquiry.create({ data: { ...d, talentId: t.id, fromUserId: u.id, conversationId: convo.id } });
  await notify(t.agency.userId, `New ${label.toLowerCase()} enquiry for ${t.name}`, { body: `${d.organisation ?? u.name}${d.budget ? ` · ₹${d.budget.toLocaleString('en-IN')}` : ''}`, link: `/messages/${convo.id}`, type: 'success' });
  res.status(201).json({ enquiry: e, conversationId: convo.id });
}));

export default r;
