import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, Briefcase, Crown, MapPin, Megaphone, Mic, Search, Star, Trophy, Users } from 'lucide-react';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { inrShort } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea } from '../components/ui';

export const PURPOSE_LABEL: Record<string, string> = { ENDORSEMENT: 'Brand endorsement', LEAGUE: 'League signing', APPEARANCE: 'Guest appearance / event' };
const followers = (n?: number | null) => (n == null ? null : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const range = (a?: number | null, b?: number | null) => (a ? (b && b !== a ? `${inrShort(a)} – ${inrShort(b)}` : inrShort(a)) : 'On request');

export default function TalentMarket() {
  const { user } = useAuth();
  const defaultPurpose = user?.role === 'SPONSOR' ? 'ENDORSEMENT' : 'LEAGUE';
  const [purpose, setPurpose] = useState<'ENDORSEMENT' | 'LEAGUE' | 'APPEARANCE'>(defaultPurpose as any);
  const [status, setStatus] = useState(defaultPurpose === 'LEAGUE' ? 'RETIRED' : '');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [open, setOpen] = useState<any>(null);
  const params = new URLSearchParams({ purpose, ...(status && { status }), ...(q && { q }), ...(role && { role }), ...(maxFee && { maxFee }) }).toString();
  const list = useQuery({ queryKey: ['talent', params], queryFn: () => get<any[]>(`/talent?${params}`) });
  const sent = useQuery({ queryKey: ['talent-sent'], queryFn: () => get<any[]>('/talent/enquiries/sent') });
  const fee = (t: any) => purpose === 'ENDORSEMENT' ? range(t.endorseFeeMin, t.endorseFeeMax) : purpose === 'LEAGUE' ? range(t.leagueFeeMin, t.leagueFeeMax) : range(t.appearanceFeeMin, t.appearanceFeeMax);

  return (
    <>
      <PageHeader title="Cricketers & Legends" subtitle="Players represented by verified agencies and managers — sign them for endorsements, league seasons or guest appearances." />
      <Tabs value={purpose} onChange={(v) => { setPurpose(v); setStatus(v === 'LEAGUE' ? 'RETIRED' : ''); }} tabs={[
        { value: 'ENDORSEMENT', label: <span className="flex items-center gap-1.5"><Megaphone className="h-4 w-4" />Brand endorsements</span> },
        { value: 'LEAGUE', label: <span className="flex items-center gap-1.5"><Crown className="h-4 w-4" />Legends for your league</span> },
        { value: 'APPEARANCE', label: <span className="flex items-center gap-1.5"><Mic className="h-4 w-4" />Guest appearances</span> },
      ]} />
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Name, team, state…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Active & retired" options={[{ value: 'ACTIVE', label: 'Active players' }, { value: 'RETIRED', label: 'Retired / legends' }]} />
          <Select value={role} onChange={(e) => setRole(e.target.value)} placeholder="Any role" options={['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper']} />
          <Select value={maxFee} onChange={(e) => setMaxFee(e.target.value)} placeholder="Any budget" options={[{ value: '200000', label: 'Up to ₹2 L' }, { value: '500000', label: 'Up to ₹5 L' }, { value: '1000000', label: 'Up to ₹10 L' }, { value: '2500000', label: 'Up to ₹25 L' }]} />
        </div>
      </Card>
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Card><Empty icon={<Users className="h-5 w-5" />} title="No players match" text="Try another filter. New agencies list players every week." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((t) => (
            <button key={t.id} onClick={() => setOpen(t)} className="card flex flex-col overflow-hidden text-left transition hover:border-brand-200 hover:shadow-pop">
              <div className="flex gap-4 p-5">
                <img src={t.photoUrl} alt="" className="h-24 w-20 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5"><p className="truncate text-lg font-bold">{t.name}</p>{t.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-brand-600" />}</div>
                  <p className="text-sm text-ink-500">{[t.playingRole, t.state].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{t.status === 'RETIRED' ? <Badge color="amber"><Crown className="h-3 w-3" />Legend</Badge> : <Badge color="green">Active</Badge>}{t.levels.slice(0, 2).map((l: string) => <Badge key={l}>{l}</Badge>)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-y border-ink-100 text-center text-xs">
                <div className="p-2.5"><p className="font-bold text-ink-900">{t.matches}</p><p className="text-ink-500">Matches</p></div>
                <div className="border-x border-ink-100 p-2.5"><p className="font-bold text-ink-900">{t.playingRole === 'Bowler' ? t.wickets : t.runs.toLocaleString('en-IN')}</p><p className="text-ink-500">{t.playingRole === 'Bowler' ? 'Wickets' : 'Runs'}</p></div>
                <div className="p-2.5"><p className="font-bold text-ink-900">{followers(t.followers) ?? '—'}</p><p className="text-ink-500">Followers</p></div>
              </div>
              <div className="flex items-center justify-between px-5 py-3 text-sm"><span className="truncate text-ink-500">{t.agency.agencyName}</span><span className="shrink-0 font-semibold text-brand-700">{fee(t)}</span></div>
            </button>
          ))}
        </div>
      )}
      {!!sent.data?.length && (
        <Card className="mt-8" title="My enquiries" padded={false}>
          <ul className="divide-y divide-ink-100">{sent.data.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <Avatar name={e.talent.name} src={e.talent.photoUrl} size={32} />
              <span className="min-w-0 flex-1"><span className="font-medium">{e.talent.name}</span><span className="text-ink-500"> · {PURPOSE_LABEL[e.purpose]} · {e.talent.agency.agencyName}</span></span>
              <Badge color={e.status === 'CONFIRMED' ? 'green' : e.status === 'DECLINED' ? 'red' : e.status === 'IN_DISCUSSION' ? 'amber' : 'gray'}>{e.status.replace('_', ' ').toLowerCase()}</Badge>
              {e.conversationId && <Link to={`/messages/${e.conversationId}`} className="text-xs font-semibold text-brand-700 hover:underline">Open chat</Link>}
            </li>
          ))}</ul>
        </Card>
      )}
      {open && <TalentModal t={open} defaultPurpose={purpose} onClose={() => setOpen(null)} onSent={() => sent.refetch()} />}
    </>
  );
}

function TalentModal({ t, defaultPurpose, onClose, onSent }: { t: any; defaultPurpose: string; onClose: () => void; onSent: () => void }) {
  const { user } = useAuth();
  const leagues = useQuery({ queryKey: ['leagues'], queryFn: () => get<any[]>('/leagues'), enabled: user?.role !== 'SPONSOR' });
  const avail = [t.forEndorsement && 'ENDORSEMENT', t.forLeagues && 'LEAGUE', t.forAppearances && 'APPEARANCE'].filter(Boolean) as string[];
  const [f, setF] = useState({ purpose: avail.includes(defaultPurpose) ? defaultPurpose : avail[0], organisation: user?.sponsorProfile?.companyName ?? '', leagueId: '', budget: '', dates: '', message: '' });
  const send = useMutation({ mutationFn: () => post(`/talent/${t.id}/enquiries`, { ...f, budget: f.budget || undefined, leagueId: f.leagueId || undefined }), onSuccess: onSent });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} size="xl" title={<span className="flex items-center gap-2">{t.name}{t.verified && <BadgeCheck className="h-5 w-5 text-brand-600" />}</span>}>
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div>
          <div className="flex gap-4">
            <img src={t.photoUrl} alt="" className="h-32 w-28 rounded-xl object-cover" />
            <div>
              <p className="text-sm text-ink-500">{[t.playingRole, t.battingStyle, t.bowlingStyle].filter(Boolean).join(' · ')}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" />{[t.state, t.country].filter(Boolean).join(', ')}{t.bornYear && ` · b. ${t.bornYear}`}</p>
              <div className="mt-2 flex flex-wrap gap-1">{t.status === 'RETIRED' ? <Badge color="amber">Retired · Legend</Badge> : <Badge color="green">Active</Badge>}{t.levels.map((l: string) => <Badge key={l}>{l}</Badge>)}</div>
              <p className="mt-3 text-sm"><Briefcase className="mr-1 inline h-4 w-4 text-ink-400" />Represented by <b>{t.agency.agencyName}</b>{t.agency.verified && <BadgeCheck className="ml-1 inline h-4 w-4 text-brand-600" />}</p>
            </div>
          </div>
          {t.bio && <p className="mt-4 text-sm text-ink-700">{t.bio}</p>}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[['Matches', t.matches], ['Runs', t.runs.toLocaleString('en-IN')], ['Wickets', t.wickets], ['Followers', followers(t.followers) ?? '—']].map(([l, v]) => <div key={l as string} className="rounded-lg bg-ink-50 p-2"><p className="font-bold">{v}</p><p className="text-xs text-ink-500">{l}</p></div>)}
          </div>
          {t.highlights.length > 0 && <div className="mt-4"><p className="label">Career highlights</p><ul className="space-y-1">{t.highlights.map((h: string) => <li key={h} className="flex gap-2 text-sm"><Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{h}</li>)}</ul></div>}
          {t.teamsPlayed.length > 0 && <p className="mt-3 text-sm"><Trophy className="mr-1 inline h-4 w-4 text-ink-400" />Played for: {t.teamsPlayed.join(', ')}</p>}
          <div className="mt-4"><p className="label">Indicative fees</p>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              {t.forEndorsement && <div className="rounded-lg border border-ink-200 p-2.5"><p className="text-xs text-ink-500">Endorsement</p><p className="font-semibold">{range(t.endorseFeeMin, t.endorseFeeMax)}</p></div>}
              {t.forLeagues && <div className="rounded-lg border border-ink-200 p-2.5"><p className="text-xs text-ink-500">League season</p><p className="font-semibold">{range(t.leagueFeeMin, t.leagueFeeMax)}</p></div>}
              {t.forAppearances && <div className="rounded-lg border border-ink-200 p-2.5"><p className="text-xs text-ink-500">Appearance</p><p className="font-semibold">{range(t.appearanceFeeMin, t.appearanceFeeMax)}</p></div>}
            </div>
          </div>
          {t.brandRestrictions && <p className="mt-3 text-xs text-amber-800">Brand restrictions: {t.brandRestrictions}</p>}
          {t.languages.length > 0 && <p className="mt-1 text-xs text-ink-500">Languages: {t.languages.join(', ')}</p>}
        </div>
        <div className="rounded-xl border border-ink-200 p-4">
          {send.isSuccess ? (
            <div className="py-8 text-center"><p className="font-semibold text-emerald-700">Enquiry sent to {t.agency.agencyName}</p><Link to={`/messages/${send.data.conversationId}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">Continue in Messages →</Link></div>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold">Contact the agent</p>
              <ErrorText error={send.error} />
              <Field label="Purpose"><Select value={f.purpose} onChange={set('purpose')} options={avail.map((v) => ({ value: v, label: PURPOSE_LABEL[v] }))} /></Field>
              {f.purpose === 'LEAGUE' && leagues.data?.length ? <Field label="For league"><Select value={f.leagueId} onChange={set('leagueId')} placeholder="Select league" options={leagues.data.map((l) => ({ value: l.id, label: l.name }))} /></Field> : <Field label="Brand / organisation"><Input value={f.organisation} onChange={set('organisation')} /></Field>}
              <div className="grid grid-cols-2 gap-2"><Field label="Budget (₹)"><Input type="number" value={f.budget} onChange={set('budget')} /></Field><Field label="Dates"><Input value={f.dates} onChange={set('dates')} placeholder="e.g. Jan 2027" /></Field></div>
              <Field label="Message"><Textarea rows={4} value={f.message} onChange={set('message')} placeholder={f.purpose === 'ENDORSEMENT' ? 'Campaign, deliverables (shoot days, posts), usage period, territories…' : f.purpose === 'LEAGUE' ? 'League, format, season dates, role (player / mentor / icon)…' : 'Event, city, date, duration…'} /></Field>
              <Button className="w-full" loading={send.isPending} disabled={f.message.length < 10} onClick={() => send.mutate()}>Send enquiry</Button>
              <p className="text-[11px] text-ink-500">Fees are indicative and set by the agent. Agreements are made directly between you and the agent/player — SportsIQ is not a party. Verify representation before signing.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

