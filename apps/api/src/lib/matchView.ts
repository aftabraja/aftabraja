import { prisma } from './prisma.js';
import { buildInnings, nextState } from './cricket.js';

export const teamSel = { select: { id: true, name: true, shortName: true, logoUrl: true, color: true } };

/** Full match view: teams, squads, both innings, next-ball state, target and result. */
export async function matchView(id: string) {
  const m = await prisma.match.findUniqueOrThrow({
    where: { id },
    include: { homeTeam: teamSel, awayTeam: teamSel, venue: true, balls: { orderBy: { seq: 'asc' } }, league: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
  const { balls, ...match } = m;
  const battingFirst = m.tossWinnerId && m.tossDecision
    ? (m.tossDecision === 'BAT' ? m.tossWinnerId : m.tossWinnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId)
    : null;
  const battingSecond = battingFirst ? (battingFirst === m.homeTeamId ? m.awayTeamId : m.homeTeamId) : null;
  const inn1 = buildInnings(balls, 1);
  const inn2 = buildInnings(balls, 2);
  inn1.battingTeamId ??= battingFirst;
  inn2.battingTeamId ??= battingSecond;
  const quota = (m.oversPerSide ?? 20) * 6;
  const xiOf = (teamId: string | null) => (teamId === m.homeTeamId ? m.homeXI : m.awayXI);
  const maxWkts = (teamId: string | null) => Math.max(1, (xiOf(teamId).length || 11) - 1);
  const cur = m.currentInnings === 2 ? inn2 : inn1;
  const target = m.currentInnings === 2 ? inn1.runs + 1 : null;
  const inningsOver = cur.legalBalls >= quota || cur.wickets >= maxWkts(cur.battingTeamId) || (target !== null && cur.runs >= target);
  const ballsLeft = quota - cur.legalBalls;
  return {
    ...match,
    battingFirst, battingSecond,
    innings: [inn1, inn2],
    next: m.status === 'LIVE' ? nextState(balls, m.currentInnings) : null,
    target,
    required: target !== null ? { runs: Math.max(0, target - cur.runs), balls: ballsLeft, rrr: ballsLeft ? Math.round(((target - cur.runs) / (ballsLeft / 6)) * 100) / 100 : 0 } : null,
    crr: cur.legalBalls ? Math.round((cur.runs / (cur.legalBalls / 6)) * 100) / 100 : 0,
    inningsOver,
    ballCount: balls.length,
  };
}

/** Decide the result from the two innings */
export function computeResult(v: Awaited<ReturnType<typeof matchView>>) {
  const [i1, i2] = v.innings;
  const name = (id: string | null) => (id === v.homeTeamId ? v.homeTeam?.name : v.awayTeam?.name) ?? 'Team';
  if (i2.runs > i1.runs) {
    const xi = i2.battingTeamId === v.homeTeamId ? v.homeXI : v.awayXI;
    const left = Math.max(1, (xi.length || 11) - 1) - i2.wickets;
    return { winnerTeamId: i2.battingTeamId, resultText: `${name(i2.battingTeamId)} won by ${left} wicket${left === 1 ? '' : 's'}` };
  }
  if (i1.runs > i2.runs) {
    const d = i1.runs - i2.runs;
    return { winnerTeamId: i1.battingTeamId, resultText: `${name(i1.battingTeamId)} won by ${d} run${d === 1 ? '' : 's'}` };
  }
  return { winnerTeamId: null, resultText: 'Match tied' };
}
