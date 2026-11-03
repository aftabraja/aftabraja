import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Gavel, ListOrdered, Pause, Play, RefreshCcw, Settings2, Shuffle, Square, UserPlus, Users } from 'lucide-react';
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

const myTeams0 = (teams: any[], uid?: string) => teams.filter((t) => uid && t.ownerIds.includes(uid));

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
  const { auction: a, teams, current, bids, nextBid, pool, log, counts, rtm, draft } = s.data;
  const isDraft = a.mode === 'DRAFT';
  const canRtm = rtm && (isStaff || myTeams0(teams, user?.id).some((t: any) => t.id === rtm.teamId));
  const canPick = draft?.onClock && (isStaff || myTeams0(teams, user?.id).some((t: any) => t.id === draft.onClock));
  const leader = teams.find((t: any) => t.id === a.currentTeamId);
  const myTeams = teams.filter((t: any) => t.ownerIds.includes(user?.id));
  const categories = [...new Set(pool.map((p: any) => p.category).filter(Boolean))] as string[];
  const teamName = (id: string) => teams.find((t: any) => t.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3">Player Auction <StatusBadge status={a.status === 'SETUP' ? 'DRAFT' : a.status === 'PAUSED' ? 'PENDING' : a.status === 'COMPLETED' ? 'COMPLETED' : 'LIVE'} /></span>}
        subtitle={isDraft ? `Draft · ${counts.pool} in pool · ${counts.sold} picked · ${a.draftSnake ? 'snake order' : 'fixed order'}` : `${counts.pool} in pool · ${counts.sold} sold · ${counts.unsold} unsold · Increment ${inr(a.bidIncrement)} · ${a.timerSeconds}s timer${a.maxOverseas != null ? ` · max ${a.maxOverseas} overseas` : ''}${a.rtmCards ? ` · ${a.rtmCards} RTM` : ''}`}
        actions={isStaff && <>
          <Button variant="secondary" onClick={() => setSettings(true)}><Settings2 className="h-4 w-4" />Rules</Button>
          {a.status !== 'LIVE' && a.status !== 'COMPLETED' && <Button onClick={() => act.mutate({ path: '/status', body: { status: 'LIVE' } })}><Play className="h-4 w-4" />{a.status === 'SETUP' ? (isDraft ? 'Start draft' : 'Start auction') : 'Resume'}</Button>}
          {a.status === 'LIVE' && <Button variant="secondary" onClick={() => act.mutate({ path: '/status', body: { status: 'PAUSED' } })}><Pause className="h-4 w-4" />Pause</Button>}
          {a.status !== 'COMPLETED' && a.status !== 'SETUP' && <Button variant="ghost" onClick={() => confirm('Complete the auction? Squads will be locked.') && act.mutate({ path: '/status', body: { status: 'COMPLETED' } })}><Square className="h-4 w-4" />Complete</Button>}
        </>} />
      <ErrorText error={act.error} />

      <div className="mt-4 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {isDraft && (
            <Card title={<span className="flex items-center gap-2"><ListOrdered className="h-4 w-4" />Draft board</span>}>
              {a.status !== 'LIVE' ? <p className="text-sm text-ink-500">{a.status === 'COMPLETED' ? 'The draft is complete.' : 'Start the draft when every team is ready. Teams pick in turn at each category\'s fixed salary.'}</p>
                : draft?.complete || !draft ? <p className="text-sm text-ink-500">Every squad is full — the draft is complete.</p> : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-4">
                    <span className="text-sm text-ink-600">Pick {draft.pick} · Round {draft.round}</span>
                    <span className="text-lg font-bold text-brand-800">On the clock: {draft.onClockName}</span>
                  </div>
                  <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">{pool.map((p: any) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1"><span className="block font-medium">{p.name}{p.isOverseas && <Badge color="violet" className="ml-1">overseas</Badge>}</span><span className="text-xs text-ink-500">{[p.role, p.category].filter(Boolean).join(' · ')}</span></span>
                      <span className="text-sm">{inr((a.draftPrices ?? {})[p.category] ?? p.basePrice)}</span>
                      {canPick && <Button size="sm" loading={act.isPending && act.variables?.body?.regId === p.id} onClick={() => act.mutate({ path: '/draft/pick', body: { regId: p.id } })}>Pick</Button>}
                    </li>
                  ))}</ul>
                </>
              )}
            </Card>
          )}
          {!isDraft && <div className="card overflow-hidden">
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
                      <Button variant="success" disabled={!a.currentBid || !!rtm} loading={act.isPending && act.variables?.path === '/sell'} onClick={() => act.mutate({ path: '/sell' })}><Gavel className="h-4 w-4" />SOLD</Button>
                      <Button variant="secondary" disabled={!!a.currentBid || !!rtm} onClick={() => act.mutate({ path: '/unsold' })}>Unsold</Button>
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
          </div>}

          {rtm && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5">
              <p className="flex items-center gap-2 font-semibold text-amber-900"><RefreshCcw className="h-4 w-4" />Right to match</p>
              <p className="mt-1 text-sm text-amber-900">{rtm.teamName} (last season's team) can match {teamName(rtm.againstTeamId)}'s winning bid of <b>{inr(rtm.price)}</b> using an RTM card.</p>
              {canRtm ? <div className="mt-3 flex gap-2"><Button onClick={() => act.mutate({ path: '/rtm', body: { use: true } })}>Use RTM — match {inrShort(rtm.price)}</Button><Button variant="secondary" onClick={() => act.mutate({ path: '/rtm', body: { use: false } })}>Decline</Button></div>
                : <p className="mt-2 text-xs text-amber-800">Waiting for {rtm.teamName} to decide…</p>}
            </div>
          )}

          {current && !rtm && a.status === 'LIVE' && (myTeams.length > 0 || isStaff) && (
            <Card title={isStaff ? 'Bid on behalf of a team (auctioneer desk)' : 'Place your bid'}>
              <div className="grid gap-2 sm:grid-cols-2">
                {(isStaff ? teams : myTeams).map((t: any) => {
                  const leading = a.currentTeamId === t.id;
                  const eligible = current.eligibleTeams?.includes(t.id) ?? true;
                  return (
                    <button key={t.id} disabled={leading || act.isPending || left === 0 || !eligible} onClick={() => act.mutate({ path: '/bid', body: { teamId: t.id } })}
                      className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed', leading ? 'border-emerald-500 bg-emerald-50' : 'border-ink-200 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50')}>
                      <Avatar name={t.name} src={t.logoUrl} size={36} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.name}</span><span className="text-xs text-ink-500">{inrShort(t.remaining)} left · {t.squad} player{t.squad === 1 ? '' : 's'}</span></span>
                      <span className="text-sm font-bold text-brand-700">{leading ? 'Leading' : eligible ? `Bid ${inrShort(nextBid)}` : <span className="text-xs font-medium text-ink-500">Squad rules</span>}</span>
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
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-500">
                    {a.maxOverseas != null && <span>Overseas {t.overseas}/{a.maxOverseas}</span>}
                    {t.retained > 0 && <span>{t.retained} retained</span>}
                    {a.rtmCards > 0 && <span>RTM left {t.rtmLeft}</span>}
                    {Object.entries(t.needs ?? {}).map(([r, n]) => <span key={r} className="text-amber-700">needs {n as number} {r}</span>)}
                  </p>
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

      {settings && <RulesModal leagueId={leagueId} a={a} teams={teams} categories={categories} onClose={(v) => { if (v) set(v); setSettings(false); }} />}
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

const ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'];

function RulesModal({ leagueId, a, teams, categories, onClose }: { leagueId: string; a: any; teams: any[]; categories: string[]; onClose: (v?: any) => void }) {
  const setup = a.status === 'SETUP';
  const [f, setF] = useState<any>({
    bidIncrement: a.bidIncrement, timerSeconds: a.timerSeconds, minSquad: a.minSquad, maxSquad: a.maxSquad, maxOverseas: a.maxOverseas ?? '',
    roleMins: { ...a.roleMins }, mode: a.mode, maxRetentions: a.maxRetentions, rtmCards: a.rtmCards, draftSnake: a.draftSnake,
    draftOrder: a.draftOrder?.length === teams.length ? a.draftOrder : teams.map((t) => t.id), draftPrices: { ...a.draftPrices },
  });
  const body = () => {
    const b: any = { ...f, maxOverseas: f.maxOverseas === '' ? null : Number(f.maxOverseas), roleMins: Object.fromEntries(Object.entries(f.roleMins).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])), draftPrices: Object.fromEntries(Object.entries(f.draftPrices).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)])) };
    if (!setup) { delete b.mode; delete b.maxRetentions; delete b.draftOrder; }
    return b;
  };
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/auction`, body()), onSuccess: (v) => onClose(v) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  const move = (i: number, d: number) => { const o = [...f.draftOrder]; [o[i], o[i + d]] = [o[i + d], o[i]]; setF({ ...f, draftOrder: o }); };
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  return (
    <Modal open size="lg" onClose={() => onClose()} title="Auction & squad rules" footer={<><Button variant="secondary" onClick={() => onClose()}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save rules</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><ErrorText error={save.error} /></div>
        <Field label="Player acquisition" hint={setup ? undefined : 'Locked once started'}>
          <select className="input" disabled={!setup} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="AUCTION">Live auction</option><option value="DRAFT">Draft (teams pick in turn)</option></select>
        </Field>
        <Field label="Maximum overseas per squad" hint="Leave blank for no limit"><Input type="number" min={0} value={f.maxOverseas} onChange={set('maxOverseas')} /></Field>
        <Field label="Minimum squad"><Input type="number" value={f.minSquad} onChange={set('minSquad')} /></Field>
        <Field label="Maximum squad"><Input type="number" value={f.maxSquad} onChange={set('maxSquad')} /></Field>
        <div className="sm:col-span-2">
          <p className="label">Minimum players per role</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ROLES.map((r) => <Field key={r} label={r}><Input type="number" min={0} value={f.roleMins[r] ?? ''} onChange={(e) => setF({ ...f, roleMins: { ...f.roleMins, [r]: e.target.value } })} /></Field>)}</div>
          <p className="mt-1 text-xs text-ink-500">A team can't fill its last slots with players that leave a required role short.</p>
        </div>
        <Field label="Retentions per team" hint={setup ? 'Before the auction starts' : 'Locked once started'}><Input type="number" min={0} disabled={!setup} value={f.maxRetentions} onChange={set('maxRetentions')} /></Field>
        <Field label="Right-to-match cards per team"><Input type="number" min={0} value={f.rtmCards} onChange={set('rtmCards')} /></Field>
        {f.mode === 'AUCTION' ? <>
          <Field label="Bid increment (₹)"><Input type="number" value={f.bidIncrement} onChange={set('bidIncrement')} /></Field>
          <Field label="Timer (seconds)" hint="Resets on every bid (min 10s)"><Input type="number" value={f.timerSeconds} onChange={set('timerSeconds')} /></Field>
        </> : <>
          <div className="sm:col-span-2">
            <p className="label">Draft order</p>
            <ol className="space-y-1">{f.draftOrder.map((id: string, i: number) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-sm"><span className="w-5 text-xs text-ink-500">{i + 1}.</span><span className="flex-1">{name(id)}</span>
                <button disabled={!setup || i === 0} onClick={() => move(i, -1)} className="p-1 text-ink-400 hover:text-ink-800 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button disabled={!setup || i === f.draftOrder.length - 1} onClick={() => move(i, 1)} className="p-1 text-ink-400 hover:text-ink-800 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button></li>
            ))}</ol>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.draftSnake} onChange={(e) => setF({ ...f, draftSnake: e.target.checked })} />Snake order (reverse every other round)</label>
          </div>
          <div className="sm:col-span-2">
            <p className="label">Fixed salary per category (₹)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(categories.length ? categories : ['Icon', 'A', 'B', 'C']).map((c) => <Field key={c} label={c}><Input type="number" value={f.draftPrices[c] ?? ''} onChange={(e) => setF({ ...f, draftPrices: { ...f.draftPrices, [c]: e.target.value } })} /></Field>)}</div>
            <p className="mt-1 text-xs text-ink-500">Players without a category salary are drafted at their base price.</p>
          </div>
        </>}
        <p className="text-xs text-ink-500 sm:col-span-2">Teams can't spend more than their remaining purse minus what they need to complete the minimum squad. Mark overseas players and last season's team on the Players page.</p>
      </div>
    </Modal>
  );
}
