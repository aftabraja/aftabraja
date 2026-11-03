import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { publish } from '../lib/realtime.js';
import { standings } from '../lib/standings.js';
import { computeResult, matchView, teamSel } from '../lib/matchView.js';
import { roundRobin } from '../lib/schedule.js';

/** Venues, fixtures, auto-scheduler, playoffs, standings and ball-by-ball scoring. Mounted at /api/leagues/:leagueId */
const r = Router({ mergeParams: true });

r.use(requireAuth);

// ---------- Venues ----------
const venueSchema = z.object({ name: z.string().min(2), city: z.string().optional().nullable(), address: z.string().optional().nullable(), capacity: z.coerce.number().int().optional().nullable() });
r.get('/venues', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId); res.json(await prisma.venue.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { name: 'asc' } })); }));
r.post('/venues', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.status(201).json(await prisma.venue.create({ data: { ...venueSchema.parse(req.body), leagueId: req.params.leagueId } })); }));
r.patch('/venues/:vid', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.venue.update({ where: { id: req.params.vid, leagueId: req.params.leagueId }, data: venueSchema.partial().parse(req.body) })); }));
r.delete('/venues/:vid', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.venue.delete({ where: { id: req.params.vid, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

// ---------- Matches ----------
r.get('/matches', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  res.json(await prisma.match.findMany({
    where: { leagueId: req.params.leagueId },
    orderBy: [{ startsAt: 'asc' }, { number: 'asc' }],
    include: { homeTeam: teamSel, awayTeam: teamSel, venue: { select: { id: true, name: true, city: true } } },
  }));
}));

const matchSchema = z.object({
  stage: z.string().optional(), homeTeamId: z.string().nullable().optional(), awayTeamId: z.string().nullable().optional(),
  homeLabel: z.string().nullable().optional(), awayLabel: z.string().nullable().optional(), venueId: z.string().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(), oversPerSide: z.coerce.number().int().min(1).max(50).nullable().optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'COMPLETED', 'ABANDONED']).optional(), isPublished: z.boolean().optional(),
});

r.post('/matches', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const last = await prisma.match.aggregate({ where: { leagueId }, _max: { number: true } });
  res.status(201).json(await prisma.match.create({ data: { ...matchSchema.parse(req.body), leagueId, number: (last._max.number ?? 0) + 1 } }));
}));

r.patch('/matches/:mid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const m = await prisma.match.update({ where: { id: req.params.mid, leagueId: req.params.leagueId }, data: matchSchema.parse(req.body) });
  publish(`match:${m.id}`);
  res.json(m);
}));

r.delete('/matches/:mid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.match.delete({ where: { id: req.params.mid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

r.post('/matches/publish', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { count } = await prisma.match.updateMany({ where: { leagueId }, data: { isPublished: true } });
  const owners = await prisma.teamOwner.findMany({ where: { team: { leagueId } } });
  await notify([...(await leagueManagers(leagueId)), ...owners.map((o) => o.userId)], 'Fixtures published', { body: `${count} matches are now on the schedule.`, link: `/leagues/${leagueId}/fixtures`, type: 'success' });
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'publish-schedule' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'publish-schedule', status: 'DONE' } });
  res.json({ count });
}));

/**
 * Auto-scheduler: round-robin (circle method) + greedy day/slot packing that respects
 * minimum rest days between a team's matches, one match per team per day, and venue rotation.
 */
const schedSchema = z.object({
  startDate: z.coerce.date(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(4),
  rounds: z.coerce.number().int().min(1).max(2).default(1),
  restDays: z.coerce.number().int().min(0).max(5).default(1),
  venueIds: z.array(z.string()).default([]),
  oversPerSide: z.coerce.number().int().min(1).max(50).default(20),
  playoffs: z.enum(['NONE', 'FINAL', 'SEMIS', 'IPL']).default('IPL'),
  restDaysBeforePlayoffs: z.coerce.number().int().min(0).max(7).default(1),
  replace: z.boolean().default(true),
});


r.post('/schedule/generate', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = schedSchema.parse(req.body);
  const teams = await prisma.team.findMany({ where: { leagueId }, orderBy: { createdAt: 'asc' } });
  if (teams.length < 2) throw new HttpError(400, 'Add at least 2 teams first');
  if (d.replace) {
    const started = await prisma.match.count({ where: { leagueId, status: { in: ['LIVE', 'COMPLETED'] } } });
    if (started) throw new HttpError(400, 'Some matches have already started — cannot replace the schedule');
    await prisma.match.deleteMany({ where: { leagueId } });
  }
  const queue = roundRobin(teams.map((t) => t.id), d.rounds);
  const lastPlayed = new Map<string, number>(); // team -> day index
  const plan: { home: string; away: string; day: number; slot: number }[] = [];
  let day = 0;
  while (queue.length && day < 1000) {
    const today = new Set<string>();
    for (let slot = 0; slot < d.times.length; slot++) {
      const idx = queue.findIndex(([h, a]) => !today.has(h) && !today.has(a)
        && (lastPlayed.get(h) === undefined || day - lastPlayed.get(h)! > d.restDays)
        && (lastPlayed.get(a) === undefined || day - lastPlayed.get(a)! > d.restDays));
      if (idx === -1) break;
      const [h, a] = queue.splice(idx, 1)[0];
      today.add(h); today.add(a); lastPlayed.set(h, day); lastPlayed.set(a, day);
      plan.push({ home: h, away: a, day, slot });
    }
    day++;
  }
  const at = (dayIdx: number, slot: number) => {
    const dt = new Date(d.startDate);
    dt.setDate(dt.getDate() + dayIdx);
    const [hh, mm] = d.times[slot].split(':').map(Number);
    dt.setHours(hh, mm, 0, 0);
    return dt;
  };
  const start = (await prisma.match.aggregate({ where: { leagueId }, _max: { number: true } }))._max.number ?? 0;
  const data: Prisma.MatchCreateManyInput[] = plan.map((p, i) => ({
    leagueId, number: start + i + 1, stage: 'League', homeTeamId: p.home, awayTeamId: p.away,
    venueId: d.venueIds.length ? d.venueIds[i % d.venueIds.length] : null, startsAt: at(p.day, p.slot), oversPerSide: d.oversPerSide,
  }));
  // Playoffs
  let pDay = (plan.at(-1)?.day ?? 0) + 1 + d.restDaysBeforePlayoffs;
  const po: { stage: string; homeLabel: string; awayLabel: string }[] =
    d.playoffs === 'IPL' ? [
      { stage: 'Qualifier 1', homeLabel: '1st place', awayLabel: '2nd place' },
      { stage: 'Eliminator', homeLabel: '3rd place', awayLabel: '4th place' },
      { stage: 'Qualifier 2', homeLabel: 'Loser Qualifier 1', awayLabel: 'Winner Eliminator' },
      { stage: 'Final', homeLabel: 'Winner Qualifier 1', awayLabel: 'Winner Qualifier 2' },
    ] : d.playoffs === 'SEMIS' ? [
      { stage: 'Semi-final 1', homeLabel: '1st place', awayLabel: '4th place' },
      { stage: 'Semi-final 2', homeLabel: '2nd place', awayLabel: '3rd place' },
      { stage: 'Final', homeLabel: 'Winner Semi-final 1', awayLabel: 'Winner Semi-final 2' },
    ] : d.playoffs === 'FINAL' ? [{ stage: 'Final', homeLabel: '1st place', awayLabel: '2nd place' }] : [];
  po.forEach((p, i) => {
    const sameDay = i === 1 && (d.playoffs === 'IPL' || d.playoffs === 'SEMIS'); // e.g. Q1 + Eliminator double-header
    if (i > 0 && !sameDay) pDay += 1;
    data.push({ leagueId, number: start + data.length + 1, stage: p.stage, homeLabel: p.homeLabel, awayLabel: p.awayLabel, venueId: d.venueIds[0] ?? null, startsAt: at(pDay, sameDay ? Math.min(1, d.times.length - 1) : 0), oversPerSide: d.oversPerSide });
  });
  await prisma.match.createMany({ data });
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'fixture-schedule' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'fixture-schedule', status: 'DONE' } });
  await audit(me(req).id, 'generate', 'Schedule', leagueId, { matches: data.length });
  res.status(201).json({ created: data.length, leagueMatches: plan.length, days: (plan.at(-1)?.day ?? 0) + 1 });
}));

// Fill "1st place".."4th place" playoff slots from the current points table
r.post('/schedule/seed-playoffs', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const { rows } = await standings(leagueId);
  const place = ['1st place', '2nd place', '3rd place', '4th place'];
  const ms = await prisma.match.findMany({ where: { leagueId, stage: { not: 'League' } } });
  for (const m of ms) {
    const h = place.indexOf(m.homeLabel ?? ''), a = place.indexOf(m.awayLabel ?? '');
    await prisma.match.update({ where: { id: m.id }, data: { ...(h >= 0 && rows[h] && { homeTeamId: rows[h].teamId }), ...(a >= 0 && rows[a] && { awayTeamId: rows[a].teamId }) } });
  }
  res.json({ ok: true });
}));

r.get('/standings', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  res.json(await standings(req.params.leagueId));
}));

// ---------- Scoring ----------
async function loadForScoring(req: { params: Record<string, string> } & Parameters<typeof me>[0]) {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const m = await prisma.match.findFirst({ where: { id: req.params.mid, leagueId: req.params.leagueId } });
  if (!m) throw new HttpError(404, 'Match not found');
  return m;
}

r.get('/matches/:mid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  const v = await matchView(req.params.mid);
  if (v.leagueId !== req.params.leagueId) throw new HttpError(404, 'Match not found');
  const squads = await prisma.playerRegistration.findMany({
    where: { leagueId: req.params.leagueId, teamId: { in: [v.homeTeamId, v.awayTeamId].filter(Boolean) as string[] } },
    include: { player: { include: { user: { select: { name: true } } } } },
  });
  res.json({ ...v, squads: { home: squads.filter((s) => s.teamId === v.homeTeamId).map((s) => s.player.user.name), away: squads.filter((s) => s.teamId === v.awayTeamId).map((s) => s.player.user.name) } });
}));

r.post('/matches/:mid/start', ah(async (req, res) => {
  const m = await loadForScoring(req);
  if (!m.homeTeamId || !m.awayTeamId) throw new HttpError(400, 'Both teams must be set before the toss');
  const d = z.object({
    tossWinnerId: z.string(), tossDecision: z.enum(['BAT', 'BOWL']),
    homeXI: z.array(z.string().min(1)).min(2).max(15), awayXI: z.array(z.string().min(1)).min(2).max(15),
    oversPerSide: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.body);
  if (![m.homeTeamId, m.awayTeamId].includes(d.tossWinnerId)) throw new HttpError(400, 'Toss winner must be one of the teams');
  await prisma.match.update({ where: { id: m.id }, data: { ...d, status: 'LIVE', currentInnings: 1 } });
  publish(`match:${m.id}`);
  res.json(await matchView(m.id));
}));

const ballSchema = z.object({
  striker: z.string().min(1), nonStriker: z.string().min(1), bowler: z.string().min(1),
  runs: z.coerce.number().int().min(0).max(7).default(0),
  extraType: z.enum(['WD', 'NB', 'B', 'LB']).nullable().optional(),
  extraRuns: z.coerce.number().int().min(0).max(7).default(0),
  wicket: z.enum(['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED']).nullable().optional(),
  dismissed: z.string().nullable().optional(), fielder: z.string().nullable().optional(),
});

r.post('/matches/:mid/balls', ah(async (req, res) => {
  const m = await loadForScoring(req);
  if (m.status !== 'LIVE') throw new HttpError(400, 'Match is not live');
  const b = ballSchema.parse(req.body);
  if (b.striker === b.nonStriker) throw new HttpError(400, 'Striker and non-striker must be different');
  // Wides and no-balls always carry at least the 1-run penalty
  if ((b.extraType === 'WD' || b.extraType === 'NB') && b.extraRuns < 1) b.extraRuns = 1;
  if (b.extraType === 'WD') b.runs = 0;
  if (b.wicket && !b.dismissed) b.dismissed = b.striker;
  const v = await matchView(m.id);
  if (v.inningsOver) throw new HttpError(400, 'This innings is complete — start the next innings or finish the match');
  const battingTeamId = m.currentInnings === 1 ? v.battingFirst! : v.battingSecond!;
  const last = await prisma.ball.aggregate({ where: { matchId: m.id }, _max: { seq: true } });
  await prisma.ball.create({ data: { ...b, extraType: b.extraType ?? null, wicket: b.wicket ?? null, matchId: m.id, innings: m.currentInnings, battingTeamId, seq: (last._max.seq ?? 0) + 1 } });
  const out = await matchView(m.id);
  publish(`match:${m.id}`, { kind: 'ball' });
  res.status(201).json(out);
}));

r.delete('/matches/:mid/balls/last', ah(async (req, res) => {
  const m = await loadForScoring(req);
  const last = await prisma.ball.findFirst({ where: { matchId: m.id, innings: m.currentInnings }, orderBy: { seq: 'desc' } });
  if (!last) throw new HttpError(400, 'Nothing to undo in this innings');
  await prisma.ball.delete({ where: { id: last.id } });
  publish(`match:${m.id}`, { kind: 'undo' });
  res.json(await matchView(m.id));
}));

r.post('/matches/:mid/innings/next', ah(async (req, res) => {
  const m = await loadForScoring(req);
  if (m.currentInnings !== 1) throw new HttpError(400, 'Already in the second innings');
  await prisma.match.update({ where: { id: m.id }, data: { currentInnings: 2 } });
  publish(`match:${m.id}`);
  res.json(await matchView(m.id));
}));

/** When a playoff match finishes, push winner/loser into dependent fixtures */
async function propagate(leagueId: string, stage: string, winner: string | null, loser: string | null) {
  const deps = await prisma.match.findMany({ where: { leagueId, OR: [{ homeLabel: { in: [`Winner ${stage}`, `Loser ${stage}`] } }, { awayLabel: { in: [`Winner ${stage}`, `Loser ${stage}`] } }] } });
  for (const d of deps) {
    const pick = (label: string | null) => (label === `Winner ${stage}` ? winner : label === `Loser ${stage}` ? loser : undefined);
    const h = pick(d.homeLabel), a = pick(d.awayLabel);
    await prisma.match.update({ where: { id: d.id }, data: { ...(h !== undefined && { homeTeamId: h }), ...(a !== undefined && { awayTeamId: a }) } });
  }
}

r.post('/matches/:mid/complete', ah(async (req, res) => {
  const m = await loadForScoring(req);
  const { abandoned, resultText } = z.object({ abandoned: z.boolean().optional(), resultText: z.string().optional() }).parse(req.body);
  let data: { status: string; winnerTeamId: string | null; resultText: string };
  if (abandoned) data = { status: 'ABANDONED', winnerTeamId: null, resultText: resultText || 'No result' };
  else {
    const v = await matchView(m.id);
    data = { status: 'COMPLETED', ...computeResult(v) };
    if (resultText) data.resultText = resultText;
  }
  await prisma.match.update({ where: { id: m.id }, data });
  if (m.stage !== 'League' && data.winnerTeamId) {
    await propagate(m.leagueId, m.stage, data.winnerTeamId, data.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId);
  }
  const owners = await prisma.teamOwner.findMany({ where: { teamId: { in: [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[] } } });
  await notify([...(await leagueManagers(m.leagueId)), ...owners.map((o) => o.userId)], `Match ${m.number}: ${data.resultText}`, { link: `/leagues/${m.leagueId}/matches/${m.id}`, type: 'info' });
  publish(`match:${m.id}`, { kind: 'complete' });
  res.json(await matchView(m.id));
}));

export default r;
