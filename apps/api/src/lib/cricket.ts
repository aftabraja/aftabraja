import type { Ball } from '@prisma/client';

/**
 * Cricket scoring engine: derives scorecards, partnerships of strike, overs and the
 * next-ball state purely from the ordered list of balls. Undo = delete last ball.
 */
export const isLegal = (b: Pick<Ball, 'extraType'>) => b.extraType !== 'WD' && b.extraType !== 'NB';
export const ballRuns = (b: Pick<Ball, 'runs' | 'extraRuns'>) => b.runs + b.extraRuns;
/** Runs physically run by the batters (decides strike rotation) */
const ran = (b: Ball) => {
  if (b.extraType === 'WD') return Math.max(0, b.extraRuns - 1);
  if (b.extraType === 'B' || b.extraType === 'LB') return b.extraRuns;
  if (b.extraType === 'NB') return b.runs + Math.max(0, b.extraRuns - 1);
  return b.runs;
};
/** Runs charged to the bowler (byes & leg-byes are not) */
const bowlerRuns = (b: Ball) => (b.extraType === 'B' || b.extraType === 'LB' ? b.runs : b.runs + b.extraRuns);
const bowlerWicket = (w?: string | null) => !!w && !['RUN_OUT', 'RETIRED'].includes(w);

export const oversStr = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`;
export const oversDec = (legal: number) => legal / 6;

export interface Innings {
  innings: number;
  battingTeamId: string | null;
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: string;
  extras: { WD: number; NB: number; B: number; LB: number; total: number };
  batting: { name: string; runs: number; balls: number; fours: number; sixes: number; out: string | null; sr: number }[];
  bowling: { name: string; balls: number; overs: string; maidens: number; runs: number; wickets: number; econ: number }[];
  fallOfWickets: { wicket: number; runs: number; over: string; batter: string }[];
  thisOver: string[];
  recent: string[];
}

export function ballLabel(b: Ball) {
  let s = '';
  if (b.extraType === 'WD') s = `${b.extraRuns > 1 ? b.extraRuns - 1 : ''}wd`;
  else if (b.extraType === 'NB') s = `${b.runs ? b.runs : ''}nb`;
  else if (b.extraType === 'B' || b.extraType === 'LB') s = `${b.extraRuns}${b.extraType.toLowerCase()}`;
  else s = b.runs === 0 ? '•' : String(b.runs);
  return b.wicket ? (s === '•' ? 'W' : `${s}+W`) : s;
}

const outText = (b: Ball) => {
  switch (b.wicket) {
    case 'BOWLED': return `b ${b.bowler}`;
    case 'LBW': return `lbw b ${b.bowler}`;
    case 'CAUGHT': return b.fielder && b.fielder !== b.bowler ? `c ${b.fielder} b ${b.bowler}` : `c & b ${b.bowler}`;
    case 'STUMPED': return `st ${b.fielder ?? ''} b ${b.bowler}`;
    case 'HIT_WICKET': return `hit wicket b ${b.bowler}`;
    case 'RUN_OUT': return `run out${b.fielder ? ` (${b.fielder})` : ''}`;
    case 'RETIRED': return 'retired';
    default: return 'out';
  }
};

export function buildInnings(all: Ball[], innings: number): Innings {
  const balls = all.filter((b) => b.innings === innings).sort((a, b) => a.seq - b.seq);
  const inn: Innings = {
    innings, battingTeamId: balls[0]?.battingTeamId ?? null, runs: 0, wickets: 0, legalBalls: 0, overs: '0.0',
    extras: { WD: 0, NB: 0, B: 0, LB: 0, total: 0 }, batting: [], bowling: [], fallOfWickets: [], thisOver: [], recent: [],
  };
  const bat = new Map<string, Innings['batting'][number]>();
  const bowl = new Map<string, Innings['bowling'][number] & { overRuns: number[] }>();
  const batter = (n: string) => { if (!bat.has(n)) bat.set(n, { name: n, runs: 0, balls: 0, fours: 0, sixes: 0, out: null, sr: 0 }); return bat.get(n)!; };
  const bowler = (n: string) => { if (!bowl.has(n)) bowl.set(n, { name: n, balls: 0, overs: '0.0', maidens: 0, runs: 0, wickets: 0, econ: 0, overRuns: [] }); return bowl.get(n)!; };
  let overRuns = 0;

  for (const b of balls) {
    const st = batter(b.striker);
    if (b.nonStriker) batter(b.nonStriker);
    const bw = bowler(b.bowler);
    inn.runs += ballRuns(b);
    if (b.extraType) { inn.extras[b.extraType as 'WD'] += b.extraRuns; inn.extras.total += b.extraRuns; }
    if (b.extraType !== 'WD') { st.balls += 1; st.runs += b.runs; if (b.runs === 4) st.fours++; if (b.runs === 6) st.sixes++; }
    bw.runs += bowlerRuns(b);
    overRuns += bowlerRuns(b);
    if (isLegal(b)) { inn.legalBalls++; bw.balls++; }
    if (b.wicket) {
      inn.wickets += b.wicket === 'RETIRED' ? 0 : 1;
      const d = batter(b.dismissed ?? b.striker);
      d.out = outText(b);
      if (bowlerWicket(b.wicket)) bw.wickets++;
      inn.fallOfWickets.push({ wicket: inn.wickets, runs: inn.runs, over: oversStr(inn.legalBalls), batter: d.name });
    }
    inn.thisOver.push(ballLabel(b));
    if (isLegal(b) && inn.legalBalls % 6 === 0) {
      if (overRuns === 0) bw.maidens++;
      overRuns = 0;
      inn.thisOver = [];
    }
  }
  inn.overs = oversStr(inn.legalBalls);
  inn.recent = balls.slice(-12).map(ballLabel);
  inn.batting = [...bat.values()].map((x) => ({ ...x, sr: x.balls ? Math.round((x.runs / x.balls) * 1000) / 10 : 0 }));
  inn.bowling = [...bowl.values()].map(({ overRuns: _o, ...x }) => ({ ...x, overs: oversStr(x.balls), econ: x.balls ? Math.round((x.runs / (x.balls / 6)) * 100) / 100 : 0 }));
  return inn;
}

/** Who is on strike / bowling for the next delivery */
export function nextState(all: Ball[], innings: number) {
  const balls = all.filter((b) => b.innings === innings).sort((a, b) => a.seq - b.seq);
  if (!balls.length) return { striker: null, nonStriker: null, bowler: null, lastOverBowler: null, needsNewBatter: true, needsNewBowler: true, legalBalls: 0 };
  let striker: string | null = null;
  let nonStriker: string | null = null;
  let legal = 0;
  let lastOverBowler: string | null = null;
  let currentBowler: string | null = null;
  for (const b of balls) {
    striker = b.striker; nonStriker = b.nonStriker ?? null; currentBowler = b.bowler;
    if (ran(b) % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    if (b.wicket) {
      const out = b.dismissed ?? b.striker;
      if (striker === out) striker = null; else if (nonStriker === out) nonStriker = null;
    }
    if (isLegal(b)) {
      legal++;
      if (legal % 6 === 0) { [striker, nonStriker] = [nonStriker, striker]; lastOverBowler = b.bowler; currentBowler = null; }
    }
  }
  return { striker, nonStriker, bowler: currentBowler, lastOverBowler, needsNewBatter: !striker || !nonStriker, needsNewBowler: !currentBowler, legalBalls: legal };
}
