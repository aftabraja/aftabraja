import { prisma } from './prisma.js';
import { buildInnings } from './cricket.js';

export interface Row { teamId: string; name: string; logoUrl: string | null; played: number; won: number; lost: number; drawn: number; nr: number; points: number; for: number; against: number; nrr: number; form: string[] }

/** Cricket points table for league-stage matches: Win 2, Tie / No result 1, sorted by points then NRR. */
export const POINTS = { win: 2, tie: 1, noResult: 1 };

export async function standings(leagueId: string): Promise<{ rows: Row[] }> {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { teams: true } });
  const matches = await prisma.match.findMany({
    where: { leagueId, stage: 'League', status: { in: ['COMPLETED', 'ABANDONED'] } },
    orderBy: { startsAt: 'asc' },
    include: { balls: true },
  });
  const rows = new Map<string, Row & { ballsFaced: number; ballsBowled: number }>();
  league.teams.forEach((t) => rows.set(t.id, { teamId: t.id, name: t.name, logoUrl: t.logoUrl, played: 0, won: 0, lost: 0, drawn: 0, nr: 0, points: 0, for: 0, against: 0, nrr: 0, form: [], ballsFaced: 0, ballsBowled: 0 }));

  for (const m of matches) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    const h = rows.get(m.homeTeamId), a = rows.get(m.awayTeamId);
    if (!h || !a) continue;
    h.played++; a.played++;
    if (m.status === 'ABANDONED') { h.nr++; a.nr++; h.points += POINTS.noResult; a.points += POINTS.noResult; h.form.push('N'); a.form.push('N'); continue; }
    {
      const quota = (m.oversPerSide ?? 20) * 6;
      const allOut = (xi: string[]) => Math.max(1, (xi.length || 11) - 1);
      for (const i of [1, 2]) {
        const inn = buildInnings(m.balls, i);
        if (!inn.battingTeamId) continue;
        const bat = rows.get(inn.battingTeamId)!, bowl = inn.battingTeamId === h.teamId ? a : h;
        const xi = inn.battingTeamId === m.homeTeamId ? m.homeXI : m.awayXI;
        const faced = inn.wickets >= allOut(xi) ? quota : inn.legalBalls;
        bat.for += inn.runs; bat.ballsFaced += faced; bowl.against += inn.runs; bowl.ballsBowled += faced;
      }
    }
    if (!m.winnerTeamId) { h.drawn++; a.drawn++; h.points += POINTS.tie; a.points += POINTS.tie; h.form.push('D'); a.form.push('D'); }
    else {
      const w = m.winnerTeamId === h.teamId ? h : a, l = w === h ? a : h;
      w.won++; l.lost++; w.points += POINTS.win; w.form.push('W'); l.form.push('L');
    }
  }
  const out = [...rows.values()].map(({ ballsFaced, ballsBowled, ...r }) => ({
    ...r,
    nrr: Math.round(((ballsFaced ? r.for / (ballsFaced / 6) : 0) - (ballsBowled ? r.against / (ballsBowled / 6) : 0)) * 1000) / 1000,
    form: r.form.slice(-5),
  }));
  out.sort((x, y) => y.points - x.points || y.nrr - x.nrr || y.won - x.won || x.name.localeCompare(y.name));
  return { rows: out };
}
