import { Avatar, Badge, Card, cx } from './ui';

const ballTone = (b: string) =>
  b === 'W' || b.includes('W') ? 'bg-red-600 text-white' : b === '4' ? 'bg-brand-600 text-white' : b === '6' ? 'bg-violet-600 text-white' : b.includes('wd') || b.includes('nb') ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-700';

export function BallChip({ b }: { b: string }) {
  return <span className={cx('inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-xs font-bold', ballTone(b))}>{b}</span>;
}

const teamName = (m: any, id: string | null) => (id === m.homeTeamId ? m.homeTeam : id === m.awayTeamId ? m.awayTeam : null);

/** Big scoreboard header used by scorers, league staff and fans */
export function ScoreHeader({ m }: { m: any }) {
  const [i1, i2] = m.innings;
  const row = (inn: any, fallbackTeam: any, active: boolean) => {
    const t = teamName(m, inn.battingTeamId) ?? fallbackTeam;
    const started = inn.legalBalls > 0 || inn.runs > 0;
    return (
      <div className={cx('flex items-center gap-3', !active && m.status === 'LIVE' && 'opacity-60')}>
        <Avatar name={t?.name ?? '?'} src={t?.logoUrl} size={40} />
        <p className="min-w-0 flex-1 truncate font-semibold">{t?.name ?? 'TBD'}</p>
        {started ? <p className="text-right"><span className="text-2xl font-extrabold tabular-nums">{inn.runs}/{inn.wickets}</span><span className="ml-2 text-sm text-ink-500">({inn.overs})</span></p> : <p className="text-sm text-ink-400">Yet to bat</p>}
      </div>
    );
  };
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink-500">Match {m.number}{m.stage !== 'League' && ` · ${m.stage}`}{m.venue && ` · ${m.venue.name}`}</span>
        {m.status === 'LIVE' ? <Badge color="red"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />LIVE</Badge> : <Badge color={m.status === 'COMPLETED' ? 'green' : 'gray'}>{m.status.toLowerCase()}</Badge>}
      </div>
      <div className="space-y-3">
        {row(i1, teamName(m, m.battingFirst) ?? m.homeTeam, m.currentInnings === 1)}
        {row(i2, teamName(m, m.battingSecond) ?? m.awayTeam, m.currentInnings === 2)}
      </div>
      <div className="mt-4 border-t border-ink-100 pt-3 text-sm">
        {m.resultText ? <p className="font-semibold text-emerald-700">{m.resultText}</p>
          : m.status === 'LIVE' && m.required ? <p className="font-semibold text-brand-700">Need {m.required.runs} from {m.required.balls} balls · RRR {m.required.rrr} · CRR {m.crr}</p>
          : m.status === 'LIVE' ? <p className="text-ink-500">CRR {m.crr}{m.tossWinnerId && ` · ${teamName(m, m.tossWinnerId)?.name} won the toss and chose to ${m.tossDecision === 'BAT' ? 'bat' : 'bowl'}`}</p>
          : <p className="text-ink-500">{m.startsAt ? new Date(m.startsAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Date TBA'}</p>}
      </div>
    </Card>
  );
}

export function InningsCard({ m, inn }: { m: any; inn: any }) {
  if (!inn.battingTeamId || (!inn.legalBalls && !inn.runs && !inn.batting.length)) return null;
  const t = teamName(m, inn.battingTeamId);
  return (
    <Card padded={false} title={<span>{t?.name} — {inn.runs}/{inn.wickets} <span className="font-normal text-ink-500">({inn.overs} ov)</span></span>}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50/70 text-xs uppercase text-ink-500"><tr><th className="px-4 py-2 text-left">Batter</th><th className="px-2 py-2 text-left font-normal normal-case"></th><th className="px-2 py-2 text-right">R</th><th className="px-2 py-2 text-right">B</th><th className="px-2 py-2 text-right">4s</th><th className="px-2 py-2 text-right">6s</th><th className="px-4 py-2 text-right">SR</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {inn.batting.map((b: any) => (
              <tr key={b.name}><td className="px-4 py-2 font-medium">{b.name}</td><td className="px-2 py-2 text-xs text-ink-500">{b.out ?? 'not out'}</td><td className="px-2 py-2 text-right font-bold">{b.runs}</td><td className="px-2 py-2 text-right">{b.balls}</td><td className="px-2 py-2 text-right">{b.fours}</td><td className="px-2 py-2 text-right">{b.sixes}</td><td className="px-4 py-2 text-right">{b.sr}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">Extras {inn.extras.total} (wd {inn.extras.WD}, nb {inn.extras.NB}, b {inn.extras.B}, lb {inn.extras.LB})
          {inn.fallOfWickets.length > 0 && <> · FoW: {inn.fallOfWickets.map((f: any) => `${f.runs}-${f.wicket} (${f.batter}, ${f.over})`).join(', ')}</>}</p>
        <table className="min-w-full border-t border-ink-100 text-sm">
          <thead className="bg-ink-50/70 text-xs uppercase text-ink-500"><tr><th className="px-4 py-2 text-left">Bowler</th><th className="px-2 py-2 text-right">O</th><th className="px-2 py-2 text-right">M</th><th className="px-2 py-2 text-right">R</th><th className="px-2 py-2 text-right">W</th><th className="px-4 py-2 text-right">Econ</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {inn.bowling.map((b: any) => <tr key={b.name}><td className="px-4 py-2 font-medium">{b.name}</td><td className="px-2 py-2 text-right">{b.overs}</td><td className="px-2 py-2 text-right">{b.maidens}</td><td className="px-2 py-2 text-right">{b.runs}</td><td className="px-2 py-2 text-right font-bold">{b.wickets}</td><td className="px-4 py-2 text-right">{b.econ}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function StandingsTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50/70 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3 text-left">#</th><th className="px-2 py-3 text-left">Team</th><th className="px-2 py-3 text-right">P</th><th className="px-2 py-3 text-right">W</th><th className="px-2 py-3 text-right">L</th><th className="px-2 py-3 text-right">T/NR</th><th className="px-2 py-3 text-right">NRR</th><th className="px-2 py-3 text-right">Pts</th><th className="px-4 py-3 text-left">Form</th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r, i) => (
            <tr key={r.teamId} className={cx(i < 4 && 'bg-brand-50/30')}>
              <td className="px-4 py-2.5 font-semibold text-ink-500">{i + 1}</td>
              <td className="px-2 py-2.5"><span className="flex items-center gap-2 font-medium"><Avatar name={r.name} src={r.logoUrl} size={26} />{r.name}</span></td>
              <td className="px-2 py-2.5 text-right">{r.played}</td><td className="px-2 py-2.5 text-right">{r.won}</td><td className="px-2 py-2.5 text-right">{r.lost}</td>
              <td className="px-2 py-2.5 text-right">{r.drawn + r.nr}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.nrr > 0 ? '+' : ''}{r.nrr.toFixed(3)}</td>
              <td className="px-2 py-2.5 text-right font-bold">{r.points}</td>
              <td className="px-4 py-2.5"><div className="flex gap-1">{r.form.map((f: string, k: number) => <span key={k} className={cx('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white', f === 'W' ? 'bg-emerald-500' : f === 'L' ? 'bg-red-500' : 'bg-ink-400')}>{f}</span>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-ink-500">Win 2 pts · Tie / No result 1 pt · Top 4 qualify for the playoffs</p>
    </div>
  );
}
