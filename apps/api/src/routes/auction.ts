import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, notify } from '../lib/notify.js';
import { publish } from '../lib/realtime.js';

/** Live player auction. Mounted at /api/leagues/:leagueId/auction */
const r = Router({ mergeParams: true });
export const ch = (leagueId: string) => `auction:${leagueId}`;

r.use(requireAuth);

const playerInc = { player: { include: { user: { select: { name: true } } } } };

async function getAuction(leagueId: string) {
  return (await prisma.auction.findUnique({ where: { leagueId } })) ?? prisma.auction.create({ data: { leagueId } });
}

/** Team purse, spend and squad composition */
async function teamBoards(leagueId: string) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { teams: { orderBy: { createdAt: 'asc' }, include: { owners: { select: { userId: true } } } } } });
  const sold = await prisma.playerRegistration.findMany({ where: { leagueId, teamId: { not: null } }, include: playerInc });
  return league.teams.map((t) => {
    const mine = sold.filter((s) => s.teamId === t.id);
    const purse = t.purse ?? league.teamPurse ?? 0;
    const spent = mine.reduce((s, x) => s + (x.soldPrice ?? 0), 0);
    return {
      id: t.id, name: t.name, shortName: t.shortName, logoUrl: t.logoUrl, color: t.color, ownerIds: t.owners.map((o) => o.userId),
      purse, spent, remaining: purse - spent, squad: mine.length, overseas: mine.filter((m) => m.isOverseas).length,
      players: mine.map((m) => ({ name: m.player.user.name, role: m.player.playingRole, price: m.soldPrice })),
    };
  });
}

async function state(leagueId: string) {
  const a = await getAuction(leagueId);
  const [teams, current, bids, pool, soldCount, unsoldCount] = await Promise.all([
    teamBoards(leagueId),
    a.currentRegId ? prisma.playerRegistration.findUnique({ where: { id: a.currentRegId }, include: playerInc }) : null,
    a.currentRegId ? prisma.auctionBid.findMany({ where: { auctionId: a.id, regId: a.currentRegId, amount: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: 15 }) : [],
    prisma.playerRegistration.findMany({ where: { leagueId, status: { in: ['SHORTLISTED', 'APPLIED', 'UNSOLD'] }, teamId: null }, include: playerInc, orderBy: [{ basePrice: 'desc' }] }),
    prisma.playerRegistration.count({ where: { leagueId, status: 'SOLD' } }),
    prisma.playerRegistration.count({ where: { leagueId, status: 'UNSOLD' } }),
  ]);
  const lastBids = await prisma.auctionBid.findMany({ where: { auctionId: a.id }, orderBy: { createdAt: 'desc' }, take: 200 });
  // Recent sold players in the order they were sold (from bid history)
  const soldIds: string[] = [];
  for (const b of lastBids) if (!soldIds.includes(b.regId)) soldIds.push(b.regId);
  const sold = await prisma.playerRegistration.findMany({ where: { id: { in: soldIds }, status: { in: ['SOLD', 'UNSOLD'] } }, include: { ...playerInc, team: { select: { name: true } } } });
  return {
    auction: a,
    serverTime: new Date().toISOString(),
    teams,
    current: current && {
      id: current.id, name: current.player.user.name, role: current.player.playingRole, battingStyle: current.player.battingStyle, bowlingStyle: current.player.bowlingStyle,
      city: current.player.city, matches: current.player.matches, runs: current.player.runs, wickets: current.player.wickets,
      category: current.category, basePrice: current.basePrice, isOverseas: current.isOverseas,
    },
    bids,
    nextBid: a.currentRegId ? (a.currentBid ? a.currentBid + a.bidIncrement : (current?.basePrice ?? a.bidIncrement)) : null,
    pool: pool.filter((p) => p.id !== a.currentRegId).map((p) => ({ id: p.id, name: p.player.user.name, role: p.player.playingRole, category: p.category, basePrice: p.basePrice, status: p.status })),
    log: soldIds.map((id) => sold.find((s) => s.id === id)).filter(Boolean).slice(0, 20).map((s) => ({ id: s!.id, name: s!.player.user.name, status: s!.status, team: s!.team?.name ?? null, price: s!.soldPrice })),
    counts: { sold: soldCount, unsold: unsoldCount, pool: pool.length },
  };
}

r.get('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  res.json(await state(req.params.leagueId));
}));

const push = async (leagueId: string) => { const s = await state(leagueId); publish(ch(leagueId), { at: Date.now() }); return s; };

r.patch('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = z.object({
    bidIncrement: z.coerce.number().int().min(1).optional(), timerSeconds: z.coerce.number().int().min(5).max(300).optional(),
    minSquad: z.coerce.number().int().min(1).max(40).optional(), maxSquad: z.coerce.number().int().min(1).max(40).optional(),
  }).parse(req.body);
  const a = await getAuction(leagueId);
  await prisma.auction.update({ where: { id: a.id }, data: d });
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'auction-setup' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'auction-setup', status: 'DONE' } });
  res.json(await push(leagueId));
}));

r.post('/status', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { status } = z.object({ status: z.enum(['LIVE', 'PAUSED', 'COMPLETED']) }).parse(req.body);
  const a = await getAuction(leagueId);
  await prisma.auction.update({ where: { id: a.id }, data: { status, ...(status === 'LIVE' && a.currentRegId && { endsAt: new Date(Date.now() + a.timerSeconds * 1000) }), ...(status === 'COMPLETED' && { currentRegId: null, currentBid: null, currentTeamId: null, endsAt: null }) } });
  if (status === 'LIVE' && a.status === 'SETUP') {
    const owners = await prisma.teamOwner.findMany({ where: { team: { leagueId } } });
    await notify(owners.map((o) => o.userId), 'The player auction is LIVE', { link: `/leagues/${leagueId}/auction`, type: 'alert' });
  }
  if (status === 'COMPLETED') {
    await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'auction-event' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'auction-event', status: 'DONE' } });
  }
  res.json(await push(leagueId));
}));

// Bring the next player to the podium (specific or random from pool / category)
r.post('/next', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { regId, category } = z.object({ regId: z.string().optional(), category: z.string().optional() }).parse(req.body);
  const a = await getAuction(leagueId);
  if (a.status !== 'LIVE') throw new HttpError(400, 'Start the auction first');
  if (a.currentRegId && a.currentBid) throw new HttpError(400, 'Sell or mark the current player unsold first');
  let id = regId;
  if (!id) {
    const pool = await prisma.playerRegistration.findMany({ where: { leagueId, teamId: null, status: { in: ['SHORTLISTED', 'APPLIED'] }, ...(category && { category }) }, select: { id: true } });
    if (!pool.length) throw new HttpError(400, 'No players left in this pool');
    id = pool[Math.floor(Math.random() * pool.length)].id;
  }
  const reg = await prisma.playerRegistration.findFirst({ where: { id, leagueId, teamId: null } });
  if (!reg) throw new HttpError(404, 'Player not available');
  await prisma.auction.update({ where: { id: a.id }, data: { currentRegId: id, currentBid: null, currentTeamId: null, endsAt: new Date(Date.now() + a.timerSeconds * 1000) } });
  res.json(await push(leagueId));
}));

// Place a bid. Team owners bid for their own team; league staff (auctioneer desk) can bid for any team.
r.post('/bid', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId);
  const { teamId, amount } = z.object({ teamId: z.string(), amount: z.coerce.number().int().optional() }).parse(req.body);
  if (access === 'team' && !(await prisma.teamOwner.findFirst({ where: { teamId, userId: u.id } }))) throw new HttpError(403, 'You can only bid for your own team');
  const a = await getAuction(leagueId);
  if (a.status !== 'LIVE' || !a.currentRegId) throw new HttpError(400, 'No player is up for bidding');
  if (a.endsAt && a.endsAt.getTime() < Date.now() - 500) throw new HttpError(400, 'Bidding time is over for this player');
  if (a.currentTeamId === teamId) throw new HttpError(400, 'Your team already holds the highest bid');
  const reg = await prisma.playerRegistration.findUniqueOrThrow({ where: { id: a.currentRegId } });
  const min = a.currentBid ? a.currentBid + a.bidIncrement : (reg.basePrice ?? a.bidIncrement);
  const bid = amount ?? min;
  if (bid < min) throw new HttpError(400, `Minimum bid is ₹${min.toLocaleString('en-IN')}`);
  const board = (await teamBoards(leagueId)).find((t) => t.id === teamId);
  if (!board) throw new HttpError(404, 'Team not found');
  if (board.squad >= a.maxSquad) throw new HttpError(400, `${board.name} already has a full squad (${a.maxSquad})`);
  // Keep enough purse to complete the minimum squad at base prices
  const slotsAfter = Math.max(0, a.minSquad - board.squad - 1);
  if (bid > board.remaining - slotsAfter * a.bidIncrement) throw new HttpError(400, `${board.name} does not have enough purse remaining`);
  // Optimistic concurrency: only succeeds if nobody bid in the meantime
  const upd = await prisma.auction.updateMany({
    where: { id: a.id, currentRegId: a.currentRegId, currentBid: a.currentBid },
    data: { currentBid: bid, currentTeamId: teamId, endsAt: new Date(Date.now() + Math.max(10, a.timerSeconds) * 1000) },
  });
  if (!upd.count) throw new HttpError(409, 'Another bid came in first — try again');
  await prisma.auctionBid.create({ data: { auctionId: a.id, regId: a.currentRegId, teamId, amount: bid, byUserId: u.id } });
  res.json(await push(leagueId));
}));

r.post('/sell', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const a = await getAuction(leagueId);
  if (!a.currentRegId || !a.currentTeamId || !a.currentBid) throw new HttpError(400, 'No winning bid to sell');
  const reg = await prisma.playerRegistration.update({ where: { id: a.currentRegId }, data: { status: 'SOLD', teamId: a.currentTeamId, soldPrice: a.currentBid }, include: { team: true, player: { include: { user: true } } } });
  await prisma.auction.update({ where: { id: a.id }, data: { currentRegId: null, currentBid: null, currentTeamId: null, endsAt: null } });
  const owners = await prisma.teamOwner.findMany({ where: { teamId: a.currentTeamId } });
  await notify(reg.player.userId, `SOLD! You've been picked by ${reg.team!.name} for ₹${a.currentBid.toLocaleString('en-IN')}`, { link: '/player', type: 'success' });
  await notify(owners.map((o) => o.userId), `${reg.player.user.name} joins ${reg.team!.name}`, { body: `Bought for ₹${a.currentBid.toLocaleString('en-IN')}`, link: `/leagues/${leagueId}/auction`, type: 'success' });
  await audit(me(req).id, 'sold', 'PlayerRegistration', reg.id, { teamId: a.currentTeamId, price: a.currentBid });
  res.json(await push(leagueId));
}));

r.post('/unsold', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const a = await getAuction(leagueId);
  if (!a.currentRegId) throw new HttpError(400, 'No player on the podium');
  await prisma.playerRegistration.update({ where: { id: a.currentRegId }, data: { status: 'UNSOLD' } });
  await prisma.auctionBid.create({ data: { auctionId: a.id, regId: a.currentRegId, teamId: '-', amount: 0 } }); // marks it in the log
  await prisma.auction.update({ where: { id: a.id }, data: { currentRegId: null, currentBid: null, currentTeamId: null, endsAt: null } });
  res.json(await push(leagueId));
}));

// Re-open unsold players for an accelerated round
r.post('/reopen-unsold', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { count } = await prisma.playerRegistration.updateMany({ where: { leagueId, status: 'UNSOLD' }, data: { status: 'SHORTLISTED' } });
  await push(leagueId);
  res.json({ count });
}));

export default r;
