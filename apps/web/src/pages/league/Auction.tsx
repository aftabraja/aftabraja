import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, Pause, Play, Settings2, Shuffle, Square, UserPlus, Users } from 'lucide-react';
import { get, patch, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLeague } from '../../lib/hooks';
import { useLive } from '../../lib/live';
import { inr, inrShort } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Spinner, StatusBadge, cx } from '../../components/ui';

function useCountdown(endsAt: string | null | undefined, serverTime: string | undefined) {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => { if (serverTime) setOffset(new Date(serverTime).getTime() - Date.now()); }, [serverTime]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - (now + offset)) / 1000));
}

export default function AuctionRoom() {
  const { leagueId, isStaff } = useLeague();
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['auction', leagueId];
  const s = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/auction`) });
  useLive(`/leagues/${leagueId}/auction/stream`, () => qc.invalidateQueries({ queryKey: key }));
  const set = (v: any) => qc.setQueryData(key, v);
  const act = useMutation({ mutationFn: ({ path, body }: { path: string; body?: any }) => post(`/leagues/${leagueId}/auction${path}`, body ?? {}), onSuccess: set });
  const [settings, setSettings] = useState(false);
  const [pick, setPick] = useState(false);
  const [category, setCategory] = useState('');
  const left = useCountdown(s.data?.auction.endsAt, s.data?.serverTime);

  if (s.isLoading) return <Spinner />;
  const { auction: a, teams, current, bids, nextBid, pool, log, counts } = s.data;
  const leader = teams.find((t: any) => t.id === a.currentTeamId);
  const myTeams = teams.filter((t: any) => t.ownerIds.includes(user?.id));
  const categories = [...new Set(pool.map((p: any) => p.category).filter(Boolean))] as string[];
  const teamName = (id: string) => teams.find((t: any) => t.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3">Player Auction <StatusBadge status={a.status === 'SETUP' ? 'DRAFT' : a.status === 'PAUSED' ? 'PENDING' : a.status === 'COMPLETED' ? 'COMPLETED' : 'LIVE'} /></span>}
        subtitle={`${counts.pool} in pool · ${counts.sold} sold · ${counts.unsold} unsold · Increment ${inr(a.bidIncrement)} · ${a.timerSeconds}s timer`}
        actions={isStaff && <>
          <Button variant="secondary" onClick={() => setSettings(true)}><Settings2 className="h-4 w-4" />Rules</Button>
          {a.status !== 'LIVE' && a.status !== 'COMPLETED' && <Button onClick={() => act.mutate({ path: '/status', body: { status: 'LIVE' } })}><Play className="h-4 w-4" />{a.status === 'SETUP' ? 'Start auction' : 'Resume'}</Button>}
          {a.status === 'LIVE' && <Button variant="secondary" onClick={() => act.mutate({ path: '/status', body: { status: 'PAUSED' } })}><Pause className="h-4 w-4" />Pause</Button>}
          {a.status !== 'COMPLETED' && a.status !== 'SETUP' && <Button variant="ghost" onClick={() => confirm('Complete the auction? Squads will be locked.') && act.mutate({ path: '/status', body: { status: 'COMPLETED' } })}><Square className="h-4 w-4" />Complete</Button>}
        </>} />
      <ErrorText error={act.error} />

      <div className="mt-4 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            {current ? (
              <div className="grid md:grid-cols-[1.2fr_1fr]">
                <div className="bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
                  <div className="flex items-center gap-2"><Badge color="amber">{current.category ?? 'Uncategorised'}</Badge>{current.isOverseas && <Badge color="violet">Overseas</Badge>}</div>
                  <h2 className="mt-4 text-3xl font-extrabold">{current.name}</h2>
                  <p className="text-white/75">{[current.role, current.city].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-sm text-white/60">{[current.battingStyle, current.bowlingStyle].filter(Boolean).join(' · ')}</p>
                  <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[['Matches', current.matches], ['Runs', current.runs], ['Wickets', current.wickets]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-white/60">{l}</p></div>)}
                  </div>
                  <p className="mt-4 text-sm text-white/70">Base price <span className="font-bold text-white">{inr(current.basePrice)}</span></p>
                </div>
                <div className="flex flex-col p-6">
                  <p className="label">Current bid</p>
                  <p className="text-4xl font-extrabold tabular-nums text-brand-700">{a.currentBid ? inr(a.currentBid) : '—'}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold">{leader ? <><Avatar name={leader.name} src={leader.logoUrl} size={24} />{leader.name}</> : <span className="text-ink-500">No bids yet</span>}</div>
                  <div className={cx('mt-5 flex h-20 w-20 items-center justify-center self-center rounded-full border-4 text-2xl font-extrabold tabular-nums', left === null ? 'border-ink-200 text-ink-400' : left <= 5 ? 'animate-pulse border-red-500 text-red-600' : 'border-brand-600 text-brand-700')}>{left ?? '—'}</div>
                  <p className="mt-1 text-center text-xs text-ink-500">seconds</p>
                  {isStaff && a.status === 'LIVE' && (
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <Button variant="success" disabled={!a.currentBid} loading={act.isPending && act.variables?.path === '/sell'} onClick={() => act.mutate({ path: '/sell' })}><Gavel className="h-4 w-4" />SOLD</Button>
                      <Button variant="secondary" disabled={!!a.currentBid} onClick={() => act.mutate({ path: '/unsold' })}>Unsold</Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-10 text-center">
                <Gavel className="mx-auto h-10 w-10 text-ink-300" />
                <p className="mt-3 font-semibold">{a.status === 'COMPLETED' ? 'The auction is complete' : a.status === 'LIVE' ? 'Bring the next player to the podium' : 'The auction has not started'}</p>
                {isStaff && a.status === 'LIVE' && (
                  <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2">
                    <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Any category</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
                    <Button onClick={() => act.mutate({ path: '/next', body: { category: category || undefined } })}><Shuffle className="h-4 w-4" />Next random</Button>
                    <Button variant="secondary" onClick={() => setPick(true)}><UserPlus className="h-4 w-4" />Pick player</Button>
                  </div>
                )}
                {isStaff && counts.unsold > 0 && a.status === 'LIVE' && <button className="mt-3 text-xs font-semibold text-brand-700 hover:underline" onClick={() => act.mutate({ path: '/reopen-unsold' })}>Re-open {counts.unsold} unsold players for another round</button>}
              </div>
            )}
          </div>

          {current && a.status === 'LIVE' && (myTeams.length > 0 || isStaff) && (
            <Card title={isStaff ? 'Bid on behalf of a team (auctioneer desk)' : 'Place your bid'}>
              <div className="grid gap-2 sm:grid-cols-2">
                {(isStaff ? teams : myTeams).map((t: any) => {
                  const leading = a.currentTeamId === t.id;
                  return (
                    <button key={t.id} disabled={leading || act.isPending || left === 0 || t.squad >= a.maxSquad} onClick={() => act.mutate({ path: '/bid', body: { teamId: t.id } })}
                      className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed', leading ? 'border-emerald-500 bg-emerald-50' : 'border-ink-200 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50')}>
                      <Avatar name={t.name} src={t.logoUrl} size={36} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.name}</span><span className="text-xs text-ink-500">{inrShort(t.remaining)} left · {t.squad} player{t.squad === 1 ? '' : 's'}</span></span>
                      <span className="text-sm font-bold text-brand-700">{leading ? 'Leading' : `Bid ${inrShort(nextBid)}`}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {current && bids.length > 0 && (
            <Card title="Bid history" padded={false}>
              <ul className="divide-y divide-ink-100">{bids.map((b: any, i: number) => <li key={b.id} className={cx('flex justify-between px-5 py-2.5 text-sm', i === 0 && 'bg-emerald-50/60 font-semibold')}><span>{teamName(b.teamId)}</span><span className="tabular-nums">{inr(b.amount)}</span></li>)}</ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Team purses" padded={false}>
            <ul className="divide-y divide-ink-100">
              {teams.map((t: any) => (
                <li key={t.id} className={cx('px-5 py-3', a.currentTeamId === t.id && 'bg-emerald-50/60')}>
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} src={t.logoUrl} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                    <span className="text-sm font-bold tabular-nums">{inrShort(t.remaining)}</span>
                  </div>
                  <Progress className="mt-2 h-1.5" value={t.purse ? (t.spent / t.purse) * 100 : 0} tone={t.remaining < a.bidIncrement * 3 ? 'red' : 'brand'} />
                  <p className="mt-1 text-xs text-ink-500">{t.squad}/{a.maxSquad} players (min {a.minSquad}) · spent {inrShort(t.spent)} of {inrShort(t.purse)}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Auction log" padded={false}>
            {!log.length ? <Empty icon={<Users className="h-5 w-5" />} title="No players auctioned yet" /> : (
              <ul className="divide-y divide-ink-100">{log.map((l: any) => <li key={l.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm"><span className="truncate font-medium">{l.name}</span>{l.status === 'SOLD' ? <span className="shrink-0 text-xs"><span className="font-semibold text-emerald-700">{l.team}</span> · {inrShort(l.price)}</span> : <Badge color="amber">Unsold</Badge>}</li>)}</ul>
            )}
          </Card>
        </div>
      </div>

      {settings && <RulesModal leagueId={leagueId} a={a} onClose={(v) => { if (v) set(v); setSettings(false); }} />}
      <Modal open={pick} onClose={() => setPick(false)} size="lg" title="Pick the next player">
        {!pool.length ? <Empty title="The pool is empty" text="Shortlist players on the Players or Trials page." /> : (
          <ul className="divide-y divide-ink-100">{pool.map((p: any) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1"><span className="block font-medium">{p.name}</span><span className="text-xs text-ink-500">{[p.role, p.category, p.status.toLowerCase()].filter(Boolean).join(' · ')}</span></span>
              <span className="text-sm">{inr(p.basePrice)}</span>
              <Button size="sm" onClick={() => { act.mutate({ path: '/next', body: { regId: p.id } }); setPick(false); }}>Bring up</Button>
            </li>
          ))}</ul>
        )}
      </Modal>
    </>
  );
}

function RulesModal({ leagueId, a, onClose }: { leagueId: string; a: any; onClose: (v?: any) => void }) {
  const [f, setF] = useState({ bidIncrement: a.bidIncrement, timerSeconds: a.timerSeconds, minSquad: a.minSquad, maxSquad: a.maxSquad });
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/auction`, f), onSuccess: (v) => onClose(v) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <Modal open onClose={() => onClose()} title="Auction rules" footer={<><Button variant="secondary" onClick={() => onClose()}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save rules</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><ErrorText error={save.error} /></div>
        <Field label="Bid increment (₹)"><Input type="number" value={f.bidIncrement} onChange={set('bidIncrement')} /></Field>
        <Field label="Timer (seconds)" hint="Resets on every bid (min 10s)"><Input type="number" value={f.timerSeconds} onChange={set('timerSeconds')} /></Field>
        <Field label="Minimum squad"><Input type="number" value={f.minSquad} onChange={set('minSquad')} /></Field>
        <Field label="Maximum squad"><Input type="number" value={f.maxSquad} onChange={set('maxSquad')} /></Field>
        <p className="col-span-2 text-xs text-ink-500">Teams can't bid more than their remaining purse minus what they need to complete the minimum squad. Team purses are set per team on the Teams page. Base prices and categories are set on the Players page.</p>
      </div>
    </Modal>
  );
}

