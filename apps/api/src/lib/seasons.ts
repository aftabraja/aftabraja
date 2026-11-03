import { prisma } from './prisma.js';
import { notify, audit } from './notify.js';
import { financeSummary } from './finance.js';
import { nps } from './promo.js';

const strip = <T extends Record<string, unknown>>(x: T, ...keys: string[]) => Object.fromEntries(Object.entries(x).filter(([k]) => !['id', 'leagueId', 'createdAt', 'updatedAt', ...keys].includes(k))) as Partial<T>;

/**
 * Starts the next season of a league: a new league record in the same series that carries over the
 * identity, teams and owners, staff, venues, rules, clause library, sponsorship inventory and budget.
 * Last season's squad players are carried as retention-eligible registrations (they re-verify KYC).
 */
export async function startNextSeason(leagueId: string, byUserId: string, opts: { season: string; startDate?: Date | null; endDate?: Date | null; carryPlayers: boolean }) {
  const old = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { members: true, teams: { include: { owners: true } }, venues: true, opportunities: true, budgets: true, auction: true, accredConfig: true, accredZones: true, ticketCategories: { where: { matchId: null } } } });
  const seriesId = old.seriesId ?? old.id;
  const prevLabel = old.season ?? (old.startDate ? String(old.startDate.getFullYear()) : 'Season 1');
  if (!old.seriesId || !old.season) await prisma.league.update({ where: { id: old.id }, data: { seriesId, season: prevLabel } });
  if (await prisma.league.findFirst({ where: { seriesId, season: opts.season } })) throw Object.assign(new Error(`Season ${opts.season} already exists`), { status: 409 });
  const baseSlug = old.slug.replace(/-\d{4}(-\d{2})?$/, '');
  const slugTry = `${baseSlug}-${opts.season.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const slug = (await prisma.league.findUnique({ where: { slug: slugTry } })) ? `${slugTry}-${Date.now().toString(36)}` : slugTry;

  const nl = await prisma.league.create({ data: {
    name: old.name, shortCode: old.shortCode, slug, sport: old.sport, format: old.format, category: old.category, city: old.city, country: old.country,
    description: old.description, logoUrl: old.logoUrl, primaryColor: old.primaryColor, startDate: opts.startDate ?? null, endDate: opts.endDate ?? null,
    numTeams: old.numTeams, teamPurse: old.teamPurse, legalChain: old.legalChain, expenseApprovalLimit: old.expenseApprovalLimit, isPublic: old.isPublic,
    regFee: old.regFee, regDocs: old.regDocs, regMaxPlayers: old.regMaxPlayers, minAge: old.minAge, maxAge: old.maxAge, deptPermissions: old.deptPermissions ?? {},
    ownerId: old.ownerId, status: 'PLANNING', seriesId, season: opts.season,
  } });
  const teamMap = new Map<string, string>();
  for (const t of old.teams) {
    const nt = await prisma.team.create({ data: { leagueId: nl.id, name: t.name, shortName: t.shortName, city: t.city, logoUrl: t.logoUrl, color: t.color, purse: t.purse, franchiseFee: t.franchiseFee } });
    teamMap.set(t.id, nt.id);
    if (t.owners.length) await prisma.teamOwner.createMany({ data: t.owners.map((o) => ({ teamId: nt.id, userId: o.userId, sharePct: o.sharePct })) });
    const staff = await prisma.teamStaff.findMany({ where: { teamId: t.id } });
    if (staff.length) await prisma.teamStaff.createMany({ data: staff.map((s) => ({ ...strip(s, 'teamId'), teamId: nt.id }) as never) });
  }
  if (old.members.length) await prisma.leagueMember.createMany({ data: old.members.map((m) => ({ leagueId: nl.id, userId: m.userId, department: m.department, title: m.title })) });
  if (old.venues.length) await prisma.venue.createMany({ data: old.venues.map((v) => ({ ...strip(v), leagueId: nl.id }) as never) });
  if (old.opportunities.length) await prisma.sponsorshipOpportunity.createMany({ data: old.opportunities.map((o) => ({ ...strip(o, 'status'), leagueId: nl.id }) as never) });
  if (old.budgets.length) await prisma.budgetLine.createMany({ data: old.budgets.map((b) => ({ category: b.category, planned: b.planned, leagueId: nl.id })) });
  if (old.ticketCategories.length) await prisma.ticketCategory.createMany({ data: old.ticketCategories.map((c) => ({ leagueId: nl.id, name: c.name, price: c.price, quantity: c.quantity })) });
  if (old.accredConfig) await prisma.accredConfig.create({ data: { ...strip(old.accredConfig), leagueId: nl.id } as never });
  if (old.accredZones.length) await prisma.accredZone.createMany({ data: old.accredZones.map((z) => ({ ...strip(z), leagueId: nl.id }) as never) });
  const cats = await prisma.accredCategory.findMany({ where: { leagueId: old.id } });
  if (cats.length) await prisma.accredCategory.createMany({ data: cats.map((c) => ({ ...strip(c), leagueId: nl.id }) as never) });
  const clauses = await prisma.clause.findMany({ where: { leagueId: old.id } });
  if (clauses.length) await prisma.clause.createMany({ data: clauses.map((c) => ({ ...strip(c), leagueId: nl.id }) as never) });
  if (old.auction) {
    const a = old.auction;
    await prisma.auction.create({ data: { leagueId: nl.id, bidIncrement: a.bidIncrement, timerSeconds: a.timerSeconds, minSquad: a.minSquad, maxSquad: a.maxSquad, maxOverseas: a.maxOverseas, roleMins: a.roleMins ?? {}, mode: a.mode, maxRetentions: a.maxRetentions, rtmCards: a.rtmCards, draftSnake: a.draftSnake, draftPrices: a.draftPrices ?? {}, draftOrder: a.draftOrder.map((id) => teamMap.get(id)).filter(Boolean) as string[] } });
  }
  let carried = 0;
  if (opts.carryPlayers) {
    const squads = await prisma.playerRegistration.findMany({ where: { leagueId: old.id, teamId: { not: null } }, include: { player: { select: { userId: true } } } });
    for (const g of squads) {
      await prisma.playerRegistration.create({ data: { leagueId: nl.id, playerId: g.playerId, status: 'SHORTLISTED', category: g.category, basePrice: g.basePrice, isOverseas: g.isOverseas, previousTeamId: teamMap.get(g.teamId!) ?? null, kycStatus: nl.regDocs.length ? 'PENDING' : 'VERIFIED', feeStatus: null } });
      carried++;
    }
    await notify(squads.map((g) => g.player.userId), `${nl.name} ${opts.season}: you have been carried over from last season`, { body: 'Your previous team can retain you before the auction. Please re-upload your documents if asked.', link: '/player' });
  }
  const done = ['league-profile', ...(nl.logoUrl ? ['league-logo'] : []), ...(old.teams.length ? ['create-teams'] : []), ...(old.teams.some((t) => t.owners.length) ? ['franchise-sale'] : [])];
  await prisma.leagueStepProgress.createMany({ data: done.map((stepKey) => ({ leagueId: nl.id, stepKey, status: 'DONE' as const })) });
  await audit(byUserId, 'start-season', 'League', nl.id, { from: old.id, season: opts.season, carried });
  await notify([...old.members.map((m) => m.userId), ...old.teams.flatMap((t) => t.owners.map((o) => o.userId))], `${nl.name} season ${opts.season} has been set up`, { link: `/leagues/${nl.id}`, type: 'success' });
  return { league: nl, carried, teams: teamMap.size };
}

/** Season-on-season comparison for every league in a series */
export async function seasonComparison(seriesId: string) {
  const ls = await prisma.league.findMany({ where: { OR: [{ seriesId }, { id: seriesId }] }, orderBy: { createdAt: 'asc' } });
  return Promise.all(ls.map(async (l) => {
    const [fin, regs, played, tickets, fanResponses, won] = await Promise.all([
      financeSummary(l.id),
      prisma.playerRegistration.count({ where: { leagueId: l.id } }),
      prisma.match.count({ where: { leagueId: l.id, status: 'COMPLETED' } }),
      prisma.ticketOrder.aggregate({ where: { status: 'PAID', category: { leagueId: l.id } }, _sum: { qty: true } }),
      prisma.surveyResponse.findMany({ where: { survey: { leagueId: l.id, audience: 'FANS' } }, select: { score: true } }),
      prisma.sponsorDeal.aggregate({ where: { leagueId: l.id, stage: 'WON' }, _sum: { value: true } }),
    ]);
    return {
      id: l.id, season: l.season ?? '—', status: l.status, players: regs, matchesPlayed: played, ticketsSold: tickets._sum.qty ?? 0,
      income: fin.pnl.income, expense: fin.pnl.expense, profit: fin.pnl.profit, sponsorshipWon: won._sum.value ?? 0, fanNps: nps(fanResponses.map((r) => r.score)).score,
    };
  }));
}
