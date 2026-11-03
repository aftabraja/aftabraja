import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { layout, sendEmail } from '../lib/mailer.js';
import { standings } from '../lib/standings.js';

/** Marketing & PR: content calendar, asset library, media contacts, press releases. /api/leagues/:leagueId/marketing */
const r = Router({ mergeParams: true });
r.use(requireAuth);
const dateOpt = z.coerce.date().nullable().optional();

// ---------------- Content calendar ----------------
const postSchema = z.object({
  title: z.string().min(2), type: z.string().default('OTHER'), channels: z.array(z.string()).default([]), scheduledAt: z.coerce.date(), caption: z.string().nullable().optional(),
  assets: z.array(z.string()).default([]), status: z.enum(['IDEA', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED']).optional(), assigneeId: z.string().nullable().optional(),
  matchId: z.string().nullable().optional(), deliverableId: z.string().nullable().optional(), publishedUrl: z.string().nullable().optional(),
});

r.get('/posts', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
  res.json(await prisma.contentPost.findMany({ where: { leagueId: req.params.leagueId, ...((q.from || q.to) && { scheduledAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }) }, orderBy: { scheduledAt: 'asc' } }));
}));

const nameOf = async (id?: string | null) => (id ? (await prisma.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null : null);

r.post('/posts', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = postSchema.parse(req.body);
  res.status(201).json(await prisma.contentPost.create({ data: { ...d, leagueId: req.params.leagueId, assigneeName: await nameOf(d.assigneeId) } }));
}));

r.patch('/posts/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId, 'staff');
  const d = postSchema.partial().parse(req.body);
  const cur = await prisma.contentPost.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (d.status === 'APPROVED' && access !== 'admin' && cur.assigneeId === u.id) throw new HttpError(403, 'Someone else must approve your post');
  if (d.status === 'PUBLISHED' && !['APPROVED', 'PUBLISHED'].includes(cur.status)) throw new HttpError(400, 'Approve the post before publishing');
  const p = await prisma.contentPost.update({ where: { id: cur.id }, data: { ...d, ...(d.assigneeId !== undefined && { assigneeName: await nameOf(d.assigneeId) }), ...(d.status === 'PUBLISHED' && cur.status !== 'PUBLISHED' && { publishedAt: new Date() }) } });
  if (d.status === 'IN_REVIEW' && cur.status !== 'IN_REVIEW') await notify(await leagueManagers(leagueId), `Post ready for review: ${p.title}`, { link: `/leagues/${leagueId}/marketing`, type: 'info' });
  if (d.status && d.status !== cur.status && p.assigneeId && p.assigneeId !== u.id) await notify(p.assigneeId, `${p.title}: ${d.status.replace('_', ' ').toLowerCase()}`, { link: `/leagues/${leagueId}/marketing`, type: 'info' });
  // Publishing a post linked to a sponsor deliverable counts it, with the creative as proof
  if (d.status === 'PUBLISHED' && cur.status !== 'PUBLISHED' && p.deliverableId) {
    const del = await prisma.sponsorDeliverable.findFirst({ where: { id: p.deliverableId, leagueId } });
    if (del && del.delivered < del.quantity) await prisma.sponsorDeliverable.update({ where: { id: del.id }, data: { delivered: del.delivered + 1, proofs: [...del.proofs, ...p.assets.slice(0, 1)], notes: [del.notes, p.publishedUrl && `Posted: ${p.publishedUrl}`].filter(Boolean).join('\n') || null } });
  }
  res.json(p);
}));

r.delete('/posts/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.contentPost.deleteMany({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

/** Auto-plan match-day content: promo the day before, live/result after each upcoming match */
r.post('/posts/plan-matches', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { count } = z.object({ count: z.coerce.number().int().min(1).max(30).default(6) }).parse(req.body);
  const matches = await prisma.match.findMany({ where: { leagueId, status: 'SCHEDULED', startsAt: { gte: new Date() }, homeTeamId: { not: null }, awayTeamId: { not: null } }, orderBy: { startsAt: 'asc' }, take: count, include: { homeTeam: true, awayTeam: true, venue: true } });
  const existing = await prisma.contentPost.findMany({ where: { leagueId, matchId: { in: matches.map((m) => m.id) } }, select: { matchId: true, type: true } });
  let created = 0;
  for (const m of matches) {
    const vs = `${m.homeTeam!.name} vs ${m.awayTeam!.name}`;
    const plan = [
      { type: 'MATCH_PROMO', title: `Match ${m.number} preview: ${vs}`, at: new Date(m.startsAt!.getTime() - 20 * 36e5), caption: `Match day tomorrow! ${vs}${m.venue ? ` at ${m.venue.name}` : ''}. Who are you backing? #${m.homeTeam!.shortName ?? ''} #${m.awayTeam!.shortName ?? ''}` },
      { type: 'RESULT', title: `Match ${m.number} result: ${vs}`, at: new Date(m.startsAt!.getTime() + 4 * 36e5), caption: '[Result + player of the match]' },
    ];
    for (const p of plan) {
      if (existing.some((e) => e.matchId === m.id && e.type === p.type)) continue;
      await prisma.contentPost.create({ data: { leagueId, matchId: m.id, title: p.title, type: p.type, scheduledAt: p.at, caption: p.caption, channels: ['INSTAGRAM', 'X', 'FACEBOOK'], status: 'DRAFT' } });
      created++;
    }
  }
  res.json({ created });
}));

// ---------------- Asset library ----------------
r.get('/assets', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const q = z.object({ tag: z.string().optional(), q: z.string().optional() }).parse(req.query);
  res.json(await prisma.mediaAsset.findMany({ where: { leagueId: req.params.leagueId, ...(q.tag && { tags: { has: q.tag } }), ...(q.q && { title: { contains: q.q, mode: 'insensitive' } }) }, orderBy: { createdAt: 'desc' }, take: 300 }));
}));
r.post('/assets', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ items: z.array(z.object({ title: z.string().min(1), url: z.string().min(1), kind: z.string().default('IMAGE') })).min(1), tags: z.array(z.string()).default([]) }).parse(req.body);
  const tags = [...new Set(d.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  await prisma.mediaAsset.createMany({ data: d.items.map((i) => ({ ...i, tags, leagueId: req.params.leagueId, uploadedBy: me(req).name })) });
  res.status(201).json({ created: d.items.length });
}));
r.patch('/assets/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ title: z.string().optional(), tags: z.array(z.string()).optional() }).parse(req.body);
  res.json(await prisma.mediaAsset.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: { ...d, ...(d.tags && { tags: [...new Set(d.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))] }) } }));
}));
r.delete('/assets/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.mediaAsset.deleteMany({ where: { id: req.params.id, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

// ---------------- Media contacts ----------------
const contactSchema = z.object({ name: z.string().min(2), outlet: z.string().min(1), kind: z.string().default('Digital'), beat: z.string().nullable().optional(), email: z.string().email().nullable().optional().or(z.literal('')), phone: z.string().nullable().optional(), city: z.string().nullable().optional(), notes: z.string().nullable().optional() });
r.get('/contacts', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.mediaContact.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { outlet: 'asc' } })); }));
r.post('/contacts', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); const d = contactSchema.parse(req.body); res.status(201).json(await prisma.mediaContact.create({ data: { ...d, email: d.email || null, leagueId: req.params.leagueId } })); }));
r.patch('/contacts/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); const d = contactSchema.partial().parse(req.body); res.json(await prisma.mediaContact.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: { ...d, ...(d.email !== undefined && { email: d.email || null }) } })); }));
r.delete('/contacts/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.mediaContact.deleteMany({ where: { id: req.params.id, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));
/** Bulk import: one contact per line — Name, Outlet, Email, Phone, Type, City */
r.post('/contacts/import', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { text } = z.object({ text: z.string().min(3) }).parse(req.body);
  const rows = text.split(/\r?\n/).map((l) => l.split(/[,\t]/).map((c) => c.trim())).filter((c) => c[0] && c[1]);
  const ok = rows.map(([name, outlet, email, phone, kind, city]) => ({ name, outlet, email: email && /@/.test(email) ? email : null, phone: phone || null, kind: kind || 'Digital', city: city || null, leagueId: req.params.leagueId }));
  await prisma.mediaContact.createMany({ data: ok });
  res.json({ imported: ok.length });
}));

// ---------------- Press releases ----------------
export const PR_TEMPLATES = ['launch', 'auction', 'result', 'standings', 'champions', 'sponsor'] as const;

/** Drafts a press release from live league data */
export async function draftRelease(leagueId: string, template: (typeof PR_TEMPLATES)[number], matchId?: string) {
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { teams: true } });
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const head = `${(l.city ?? 'INDIA').toUpperCase()}, ${date}: `;
  const boiler = `\n\nAbout ${l.name}\n${l.description ?? `${l.name} is a ${l.format ?? ''} ${l.sport.toLowerCase()} league${l.city ? ` based in ${l.city}` : ''}.`}\n\nMedia contact: [Name, phone, email]`;
  const fmt = (d?: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : 'TBA');
  switch (template) {
    case 'launch':
      return { title: `${l.name} announces its inaugural season`, body: `${head}${l.name} today announced its season, featuring ${l.teams.length} teams competing from ${fmt(l.startDate)} to ${fmt(l.endDate)}${l.city ? ` in ${l.city}` : ''}.\n\nThe teams: ${l.teams.map((t) => t.name).join(', ')}.\n\n"[Quote from the league owner about the vision for the league]," said [Name, Title].\n\nPlayer registrations, ticketing and sponsorship details are available on the league's official page.${boiler}` };
    case 'auction': {
      const top = await prisma.playerRegistration.findMany({ where: { leagueId, status: 'SOLD' }, orderBy: { soldPrice: 'desc' }, take: 5, include: { team: true, player: { include: { user: true } } } });
      const sold = await prisma.playerRegistration.aggregate({ where: { leagueId, status: 'SOLD' }, _count: true, _sum: { soldPrice: true } });
      return { title: `${l.name} player auction: ${sold._count} players sold`, body: `${head}${sold._count} players were picked at the ${l.name} player auction, with teams spending a combined ₹${(sold._sum.soldPrice ?? 0).toLocaleString('en-IN')}.\n\nTop buys:\n${top.map((p, i) => `${i + 1}. ${p.player.user.name} (${p.player.playingRole ?? 'player'}) — ${p.team?.name}, ₹${(p.soldPrice ?? 0).toLocaleString('en-IN')}`).join('\n')}\n\n"[Quote from a team owner on their squad]," said [Name].${boiler}` };
    }
    case 'result': {
      const m = await prisma.match.findFirst({ where: { leagueId, ...(matchId ? { id: matchId } : { status: 'COMPLETED' }) }, orderBy: { startsAt: 'desc' }, include: { homeTeam: true, awayTeam: true, venue: true } });
      if (!m) throw new HttpError(400, 'No completed match yet');
      return { title: `${m.resultText ?? `${m.homeTeam?.name} vs ${m.awayTeam?.name}`}`, body: `${head}${m.resultText ?? 'Result to be confirmed'} in Match ${m.number} of ${l.name}${m.venue ? ` at ${m.venue.name}` : ''}.\n\n[Key performances: top scorer, best bowling figures, player of the match]\n\n"[Captain's quote]," said [Name].${boiler}` };
    }
    case 'standings': {
      const { rows } = await standings(leagueId);
      return { title: `${l.name}: points table after ${rows.reduce((a, r) => a + r.played, 0) / 2} matches`, body: `${head}Here is how the ${l.name} table looks:\n\n${rows.map((r, i) => `${i + 1}. ${r.name} — ${r.points} pts (P${r.played} W${r.won} L${r.lost}, NRR ${r.nrr > 0 ? '+' : ''}${r.nrr.toFixed(3)})`).join('\n')}\n\nThe top four qualify for the playoffs.${boiler}` };
    }
    case 'champions': {
      const final = await prisma.match.findFirst({ where: { leagueId, stage: 'Final', status: 'COMPLETED' }, include: { homeTeam: true, awayTeam: true } });
      const champ = final?.winnerTeamId === final?.homeTeamId ? final?.homeTeam?.name : final?.awayTeam?.name;
      return { title: `${champ ?? '[Champion]'} crowned ${l.name} champions`, body: `${head}${champ ?? '[Champion team]'} won the ${l.name} title${final?.resultText ? ` — ${final.resultText}` : ''}.\n\nAwards: Player of the series [Name], Best batter [Name], Best bowler [Name], Emerging player [Name].\n\n"[Owner/captain quote]," said [Name].${boiler}` };
    }
    default: {
      const deal = await prisma.sponsorDeal.findFirst({ where: { leagueId, stage: 'WON' }, orderBy: { wonAt: 'desc' } });
      const opp = deal?.opportunityId ? await prisma.sponsorshipOpportunity.findUnique({ where: { id: deal.opportunityId } }) : null;
      return { title: `${deal?.company ?? '[Sponsor]'} joins ${l.name} as ${opp?.title ?? 'official partner'}`, body: `${head}${l.name} has announced ${deal?.company ?? '[Sponsor]'} as its ${opp?.title ?? 'official partner'} for the season.\n\n"[Sponsor quote]," said [Name, Title, ${deal?.company ?? 'Sponsor'}].\n\n"[League quote]," said [Name, Title].${boiler}` };
    }
  }
}

r.get('/releases', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.pressRelease.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { updatedAt: 'desc' } })); }));

r.post('/releases', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ template: z.enum(PR_TEMPLATES).optional(), title: z.string().optional(), body: z.string().optional(), matchId: z.string().optional() }).parse(req.body);
  const draft = d.template ? await draftRelease(leagueId, d.template, d.matchId) : { title: d.title ?? 'Untitled release', body: d.body ?? '' };
  res.status(201).json(await prisma.pressRelease.create({ data: { leagueId, ...draft } }));
}));

r.patch('/releases/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId, 'staff');
  const d = z.object({ title: z.string().optional(), body: z.string().optional(), status: z.enum(['DRAFT', 'APPROVED']).optional(), addCoverage: z.object({ outlet: z.string().min(1), url: z.string().url(), date: z.string().optional() }).optional() }).parse(req.body);
  const cur = await prisma.pressRelease.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (cur.status === 'SENT' && (d.title || d.body)) throw new HttpError(400, 'A sent release cannot be edited');
  if (d.status === 'APPROVED' && access !== 'admin') throw new HttpError(403, 'Only the league owner can approve press releases');
  const coverage = d.addCoverage ? [...(cur.coverage as object[]), { ...d.addCoverage, date: d.addCoverage.date ?? new Date().toISOString().slice(0, 10) }] : undefined;
  const { addCoverage: _a, ...rest } = d;
  res.json(await prisma.pressRelease.update({ where: { id: cur.id }, data: { ...rest, ...(coverage && { coverage }), ...(d.status === 'APPROVED' && { approvedBy: u.name }), ...(d.status === 'DRAFT' && cur.status === 'APPROVED' && { approvedBy: null }), ...((d.title || d.body) && cur.status === 'APPROVED' && { status: 'DRAFT', approvedBy: null }) } }));
}));

r.post('/releases/:id/send', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const { contactIds } = z.object({ contactIds: z.array(z.string()).min(1) }).parse(req.body);
  const pr = await prisma.pressRelease.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (pr.status !== 'APPROVED') throw new HttpError(400, 'Approve the release before sending');
  const contacts = await prisma.mediaContact.findMany({ where: { id: { in: contactIds }, leagueId, email: { not: null } } });
  if (!contacts.length) throw new HttpError(400, 'None of the selected contacts has an email address');
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const html = layout(pr.title, pr.body.split('\n').map((l) => (l.trim() ? `<p style="margin:0 0 10px">${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</p>` : '')).join(''));
  for (const c of contacts) await sendEmail(c.email!, `[Press release] ${league.name}: ${pr.title}`, html);
  await prisma.pressRelease.update({ where: { id: pr.id }, data: { status: 'SENT', sentAt: new Date(), sentTo: contacts.length } });
  await audit(u.id, 'send', 'PressRelease', pr.id, { recipients: contacts.length });
  res.json({ sent: contacts.length });
}));

r.delete('/releases/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.pressRelease.deleteMany({ where: { id: req.params.id, leagueId: req.params.leagueId, status: { not: 'SENT' } } }); res.json({ ok: true }); }));

export default r;
