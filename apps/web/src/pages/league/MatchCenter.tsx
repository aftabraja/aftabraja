import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Flag, RotateCcw, Trophy } from 'lucide-react';
import { del, get, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { useLive } from '../../lib/live';
import { Button, Card, ErrorText, Field, Modal, PageHeader, Select, Spinner, Textarea, cx } from '../../components/ui';
import { BallChip, InningsCard, ScoreHeader } from '../../components/Scorecard';

export default function MatchCenter() {
  const { leagueId, isStaff } = useLeague();
  const { mid } = useParams();
  const qc = useQueryClient();
  const key = ['match', mid];
  const m = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/matches/${mid}`) });
  useLive(`/leagues/${leagueId}/matches/${mid}/stream`, () => qc.invalidateQueries({ queryKey: key }));
  if (m.isLoading) return <Spinner />;
  const d = m.data;
  const canScore = isStaff && d.homeTeamId && d.awayTeamId;

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/fixtures`} className="hover:underline">Fixtures & Results</Link>}
        title={`${d.homeTeam?.name ?? d.homeLabel ?? 'TBD'} vs ${d.awayTeam?.name ?? d.awayLabel ?? 'TBD'}`} subtitle={`Match ${d.number} · ${d.stage}${d.venue ? ` · ${d.venue.name}` : ''}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6 xl:order-2">
          <ScoreHeader m={d} />
          {d.status === 'LIVE' && <Card title="Recent balls"><div className="flex flex-wrap gap-1.5">{d.innings[d.currentInnings - 1].recent.map((b: string, i: number) => <BallChip key={i} b={b} />)}{!d.innings[d.currentInnings - 1].recent.length && <span className="text-sm text-ink-500">No balls yet</span>}</div></Card>}
        </div>
        <div className="space-y-6 xl:order-1">
          {canScore && d.status === 'SCHEDULED' && <StartMatch d={d} leagueId={leagueId} onDone={(v) => qc.setQueryData(key, (old: any) => ({ ...old, ...v }))} />}
          {canScore && d.status === 'LIVE' && <Scorer d={d} leagueId={leagueId} onState={(v) => qc.setQueryData(key, (old: any) => ({ ...old, ...v }))} />}
          {!isStaff && d.status === 'SCHEDULED' && <Card><p className="text-sm text-ink-500">This match hasn't started yet.</p></Card>}
          {isStaff && d.status === 'SCHEDULED' && (!d.homeTeamId || !d.awayTeamId) && <Card><p className="text-sm text-ink-500">Teams for this playoff aren't decided yet. Seed playoffs from the points table on the Fixtures page.</p></Card>}
          {d.innings.slice().reverse().map((inn: any) => <InningsCard key={inn.innings} m={d} inn={inn} />)}
        </div>
      </div>
    </>
  );
}

function XIPicker({ label, squad, value, onChange }: { label: string; squad: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [extra, setExtra] = useState('');
  const all = [...new Set([...squad, ...value])];
  return (
    <div>
      <p className="label">{label} · {value.length} selected</p>
      <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
        {!all.length && <p className="p-2 text-xs text-ink-500">No squad yet — add names below (one per line).</p>}
        {all.map((n) => <label key={n} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-ink-50"><input type="checkbox" checked={value.includes(n)} onChange={(e) => onChange(e.target.checked ? [...value, n] : value.filter((x) => x !== n))} />{n}</label>)}
      </div>
      <Textarea rows={2} className="mt-2" placeholder="Add players, one per line" value={extra} onChange={(e) => setExtra(e.target.value)} onBlur={() => { const names = extra.split('\n').map((s) => s.trim()).filter(Boolean); if (names.length) { onChange([...new Set([...value, ...names])]); setExtra(''); } }} />
    </div>
  );
}

function StartMatch({ d, leagueId, onDone }: { d: any; leagueId: string; onDone: (v: any) => void }) {
  const [f, setF] = useState({ tossWinnerId: d.homeTeamId, tossDecision: 'BAT', oversPerSide: d.oversPerSide ?? 20, homeXI: (d.homeXI.length ? d.homeXI : d.squads.home.slice(0, 11)) as string[], awayXI: (d.awayXI.length ? d.awayXI : d.squads.away.slice(0, 11)) as string[] });
  const start = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/matches/${d.id}/start`, f), onSuccess: onDone });
  return (
    <Card title="Toss & playing XI">
      <div className="space-y-4">
        <ErrorText error={start.error} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Toss won by"><Select value={f.tossWinnerId} onChange={(e) => setF({ ...f, tossWinnerId: e.target.value })} options={[{ value: d.homeTeamId, label: d.homeTeam.name }, { value: d.awayTeamId, label: d.awayTeam.name }]} /></Field>
          <Field label="Elected to"><Select value={f.tossDecision} onChange={(e) => setF({ ...f, tossDecision: e.target.value })} options={[{ value: 'BAT', label: 'Bat first' }, { value: 'BOWL', label: 'Bowl first' }]} /></Field>
          <Field label="Overs per side"><input className="input" type="number" min={1} max={50} value={f.oversPerSide} onChange={(e) => setF({ ...f, oversPerSide: Number(e.target.value) })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <XIPicker label={d.homeTeam.name} squad={d.squads.home} value={f.homeXI} onChange={(v) => setF({ ...f, homeXI: v })} />
          <XIPicker label={d.awayTeam.name} squad={d.squads.away} value={f.awayXI} onChange={(v) => setF({ ...f, awayXI: v })} />
        </div>
        <Button size="lg" className="w-full" loading={start.isPending} disabled={f.homeXI.length < 2 || f.awayXI.length < 2} onClick={() => start.mutate()}>Start match</Button>
      </div>
    </Card>
  );
}

const WICKETS = [['BOWLED', 'Bowled'], ['CAUGHT', 'Caught'], ['LBW', 'LBW'], ['RUN_OUT', 'Run out'], ['STUMPED', 'Stumped'], ['HIT_WICKET', 'Hit wicket'], ['RETIRED', 'Retired']];

function Scorer({ d, leagueId, onState }: { d: any; leagueId: string; onState: (v: any) => void }) {
  const battingId = d.currentInnings === 1 ? d.battingFirst : d.battingSecond;
  const batXI: string[] = battingId === d.homeTeamId ? d.homeXI : d.awayXI;
  const bowlXI: string[] = battingId === d.homeTeamId ? d.awayXI : d.homeXI;
  const inn = d.innings[d.currentInnings - 1];
  const outNames = new Set(inn.batting.filter((b: any) => b.out).map((b: any) => b.name));
  const [striker, setStriker] = useState('');
  const [nonStriker, setNonStriker] = useState('');
  const [bowler, setBowler] = useState('');
  const [extra, setExtra] = useState<'' | 'WD' | 'NB' | 'B' | 'LB'>('');
  const [wicket, setWicket] = useState<any>(null);
  const [finish, setFinish] = useState(false);

  // Sync with server's next-ball state after every delivery
  useEffect(() => {
    setStriker(d.next?.striker ?? '');
    setNonStriker(d.next?.nonStriker ?? '');
    // Keep the scorer's chosen bowler (e.g. after undoing the first ball of an over) unless they just bowled the previous over
    setBowler((prev) => d.next?.bowler ?? (prev && prev !== d.next?.lastOverBowler ? prev : ''));
  }, [d.ballCount, d.currentInnings, d.next?.striker, d.next?.nonStriker, d.next?.bowler]);

  const ball = useMutation({ mutationFn: (b: any) => post(`/leagues/${leagueId}/matches/${d.id}/balls`, { striker, nonStriker, bowler, ...b }), onSuccess: (v) => { onState(v); setExtra(''); setWicket(null); } });
  const undo = useMutation({ mutationFn: () => del(`/leagues/${leagueId}/matches/${d.id}/balls/last`), onSuccess: onState });
  const nextInn = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/matches/${d.id}/innings/next`), onSuccess: onState });
  const complete = useMutation({ mutationFn: (b: any) => post(`/leagues/${leagueId}/matches/${d.id}/complete`, b), onSuccess: (v) => { onState(v); setFinish(false); } });

  const ready = striker && nonStriker && bowler && striker !== nonStriker;
  const avail = (exclude: string[]) => batXI.filter((n) => !outNames.has(n) && !exclude.includes(n));
  const score = (runs: number) => {
    if (!extra) return ball.mutate({ runs });
    if (extra === 'WD') return ball.mutate({ extraType: 'WD', extraRuns: 1 + runs, runs: 0 });
    if (extra === 'NB') return ball.mutate({ extraType: 'NB', extraRuns: 1, runs });
    return ball.mutate({ extraType: extra, extraRuns: runs, runs: 0 });
  };
  const err = ball.error || undo.error || nextInn.error || complete.error;

  return (
    <Card title={<span>Scoring · Innings {d.currentInnings}</span>} action={<Button size="sm" variant="ghost" loading={undo.isPending} onClick={() => undo.mutate()}><RotateCcw className="h-3.5 w-3.5" />Undo</Button>}>
      <div className="space-y-4">
        <ErrorText error={err} />
        {d.inningsOver ? (
          <div className="rounded-xl bg-brand-50 p-4 text-center">
            <p className="font-semibold text-brand-800">{d.currentInnings === 1 ? `Innings complete — ${inn.runs}/${inn.wickets}. Target: ${inn.runs + 1}` : 'Match complete'}</p>
            <div className="mt-3 flex justify-center gap-2">
              {d.currentInnings === 1 ? <Button loading={nextInn.isPending} onClick={() => nextInn.mutate()}>Start 2nd innings</Button> : <Button variant="success" loading={complete.isPending} onClick={() => complete.mutate({})}><Trophy className="h-4 w-4" />Confirm result</Button>}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="Striker *"><select className="input" value={striker} onChange={(e) => setStriker(e.target.value)}><option value="">Select</option>{avail([nonStriker]).map((n) => <option key={n}>{n}</option>)}</select></Field>
              <button onClick={() => { setStriker(nonStriker); setNonStriker(striker); }} className="mb-1 rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Swap strike" aria-label="Swap strike"><ArrowLeftRight className="h-4 w-4" /></button>
              <Field label="Non-striker"><select className="input" value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}><option value="">Select</option>{avail([striker]).map((n) => <option key={n}>{n}</option>)}</select></Field>
            </div>
            <Field label={`Bowler${d.next?.lastOverBowler ? ` (not ${d.next.lastOverBowler})` : ''}`}>
              <select className="input" value={bowler} onChange={(e) => setBowler(e.target.value)}><option value="">Select</option>{bowlXI.filter((n) => n !== d.next?.lastOverBowler || bowler === n).map((n) => <option key={n}>{n}</option>)}</select>
            </Field>
            <div>
              <p className="label">Extras</p>
              <div className="grid grid-cols-4 gap-2">{(['WD', 'NB', 'B', 'LB'] as const).map((x) => <button key={x} onClick={() => setExtra(extra === x ? '' : x)} className={cx('h-10 rounded-lg border text-sm font-bold', extra === x ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-ink-200 hover:bg-ink-50')}>{x === 'WD' ? 'Wide' : x === 'NB' ? 'No ball' : x === 'B' ? 'Bye' : 'Leg bye'}</button>)}</div>
            </div>
            <div>
              <p className="label">{extra ? `${extra === 'WD' ? 'Extra runs on the wide' : extra === 'NB' ? 'Runs off the bat on the no-ball' : `${extra === 'B' ? 'Byes' : 'Leg byes'}`}` : 'Runs'}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                  <button key={r} disabled={!ready || ball.isPending} onClick={() => score(r)}
                    className={cx('h-14 rounded-xl text-xl font-extrabold transition disabled:opacity-40', r === 4 ? 'bg-brand-600 text-white hover:bg-brand-700' : r === 6 ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-ink-100 text-ink-900 hover:bg-ink-200')}>{r}</button>
                ))}
              </div>
            </div>
            <Button variant="danger" size="lg" className="w-full" disabled={!ready} onClick={() => setWicket({ wicket: 'BOWLED', dismissed: striker, fielder: '', runs: 0 })}>Wicket</Button>
            {!ready && <p className="text-center text-xs text-ink-500">{d.next?.needsNewBatter && inn.legalBalls ? 'Select the new batter. ' : ''}{d.next?.needsNewBowler && inn.legalBalls ? 'Select the bowler for the new over.' : !inn.legalBalls ? 'Select openers and the opening bowler.' : ''}</p>}
          </>
        )}
        <button onClick={() => setFinish(true)} className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"><Flag className="h-3 w-3" />End match early (rain / no result)</button>
      </div>

      <Modal open={!!wicket} onClose={() => setWicket(null)} title="Wicket" footer={<><Button variant="secondary" onClick={() => setWicket(null)}>Cancel</Button><Button variant="danger" loading={ball.isPending} onClick={() => ball.mutate({ runs: wicket.wicket === 'RUN_OUT' ? Number(wicket.runs) : 0, wicket: wicket.wicket, dismissed: wicket.dismissed, fielder: wicket.fielder || null, ...(extra && extra !== 'WD' ? { extraType: extra, extraRuns: extra === 'NB' ? 1 : 0 } : extra === 'WD' ? { extraType: 'WD', extraRuns: 1 } : {}) })}>Confirm wicket</Button></>}>
        {wicket && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="How out"><Select value={wicket.wicket} onChange={(e) => setWicket({ ...wicket, wicket: e.target.value })} options={WICKETS.map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Batter out"><Select value={wicket.dismissed} onChange={(e) => setWicket({ ...wicket, dismissed: e.target.value })} options={[striker, nonStriker].filter(Boolean)} /></Field>
            {['CAUGHT', 'RUN_OUT', 'STUMPED'].includes(wicket.wicket) && <Field label="Fielder"><Select value={wicket.fielder} onChange={(e) => setWicket({ ...wicket, fielder: e.target.value })} placeholder="—" options={bowlXI} /></Field>}
            {wicket.wicket === 'RUN_OUT' && <Field label="Runs completed"><Select value={String(wicket.runs)} onChange={(e) => setWicket({ ...wicket, runs: e.target.value })} options={['0', '1', '2', '3']} /></Field>}
          </div>
        )}
      </Modal>
      <Modal open={finish} onClose={() => setFinish(false)} title="End match" footer={<><Button variant="secondary" onClick={() => setFinish(false)}>Cancel</Button><Button variant="secondary" loading={complete.isPending} onClick={() => complete.mutate({})}>Decide on scores</Button><Button variant="danger" loading={complete.isPending} onClick={() => complete.mutate({ abandoned: true, resultText: 'No result' })}>No result</Button></>}>
        <p className="text-sm text-ink-700">"No result" awards 1 point to each team. "Decide on scores" finishes the match using the current totals. For DLS results, finish on scores and then edit the result text.</p>
      </Modal>
    </Card>
  );
}
