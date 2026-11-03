import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { leagueAccess } from '../lib/access.js';
import { allows, userLevels, type Level } from '../lib/permissions.js';

/** Global search across everything the signed-in user can see. GET /api/search?q= */
const r = Router();
r.use(requireAuth);

interface Hit { type: string; title: string; subtitle?: string; link: string }

r.get('/', ah(async (req, res) => {
  const u = me(req);
  const { q, league: current } = z.object({ q: z.string().trim().min(2).max(60), league: z.string().optional() }).parse(req.query);
  const like = { contains: q, mode: 'insensitive' as const };
  const take = 5;
  const groups: Record<string, Hit[]> = {};
  const add = (g: string, hits: Hit[]) => { if (hits.length) groups[g] = [...(groups[g] ?? []), ...hits].slice(0, 8); };

  // Leagues this user can work in
  const where: Prisma.LeagueWhereInput = u.role === 'SUPER_ADMIN' ? {} : { OR: [{ ownerId: u.id }, { members: { some: { userId: u.id } } }, { teams: { some: { owners: { some: { userId: u.id } } } } }] };
  const leagues = (await prisma.league.findMany({ where, select: { id: true, name: true, season: true }, orderBy: { createdAt: 'desc' }, take: 25 }))
    .sort((a, b) => Number(b.id === current) - Number(a.id === current)); // the league you're in ranks first
  add('Leagues', leagues.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).map((l) => ({ type: 'League', title: l.name, subtitle: l.season ? `Season ${l.season}` : undefined, link: `/leagues/${l.id}` })));

  for (const l of leagues) {
    const access = await leagueAccess(u, l.id);
    const levels = access === 'staff' ? await userLevels(u, l.id) : null;
    const can = (m: string) => access === 'admin' || (access === 'staff' && allows((levels as Record<string, Level>)[m], 'view'));
    const L = `/leagues/${l.id}`;
    const sub = (x?: string | null) => [x, leagues.length > 1 ? `${l.name}${l.season ? ` ${l.season}` : ''}` : null].filter(Boolean).join(' · ');
    const teamFilter = access === 'team' ? { owners: { some: { userId: u.id } } } : {};
    const myTeamIds = access === 'team' ? (await prisma.team.findMany({ where: { leagueId: l.id, ...teamFilter }, select: { id: true } })).map((t) => t.id) : [];
    const tasks: Promise<void>[] = [];
    tasks.push(prisma.team.findMany({ where: { leagueId: l.id, ...teamFilter, OR: [{ name: like }, { shortName: like }, { city: like }] }, take }).then((x) => add('Teams', x.map((t) => ({ type: 'Team', title: t.name, subtitle: sub(t.city), link: `${L}/teams` })))));
    tasks.push(prisma.playerRegistration.findMany({ where: { leagueId: l.id, ...(access === 'team' && { team: teamFilter }), player: { user: { name: like } } }, include: { player: { include: { user: { select: { name: true } } } }, team: { select: { name: true } } }, take }).then((x) => add('Players', x.map((g) => ({ type: 'Player', title: g.player.user.name, subtitle: sub([g.player.playingRole, g.team?.name ?? g.status.toLowerCase()].filter(Boolean).join(' · ')), link: `${L}/players` })))));
    tasks.push(prisma.match.findMany({ where: { leagueId: l.id, OR: [{ homeTeam: { name: like } }, { awayTeam: { name: like } }, { venue: { name: like } }, { stage: like }] }, include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } }, orderBy: { number: 'asc' }, take }).then((x) => add('Matches', x.map((m) => ({ type: 'Match', title: `M${m.number}: ${m.homeTeam?.name ?? m.homeLabel ?? 'TBD'} vs ${m.awayTeam?.name ?? m.awayLabel ?? 'TBD'}`, subtitle: sub(m.startsAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) ?? m.stage), link: `${L}/matches/${m.id}` })))));
    if (can('legal')) tasks.push(prisma.contract.findMany({ where: { leagueId: l.id, OR: [{ title: like }, { counterparty: like }] }, take }).then((x) => add('Contracts', x.map((c) => ({ type: 'Contract', title: c.title, subtitle: sub(c.status.replace(/_/g, ' ').toLowerCase()), link: `${L}/contracts/${c.id}` })))));
    if (can('decks')) tasks.push(prisma.deck.findMany({ where: { leagueId: l.id, title: like }, take }).then((x) => add('Decks', x.map((d) => ({ type: 'Deck', title: d.title, subtitle: sub(d.type), link: `${L}/decks/${d.id}` })))));
    if (can('sponsorship')) tasks.push(prisma.sponsorDeal.findMany({ where: { leagueId: l.id, OR: [{ company: like }, { contactName: like }] }, take }).then((x) => add('Sponsor deals', x.map((d) => ({ type: 'Deal', title: d.company, subtitle: sub(d.stage.toLowerCase()), link: `${L}/crm?deal=${d.id}` })))));
    if (can('procurement')) {
      tasks.push(prisma.rfq.findMany({ where: { leagueId: l.id, title: like }, take }).then((x) => add('Procurement', x.map((f) => ({ type: 'RFQ', title: f.title, subtitle: sub(`RFQ · ${f.status.toLowerCase()}`), link: `${L}/procurement/rfqs/${f.id}` })))));
      tasks.push(prisma.workOrder.findMany({ where: { leagueId: l.id, OR: [{ title: like }, { vendor: { companyName: like } }] }, include: { vendor: { select: { companyName: true } } }, take }).then((x) => add('Procurement', x.map((w) => ({ type: 'Work order', title: `WO-${w.number} ${w.title}`, subtitle: sub(w.vendor.companyName), link: `${L}/procurement/work-orders/${w.id}` })))));
    }
    if (can('finance')) tasks.push(prisma.expense.findMany({ where: { leagueId: l.id, OR: [{ description: like }, { payee: like }, { category: like }] }, orderBy: { date: 'desc' }, take }).then((x) => add('Expenses', x.map((e) => ({ type: 'Expense', title: e.description, subtitle: sub(`₹${e.amount.toLocaleString('en-IN')} · ${e.payee ?? e.category}`), link: `${L}/finance` })))));
    if (can('jerseys') || access === 'team') tasks.push(prisma.jerseyDesign.findMany({ where: { leagueId: l.id, name: like, ...(access === 'team' && { teamId: { in: myTeamIds } }) }, take }).then((x) => add('Jerseys', x.map((j) => ({ type: 'Jersey', title: j.name, subtitle: sub(j.status.toLowerCase()), link: `${L}/jerseys/${j.id}` })))));
    if (access !== 'team') tasks.push(prisma.leagueMember.findMany({ where: { leagueId: l.id, user: { name: like } }, include: { user: { select: { name: true } } }, take }).then((x) => add('People', x.map((m) => ({ type: 'Staff', title: m.user.name, subtitle: sub(m.department), link: `${L}/management` })))));
    await Promise.all(tasks);
  }

  // Marketplaces (open to every signed-in user)
  const [vendors, sponsors, talent] = await Promise.all([
    prisma.vendorProfile.findMany({ where: { OR: [{ companyName: like }, { city: like }, { services: { some: { OR: [{ title: like }, { category: { name: like } }] } } }] }, include: { services: { include: { category: { select: { name: true, slug: true } } }, take: 1 } }, orderBy: { rating: 'desc' }, take }),
    ['LEAGUE_OWNER', 'LEAGUE_STAFF', 'SUPER_ADMIN'].includes(u.role) ? prisma.sponsorProfile.findMany({ where: { OR: [{ companyName: like }, { industry: like }] }, take }) : Promise.resolve([]),
    ['LEAGUE_OWNER', 'LEAGUE_STAFF', 'SPONSOR', 'SUPER_ADMIN'].includes(u.role) ? prisma.talent.findMany({ where: { name: like, isPublished: true, authorisedAt: { not: null }, agency: { user: { isActive: true } } }, take }) : Promise.resolve([]),
  ]);
  add('Vendors', vendors.map((v) => ({ type: 'Vendor', title: v.companyName, subtitle: [v.services[0]?.category.name, v.city].filter(Boolean).join(' · '), link: `vendor:${v.id}` })));
  add('Sponsors', sponsors.map((s: any) => ({ type: 'Sponsor', title: s.companyName, subtitle: s.industry ?? undefined, link: leagues[0] ? `/leagues/${leagues[0].id}/sponsors` : '/leagues' })));
  add('Talent', talent.map((t: any) => ({ type: 'Talent', title: t.name, subtitle: t.status === 'RETIRED' ? 'Legend' : 'Cricketer', link: '/talent' })));
  res.json({ q, groups });
}));

export default r;
