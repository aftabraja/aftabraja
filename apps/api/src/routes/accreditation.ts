import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';

/**
 * Accreditation: zones, categories, applications, approval rules, card design, batch printing,
 * issue / revoke / reprint, and zone-gate verification. Mounted at /api/leagues/:leagueId/accreditation
 */
const r = Router({ mergeParams: true });
r.use(requireAuth);

// ---------- Defaults based on common tournament accreditation practice ----------
export const DEFAULT_ZONES = [
  { code: '1', name: 'Field of Play', description: 'Playing area, boundary, sight-screens and dugouts' },
  { code: '2', name: "Players' & Match Officials' Area (PMOA)", description: 'Dressing rooms, player balconies, team dining' },
  { code: '3', name: "Match Officials' Room", description: 'Umpires, referee and third-umpire rooms' },
  { code: '4', name: 'Media Centre & Press Box', description: 'Press conference room, media workroom, photographers' },
  { code: '5', name: 'Broadcast Compound & Commentary', description: 'OB vans, production, commentary box, camera positions' },
  { code: '6', name: 'Hospitality & VIP', description: 'VIP boxes, sponsor lounges, presentation area' },
  { code: '7', name: 'Venue Operations / Back-of-house', description: 'Control room, stores, vendor and catering areas' },
  { code: '8', name: 'Spectator Areas', description: 'All public stands and concourses' },
  { code: 'P', name: 'Accredited Parking', description: 'Team, officials and VIP parking' },
];

export const DEFAULT_CATEGORIES = [
  { name: 'Player', letter: 'P', color: '#1d4ed8', zones: ['1', '2', '8'], requiresIdCheck: true, selfApply: false },
  { name: 'Team Official', letter: 'TO', color: '#0e7490', zones: ['1', '2', '8'], requiresIdCheck: true, selfApply: false },
  { name: 'Match Official', letter: 'MO', color: '#111827', zones: ['1', '2', '3', '8', 'P'], requiresIdCheck: true, selfApply: false },
  { name: 'League Management', letter: 'LM', color: '#b91c1c', zones: ['1', '2', '4', '5', '6', '7', '8', 'P'], requiresIdCheck: true, selfApply: false },
  { name: 'Media', letter: 'M', color: '#d97706', zones: ['4', '8'], requiresIdCheck: true, selfApply: true },
  { name: 'Broadcast', letter: 'B', color: '#7c3aed', zones: ['1', '5', '8'], requiresIdCheck: true, selfApply: true },
  { name: 'Sponsor / VIP', letter: 'V', color: '#be185d', zones: ['6', '8', 'P'], requiresIdCheck: false, selfApply: false },
  { name: 'Vendor / Contractor', letter: 'C', color: '#475569', zones: ['7', '8'], requiresIdCheck: true, selfApply: true },
  { name: 'Security', letter: 'S', color: '#15803d', zones: ['1', '2', '4', '5', '6', '7', '8', 'P'], requiresIdCheck: true, selfApply: false },
  { name: 'Medical', letter: 'MED', color: '#dc2626', zones: ['1', '2', '8'], requiresIdCheck: true, selfApply: false },
  { name: 'Volunteer', letter: 'VOL', color: '#65a30d', zones: ['7', '8'], requiresIdCheck: true, selfApply: true },
  { name: 'Guest', letter: 'G', color: '#64748b', zones: ['8'], requiresIdCheck: false, selfApply: false },
];

export const DEFAULT_POLICY = `ACCREDITATION TERMS & CONDITIONS

1. Accreditation is issued at the discretion of the League and remains the property of the League at all times.
2. Accreditation is personal and non-transferable. It is valid only for the holder whose photograph appears on it.
3. The card must be worn visibly at all times while inside the venue and produced on request with a government photo ID.
4. The card grants access only to the zones printed on it, during the validity dates shown. Access may be further restricted for operational or security reasons.
5. The holder must follow the instructions of venue security and League officials and consents to security checks.
6. Players' & Match Officials' Area (PMOA) rules apply: unauthorised persons must not enter, and use of mobile phones there is restricted as per the League's anti-corruption code.
7. Loss or theft must be reported immediately. The lost card is deactivated and a replacement is issued with a new version; the old card will no longer work.
8. Misuse, alteration, duplication or transfer of a card leads to immediate cancellation, removal from the venue and possible further action.
9. The holder must not engage in commercial activity, ambush marketing or unauthorised filming using this accreditation.
10. Personal data (name, photo, organisation, ID type and last 4 digits of the ID) is collected only to process accreditation and venue security and is deleted after the season, unless retention is required by law.`;

export const DEFAULT_BACK = 'This card is the property of the League and is non-transferable. Wear it visibly at all times. Access only to the zones shown. If found, please return to the League office.';

export async function ensureSetup(leagueId: string) {
  const cfg = await prisma.accredConfig.findUnique({ where: { leagueId } });
  if (cfg) return cfg;
  await prisma.accredZone.createMany({ data: DEFAULT_ZONES.map((z, i) => ({ ...z, leagueId, sort: i })), skipDuplicates: true });
  await prisma.accredCategory.createMany({ data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, leagueId, sort: i })) });
  return prisma.accredConfig.create({ data: { leagueId, policy: DEFAULT_POLICY, backText: DEFAULT_BACK } });
}

const newCode = () => 'AC' + crypto.randomBytes(5).toString('hex').toUpperCase();
export const qrPayload = (a: { code: string; version: number }) => `${a.code}.${a.version}`;

async function nextCardNo(leagueId: string) {
  const m = await prisma.accreditation.aggregate({ where: { leagueId }, _max: { cardNo: true } });
  return (m._max.cardNo ?? 1000) + 1;
}

/** Approval rules — returns a list of reasons the record cannot be approved yet */
export function approvalBlockers(a: { photoUrl: string | null; zones: string[]; idVerified: boolean; idType: string | null; validFrom: Date | null; validTo: Date | null }, cat: { requiresIdCheck: boolean }) {
  const out: string[] = [];
  if (!a.photoUrl) out.push('A passport-style photo is required');
  if (!a.zones.length) out.push('At least one access zone is required');
  if (cat.requiresIdCheck && (!a.idType || !a.idVerified)) out.push('Government photo ID must be verified for this category');
  if (!a.validFrom || !a.validTo) out.push('Validity dates are required');
  else if (a.validTo < a.validFrom) out.push('Valid-to date must be after valid-from date');
  return out;
}

// ---------- Setup & config ----------
r.get('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const config = await ensureSetup(leagueId);
  const [zones, categories, list, league] = await Promise.all([
    prisma.accredZone.findMany({ where: { leagueId }, orderBy: { sort: 'asc' } }),
    prisma.accredCategory.findMany({ where: { leagueId }, orderBy: { sort: 'asc' } }),
    prisma.accreditation.findMany({ where: { leagueId }, orderBy: { cardNo: 'desc' }, include: { category: true } }),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { name: true, shortCode: true, logoUrl: true, primaryColor: true, startDate: true, endDate: true, slug: true, teams: { select: { id: true, name: true } } } }),
  ]);
  const count = (s: string) => list.filter((a) => a.status === s).length;
  res.json({
    config, zones, categories, league,
    accreditations: list.map((a) => ({ ...a, blockers: approvalBlockers(a, a.category) })),
    summary: { total: list.length, applied: count('APPLIED'), approved: count('APPROVED'), printed: count('PRINTED'), issued: count('ISSUED'), revoked: count('REVOKED'), rejected: count('REJECTED') },
  });
}));

r.patch('/config', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await ensureSetup(req.params.leagueId);
  const d = z.object({ policy: z.string().min(20).optional(), backText: z.string().min(5).optional(), sponsorLogoUrl: z.string().nullable().optional(), layout: z.enum(['PORTRAIT', 'LANDSCAPE']).optional(), showIdLast4: z.boolean().optional(), selfApplyOpen: z.boolean().optional() }).parse(req.body);
  res.json(await prisma.accredConfig.update({ where: { leagueId: req.params.leagueId }, data: d }));
}));

const zoneSchema = z.object({ code: z.string().min(1).max(3), name: z.string().min(2), description: z.string().nullable().optional() });
r.post('/zones', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const n = await prisma.accredZone.count({ where: { leagueId: req.params.leagueId } });
  res.status(201).json(await prisma.accredZone.create({ data: { ...zoneSchema.parse(req.body), leagueId: req.params.leagueId, sort: n } }));
}));
r.patch('/zones/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.accredZone.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: zoneSchema.partial().parse(req.body) })); }));
r.delete('/zones/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.accredZone.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

const catSchema = z.object({ name: z.string().min(2), letter: z.string().min(1).max(4), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), zones: z.array(z.string()).default([]), requiresIdCheck: z.boolean().default(true), selfApply: z.boolean().default(false) });
r.post('/categories', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const n = await prisma.accredCategory.count({ where: { leagueId: req.params.leagueId } });
  res.status(201).json(await prisma.accredCategory.create({ data: { ...catSchema.parse(req.body), leagueId: req.params.leagueId, sort: n } }));
}));
r.patch('/categories/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.accredCategory.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: catSchema.partial().parse(req.body) })); }));
r.delete('/categories/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  if (await prisma.accreditation.count({ where: { categoryId: req.params.id } })) throw new HttpError(400, 'This category is in use');
  await prisma.accredCategory.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

// ---------- Applications ----------
const accSchema = z.object({
  categoryId: z.string(), name: z.string().min(2), organisation: z.string().nullable().optional(), designation: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')), phone: z.string().nullable().optional(), photoUrl: z.string().nullable().optional(),
  idType: z.string().nullable().optional(), idNumber: z.string().nullable().optional(), idVerified: z.boolean().optional(),
  teamId: z.string().nullable().optional(), zones: z.array(z.string()).optional(), validFrom: z.coerce.date().nullable().optional(), validTo: z.coerce.date().nullable().optional(), notes: z.string().nullable().optional(),
});
/** Only the last 4 characters of an ID number are ever stored */
const scrubId = <T extends { idNumber?: string | null }>(d: T) => {
  const { idNumber, ...rest } = d;
  return { ...rest, ...(idNumber !== undefined && { idLast4: idNumber ? idNumber.replace(/\s/g, '').slice(-4) : null }) };
};

r.post('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  await ensureSetup(leagueId);
  const d = accSchema.parse(req.body);
  const cat = await prisma.accredCategory.findFirstOrThrow({ where: { id: d.categoryId, leagueId } });
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const a = await prisma.accreditation.create({
    data: { ...scrubId(d), email: d.email || null, leagueId, cardNo: await nextCardNo(leagueId), code: newCode(), zones: d.zones ?? cat.zones, validFrom: d.validFrom ?? league.startDate, validTo: d.validTo ?? league.endDate },
  });
  await audit(me(req).id, 'create', 'Accreditation', a.id);
  res.status(201).json(a);
}));

r.patch('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = accSchema.partial().parse(req.body);
  const cur = await prisma.accreditation.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  // Any change to what is printed on an already-printed card requires a reprint
  const printedFields = ['name', 'organisation', 'designation', 'photoUrl', 'zones', 'validFrom', 'validTo', 'categoryId'] as const;
  const changesCard = printedFields.some((k) => d[k] !== undefined && JSON.stringify(d[k]) !== JSON.stringify((cur as Record<string, unknown>)[k]));
  const data = { ...scrubId(d), ...(d.email !== undefined && { email: d.email || null }), ...(changesCard && ['PRINTED', 'ISSUED'].includes(cur.status) && { status: 'APPROVED', version: cur.version + 1, printedAt: null, issuedAt: null }) };
  res.json(await prisma.accreditation.update({ where: { id: cur.id }, data }));
}));

r.delete('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'admin');
  await prisma.accreditation.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

// Bulk-create applications from data already in SportsIQ
r.post('/bulk', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  await ensureSetup(leagueId);
  const { source } = z.object({ source: z.enum(['SQUADS', 'TEAM_OWNERS', 'MANAGEMENT']) }).parse(req.body);
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const cats = await prisma.accredCategory.findMany({ where: { leagueId } });
  const byName = (n: string) => cats.find((c) => c.name === n) ?? cats[0];
  const existing = await prisma.accreditation.findMany({ where: { leagueId }, select: { name: true, teamId: true } });
  const has = (name: string, teamId: string | null) => existing.some((e) => e.name.toLowerCase() === name.toLowerCase() && (e.teamId ?? null) === teamId);
  const rows: { name: string; teamId: string | null; organisation: string | null; designation: string; cat: ReturnType<typeof byName>; email?: string | null; phone?: string | null }[] = [];
  if (source === 'SQUADS') {
    const regs = await prisma.playerRegistration.findMany({ where: { leagueId, teamId: { not: null } }, include: { team: true, player: { include: { user: true } } } });
    regs.forEach((g) => rows.push({ name: g.player.user.name, teamId: g.teamId, organisation: g.team!.name, designation: g.player.playingRole ?? 'Player', cat: byName('Player'), email: g.player.user.email, phone: g.player.user.phone }));
  } else if (source === 'TEAM_OWNERS') {
    const owners = await prisma.teamOwner.findMany({ where: { team: { leagueId } }, include: { team: true, user: true } });
    owners.forEach((o) => rows.push({ name: o.user.name, teamId: o.teamId, organisation: o.team.name, designation: 'Team Owner', cat: byName('Sponsor / VIP'), email: o.user.email, phone: o.user.phone }));
  } else {
    const ms = await prisma.leagueMember.findMany({ where: { leagueId }, include: { user: true } });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: league.ownerId } });
    rows.push({ name: owner.name, teamId: null, organisation: league.name, designation: 'League Owner', cat: byName('League Management'), email: owner.email, phone: owner.phone });
    ms.forEach((m) => rows.push({ name: m.user.name, teamId: null, organisation: league.name, designation: m.title ?? m.department, cat: byName('League Management'), email: m.user.email, phone: m.user.phone }));
  }
  let created = 0;
  let cardNo = await nextCardNo(leagueId);
  for (const x of rows) {
    if (has(x.name, x.teamId)) continue;
    await prisma.accreditation.create({ data: { leagueId, categoryId: x.cat.id, cardNo: cardNo++, code: newCode(), name: x.name, teamId: x.teamId, organisation: x.organisation, designation: x.designation, email: x.email, phone: x.phone, zones: x.cat.zones, validFrom: league.startDate, validTo: league.endDate, source: 'BULK' } });
    created++;
  }
  res.json({ created, skipped: rows.length - created });
}));

// ---------- Workflow ----------
r.post('/workflow', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { ids, action, reason } = z.object({ ids: z.array(z.string()).min(1), action: z.enum(['APPROVE', 'REJECT', 'PRINTED', 'ISSUE', 'REVOKE', 'REPRINT', 'RESTORE']), reason: z.string().optional() }).parse(req.body);
  const list = await prisma.accreditation.findMany({ where: { id: { in: ids }, leagueId }, include: { category: true } });
  const done: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const a of list) {
    const skip = (why: string) => skipped.push({ name: a.name, reason: why });
    const set = async (data: object) => { await prisma.accreditation.update({ where: { id: a.id }, data }); done.push(a.id); };
    switch (action) {
      case 'APPROVE': {
        if (!['APPLIED', 'REJECTED'].includes(a.status)) { skip(`already ${a.status.toLowerCase()}`); break; }
        const b = approvalBlockers(a, a.category);
        if (b.length) { skip(b.join('; ')); break; }
        await set({ status: 'APPROVED' });
        break;
      }
      case 'REJECT': if (['APPLIED', 'APPROVED'].includes(a.status)) await set({ status: 'REJECTED', notes: reason ?? a.notes }); else skip(`cannot reject when ${a.status.toLowerCase()}`); break;
      case 'PRINTED': if (a.status === 'APPROVED') await set({ status: 'PRINTED', printedAt: new Date() }); else skip('only approved cards can be printed'); break;
      case 'ISSUE': if (a.status === 'PRINTED') await set({ status: 'ISSUED', issuedAt: new Date() }); else skip('print the card before issuing it'); break;
      case 'REVOKE': if (['APPROVED', 'PRINTED', 'ISSUED'].includes(a.status)) await set({ status: 'REVOKED', notes: reason ?? a.notes }); else skip(`cannot revoke when ${a.status.toLowerCase()}`); break;
      // Lost / damaged card: new version invalidates every previously printed copy
      case 'REPRINT': if (['PRINTED', 'ISSUED', 'REVOKED'].includes(a.status)) await set({ status: 'APPROVED', version: a.version + 1, printedAt: null, issuedAt: null, notes: reason ?? a.notes }); else skip('nothing printed yet'); break;
      case 'RESTORE': if (a.status === 'REVOKED') await set({ status: a.printedAt ? 'PRINTED' : 'APPROVED' }); else skip('not revoked'); break;
    }
  }
  if (done.length) await audit(me(req).id, `accreditation-${action.toLowerCase()}`, 'Accreditation', undefined, { ids: done, reason });
  if (action === 'ISSUE' && done.length) {
    await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'accreditation' } }, update: {}, create: { leagueId, stepKey: 'accreditation', status: 'IN_PROGRESS' } });
  }
  res.json({ done: done.length, skipped });
}));

// ---------- Gate verification ----------
r.post('/verify', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { payload, zone } = z.object({ payload: z.string().min(3), zone: z.string().min(1) }).parse(req.body);
  const [code, ver] = payload.trim().toUpperCase().split('.');
  const a = await prisma.accreditation.findFirst({ where: { code, leagueId }, include: { category: true } });
  if (!a) return res.json({ allowed: false, reason: 'Unknown card — not issued by this league' });
  const now = new Date();
  let reason: string | null = null;
  if (a.status === 'REVOKED') reason = 'Card has been REVOKED';
  else if (ver && Number(ver) !== a.version) reason = `Old card version (v${ver}) — a replacement v${a.version} was issued. Confiscate this card.`;
  else if (!['PRINTED', 'ISSUED'].includes(a.status)) reason = `Card is not active (${a.status.toLowerCase()})`;
  else if (a.validFrom && now < a.validFrom) reason = `Not valid until ${a.validFrom.toLocaleDateString('en-IN')}`;
  else if (a.validTo && now > new Date(a.validTo.getTime() + 864e5)) reason = `Expired on ${a.validTo.toLocaleDateString('en-IN')}`;
  else if (!a.zones.includes(zone)) reason = `No access to zone ${zone}`;
  await prisma.accredScan.create({ data: { accreditationId: a.id, zone, allowed: !reason, reason, byUserId: me(req).id } });
  if (reason && a.status === 'REVOKED') await notify(await leagueManagers(leagueId), `Revoked card presented: ${a.name}`, { body: `Zone ${zone}`, link: `/leagues/${leagueId}/accreditation`, type: 'alert' });
  res.json({ allowed: !reason, reason, card: { name: a.name, photoUrl: a.photoUrl, organisation: a.organisation, designation: a.designation, category: a.category.name, color: a.category.color, zones: a.zones, cardNo: a.cardNo, version: a.version } });
}));

r.get('/scans', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.accredScan.findMany({ where: { accreditation: { leagueId: req.params.leagueId } }, orderBy: { createdAt: 'desc' }, take: 100, include: { accreditation: { select: { name: true, cardNo: true } } } }));
}));

export default r;

/** Public self-application (media, broadcast, vendors, volunteers). Mounted at /api/public/accreditation */
export const publicAccreditation = Router();

publicAccreditation.get('/:slug', ah(async (req, res) => {
  const l = await prisma.league.findUnique({ where: { slug: req.params.slug }, select: { id: true, name: true, logoUrl: true, isPublic: true, startDate: true, endDate: true } });
  if (!l || !l.isPublic) throw new HttpError(404, 'League not found');
  const cfg = await ensureSetup(l.id);
  if (!cfg.selfApplyOpen) throw new HttpError(403, 'Accreditation applications are closed');
  const categories = await prisma.accredCategory.findMany({ where: { leagueId: l.id, selfApply: true }, orderBy: { sort: 'asc' }, select: { id: true, name: true, color: true, requiresIdCheck: true } });
  res.json({ league: l, policy: cfg.policy, categories });
}));

publicAccreditation.post('/:slug', ah(async (req, res) => {
  const l = await prisma.league.findUnique({ where: { slug: req.params.slug } });
  if (!l || !l.isPublic) throw new HttpError(404, 'League not found');
  const cfg = await ensureSetup(l.id);
  if (!cfg.selfApplyOpen) throw new HttpError(403, 'Accreditation applications are closed');
  const d = z.object({
    categoryId: z.string(), name: z.string().min(2), organisation: z.string().min(2), designation: z.string().min(2),
    email: z.string().email(), phone: z.string().min(8), photoUrl: z.string().startsWith('data:image/'), idType: z.string().min(2), idNumber: z.string().min(4),
    consent: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and data consent' }) }),
  }).parse(req.body);
  const cat = await prisma.accredCategory.findFirst({ where: { id: d.categoryId, leagueId: l.id, selfApply: true } });
  if (!cat) throw new HttpError(400, 'This category is not open for applications');
  const dup = await prisma.accreditation.findFirst({ where: { leagueId: l.id, email: d.email, status: { in: ['APPLIED', 'APPROVED', 'PRINTED', 'ISSUED'] } } });
  if (dup) throw new HttpError(409, 'An application with this email already exists');
  const { consent: _c, idNumber, ...rest } = d;
  const a = await prisma.accreditation.create({
    data: { ...rest, idLast4: idNumber.replace(/\s/g, '').slice(-4), leagueId: l.id, cardNo: await nextCardNo(l.id), code: newCode(), zones: cat.zones, validFrom: l.startDate, validTo: l.endDate, source: 'SELF_APPLY' },
  });
  await notify(await leagueManagers(l.id), `New accreditation application: ${d.name}`, { body: `${cat.name} · ${d.organisation}`, link: `/leagues/${l.id}/accreditation`, type: 'info' });
  res.status(201).json({ ok: true, reference: `#${a.cardNo}` });
}));
