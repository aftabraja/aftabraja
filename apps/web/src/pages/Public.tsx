import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, Printer, Radio, Ticket } from 'lucide-react';
import { get, post } from '../lib/api';
import { checkout } from '../lib/pay';
import { useLive } from '../lib/live';
import { inr } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Spinner, Tabs, cx } from '../components/ui';
import { BallChip, InningsCard, ScoreHeader, StandingsTable } from '../components/Scorecard';
import { Logo } from '../components/Logo';

function PublicShell({ league, children }: { league?: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50/50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {league ? <Link to={`/l/${league.slug}`} className="flex items-center gap-3"><Avatar name={league.name} src={league.logoUrl} size={36} /><span className="font-bold">{league.name}</span></Link> : <span />}
          <Link to="/" className="opacity-80 hover:opacity-100"><Logo size={22} /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="py-8 text-center text-xs text-ink-400">Powered by SportsIQ — the league operating system</footer>
    </div>
  );
}

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBA');

export function PublicLeague() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['public', slug], queryFn: () => get(`/public/leagues/${slug}`), refetchInterval: 30_000 });
  const [tab, setTab] = useState<'matches' | 'table' | 'tickets'>(window.location.hash === '#tickets' ? 'tickets' : 'matches');
  const [buy, setBuy] = useState<any>(null);
  if (q.isLoading) return <Spinner className="h-screen" />;
  if (q.error) return <PublicShell><Empty title="League not found" /></PublicShell>;
  const { league, matches, standings, tickets } = q.data;
  const live = matches.filter((m: any) => m.status === 'LIVE');
  return (
    <PublicShell league={league}>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={league.name} src={league.logoUrl} size={88} className="bg-white" />
          <div>
            <h1 className="text-3xl font-extrabold">{league.name}</h1>
            <p className="mt-1 text-white/75">{[league.format, league.category, league.city].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-white/75"><CalendarDays className="h-4 w-4" />{league.startDate ? new Date(league.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : 'TBA'} – {league.endDate ? new Date(league.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA'}</p>
          </div>
          {tickets.length > 0 && <Button className="sm:ml-auto" variant="secondary" onClick={() => setTab('tickets')}><Ticket className="h-4 w-4" />Buy tickets</Button>}
        </div>
      </div>
      {live.map((m: any) => (
        <Link key={m.id} to={`/l/${slug}/match/${m.id}`} className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-card hover:bg-red-50">
          <Radio className="h-5 w-5 animate-pulse text-red-600" /><span className="font-semibold">LIVE: {m.homeTeam?.name} vs {m.awayTeam?.name}</span><span className="ml-auto text-sm font-semibold text-red-700">Watch live score →</span>
        </Link>
      ))}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'matches', label: 'Fixtures & results' }, { value: 'table', label: 'Points table' }, { value: 'tickets', label: 'Tickets' }]} />
      {tab === 'matches' && (!matches.length ? <Card><Empty title="Schedule coming soon" /></Card> : (
        <div className="card divide-y divide-ink-100">
          {matches.map((m: any) => (
            <Link key={m.id} to={`/l/${slug}/match/${m.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-ink-50">
              <div className="w-36 text-sm"><p className="font-semibold">{when(m.startsAt)}</p><p className="text-xs text-ink-500">Match {m.number}{m.stage !== 'League' && ` · ${m.stage}`}</p></div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className={cx(m.winnerTeamId && m.winnerTeamId === m.homeTeamId && 'text-emerald-700')}>{m.homeTeam?.name ?? m.homeLabel}</span><span className="text-xs text-ink-400">vs</span><span className={cx(m.winnerTeamId && m.winnerTeamId === m.awayTeamId && 'text-emerald-700')}>{m.awayTeam?.name ?? m.awayLabel}</span>
                </p>
                <p className="text-xs text-ink-500">{m.resultText ?? (m.venue ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.venue.name}</span> : '')}</p>
              </div>
              {m.status === 'LIVE' ? <Badge color="red">LIVE</Badge> : m.status === 'COMPLETED' ? <Badge color="green">Result</Badge> : null}
            </Link>
          ))}
        </div>
      ))}
      {tab === 'table' && <Card padded={false}><StandingsTable rows={standings} /></Card>}
      {tab === 'tickets' && (!tickets.length ? <Card><Empty icon={<Ticket className="h-5 w-5" />} title="Tickets are not on sale yet" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((t: any) => (
            <div key={t.id} className="card flex flex-col p-5">
              <p className="text-lg font-bold">{t.name}</p>
              <p className="text-sm text-ink-500">{t.match ? `Match ${t.match.number}: ${t.match.homeTeam?.name ?? 'TBD'} vs ${t.match.awayTeam?.name ?? 'TBD'} · ${when(t.match.startsAt)}` : 'Valid for the season'}</p>
              <p className="mt-3 text-3xl font-extrabold text-brand-700">{t.price ? inr(t.price) : 'Free'}</p>
              <p className="text-xs text-ink-500">{t.available > 0 ? `${t.available} left` : 'Sold out'}</p>
              <Button className="mt-4" disabled={t.available <= 0} onClick={() => setBuy(t)}>{t.available > 0 ? 'Buy tickets' : 'Sold out'}</Button>
            </div>
          ))}
        </div>
      ))}
      {buy && <BuyModal cat={buy} onClose={() => setBuy(null)} />}
    </PublicShell>
  );
}

function BuyModal({ cat, onClose }: { cat: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ qty: 1, buyerName: '', email: '', phone: '' });
  const [done, setDone] = useState<string | null>(null);
  const order = useMutation({
    mutationFn: async () => {
      const r = await post('/public/tickets/order', { categoryId: cat.id, ...f, phone: f.phone || undefined });
      if (r.free) return r.ticketCode;
      const v = await checkout(r);
      return v.ticketCode;
    },
    onSuccess: (code) => { setDone(code); qc.invalidateQueries({ queryKey: ['public'] }); },
  });
  return (
    <Modal open onClose={onClose} title={`${cat.name} tickets`} footer={done ? <Button onClick={() => window.open(`/ticket/${done}`, '_blank')}>View my ticket</Button> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={order.isPending} disabled={!f.buyerName || !f.email} onClick={() => order.mutate()}>{cat.price ? `Pay ${inr(cat.price * f.qty)}` : 'Get tickets'}</Button></>}>
      {done ? <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">Your tickets are confirmed! Code <b>{done}</b>. Show the QR code at the gate.</p> : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={order.error} /></div>
          <Field label="Full name" className="col-span-2"><Input value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Quantity"><select className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })}>{Array.from({ length: Math.min(10, cat.available) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></Field>
          <div className="flex items-end justify-end"><p className="text-lg font-bold">{inr(cat.price * f.qty)}</p></div>
        </div>
      )}
    </Modal>
  );
}

export function PublicMatch() {
  const { slug, mid } = useParams();
  const qc = useQueryClient();
  const m = useQuery({ queryKey: ['public-match', mid], queryFn: () => get(`/public/matches/${mid}`) });
  useLive(`/public/matches/${mid}/stream`, () => qc.invalidateQueries({ queryKey: ['public-match', mid] }));
  if (m.isLoading) return <Spinner className="h-screen" />;
  if (m.error) return <PublicShell><Empty title="Match not found" /></PublicShell>;
  const d = m.data;
  return (
    <PublicShell league={{ ...d.league, slug }}>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6 lg:order-2">
          <ScoreHeader m={d} />
          {d.status === 'LIVE' && <Card title="Recent balls"><div className="flex flex-wrap gap-1.5">{d.innings[d.currentInnings - 1].recent.map((b: string, i: number) => <BallChip key={i} b={b} />)}</div></Card>}
        </div>
        <div className="space-y-6 lg:order-1">
          {d.innings.slice().reverse().map((inn: any) => <InningsCard key={inn.innings} m={d} inn={inn} />)}
          {d.status === 'SCHEDULED' && <Card><p className="text-sm text-ink-500">The match starts {when(d.startsAt)}. Live scores will appear here ball by ball.</p></Card>}
        </div>
      </div>
    </PublicShell>
  );
}

export function TicketView() {
  const { code } = useParams();
  const t = useQuery({ queryKey: ['ticket', code], queryFn: () => get(`/public/tickets/${code}`) });
  if (t.isLoading) return <Spinner className="h-screen" />;
  if (t.error) return <PublicShell><Empty title="Ticket not found" /></PublicShell>;
  const d = t.data;
  const m = d.category.match;
  return (
    <PublicShell league={d.category.league}>
      <div className="mx-auto max-w-md">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-brand-700 to-brand-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">E-ticket</p>
            <p className="mt-1 text-xl font-bold">{d.category.league.name}</p>
            <p className="text-sm text-white/75">{m ? `Match ${m.number}: ${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}` : 'Season ticket'}</p>
            {m && <p className="text-sm text-white/75">{when(m.startsAt)}{m.venue && ` · ${m.venue.name}`}</p>}
          </div>
          <div className="p-6 text-center">
            {d.status === 'PAID' ? <img src={`/api/qr?data=${encodeURIComponent(d.code)}`} alt="Ticket QR code" className="mx-auto h-56 w-56" /> : <p className="py-10 font-semibold text-red-600">This ticket is {d.status.toLowerCase()}</p>}
            <p className="mt-2 font-mono text-lg font-bold tracking-wider">{d.code}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-4 text-sm">
              <div><p className="text-xs text-ink-500">Name</p><p className="font-semibold">{d.buyerName}</p></div>
              <div><p className="text-xs text-ink-500">Category</p><p className="font-semibold">{d.category.name}</p></div>
              <div><p className="text-xs text-ink-500">Admits</p><p className="font-semibold">{d.qty}</p></div>
            </div>
          </div>
        </div>
        <Button variant="secondary" className="mt-4 w-full print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / save</Button>
      </div>
    </PublicShell>
  );
}
