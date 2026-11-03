import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, CheckCircle2, MapPin, Pencil, Plus, Star, Trash2, Trophy } from 'lucide-react';
import { del, get, patch, post } from '../lib/api';
import { date, dateInput, inr, inrShort } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, StatusBadge, Table, Textarea } from '../components/ui';
import { useCategories } from '../components/VendorPanel';

/* ---------------- Vendor portal ---------------- */
export function VendorHome() {
  const qc = useQueryClient();
  const v = useQuery({ queryKey: ['my-vendor'], queryFn: () => get('/vendors/me/profile') });
  const [f, setF] = useState<any>(null);
  const [svc, setSvc] = useState<any>(null);
  useEffect(() => { if (v.data && !f) setF({ ...v.data, serviceAreas: v.data.serviceAreas.join(', ') }); }, [v.data, f]);
  const save = useMutation({ mutationFn: () => patch('/vendors/me/profile', { companyName: f.companyName, description: f.description, city: f.city, state: f.state, serviceAreas: f.serviceAreas.split(',').map((s: string) => s.trim()).filter(Boolean), gstNumber: f.gstNumber, website: f.website, phone: f.phone, yearsInBusiness: f.yearsInBusiness || null }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-vendor'] }) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/vendors/me/services/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-vendor'] }) });
  if (!f) return <Spinner />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{v.data.companyName}{v.data.verified && <BadgeCheck className="h-6 w-6 text-brand-600" />}</span>} subtitle="Your profile and services are visible to every league on SportsIQ." actions={<Button onClick={() => setSvc({})}><Plus className="h-4 w-4" />Add service</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Services listed" value={v.data.services.length} />
        <Stat label="Rating" value={v.data.rating ? v.data.rating.toFixed(1) : '—'} sub={`${v.data.reviewCount} reviews`} icon={<Star className="h-4 w-4" />} />
        <Stat label="Verification" value={v.data.verified ? 'Verified' : 'Pending'} sub={v.data.verified ? 'Shown with a blue badge' : 'Complete your profile & GST to get verified'} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Business profile" action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
          {save.isSuccess && <p className="mb-3 text-sm text-emerald-700">Saved.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2"><Input value={f.companyName} onChange={set('companyName')} /></Field>
            <Field label="About" className="sm:col-span-2"><Textarea value={f.description ?? ''} onChange={set('description')} /></Field>
            <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
            <Field label="State"><Input value={f.state ?? ''} onChange={set('state')} /></Field>
            <Field label="Service areas" hint="Comma separated, e.g. Mumbai, Pune, Pan India" className="sm:col-span-2"><Input value={f.serviceAreas} onChange={set('serviceAreas')} /></Field>
            <Field label="GST number"><Input value={f.gstNumber ?? ''} onChange={set('gstNumber')} /></Field>
            <Field label="Years in business"><Input type="number" value={f.yearsInBusiness ?? ''} onChange={set('yearsInBusiness')} /></Field>
            <Field label="Phone"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label="Website"><Input value={f.website ?? ''} onChange={set('website')} /></Field>
          </div>
        </Card>
        <Card title="Services & pricing" padded={false}>
          <Table head={['Service', 'Category', 'Price', '']} empty={!v.data.services.length && <Empty title="No services yet" text="Add each service you offer with a price range so leagues can find you." action={<Button onClick={() => setSvc({})}>Add service</Button>} />}>
            {v.data.services.map((s: any) => (
              <tr key={s.id}>
                <td className="td"><p className="font-medium text-ink-900">{s.title}</p>{s.description && <p className="max-w-xs truncate text-xs text-ink-500">{s.description}</p>}</td>
                <td className="td"><Badge>{s.category.name}</Badge></td>
                <td className="td">{s.priceMin ? `${inr(s.priceMin)}${s.priceMax && s.priceMax !== s.priceMin ? ` – ${inr(s.priceMax)}` : ''}` : 'On request'}<p className="text-xs text-ink-500">{s.unit}</p></td>
                <td className="td text-right"><div className="flex justify-end gap-1"><button onClick={() => setSvc({ ...s, categorySlug: s.category.slug })} className="p-1.5 text-ink-400 hover:text-ink-900" aria-label="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => confirm('Delete service?') && remove.mutate(s.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      {svc && <ServiceModal svc={svc} onClose={() => { setSvc(null); qc.invalidateQueries({ queryKey: ['my-vendor'] }); }} />}
    </>
  );
}

function ServiceModal({ svc, onClose }: { svc: any; onClose: () => void }) {
  const cats = useCategories();
  const [f, setF] = useState({ categorySlug: svc.categorySlug ?? '', title: svc.title ?? '', description: svc.description ?? '', priceMin: svc.priceMin ?? '', priceMax: svc.priceMax ?? '', unit: svc.unit ?? 'per event' });
  const save = useMutation({ mutationFn: () => { const b = { ...f, priceMin: f.priceMin || null, priceMax: f.priceMax || null }; return svc.id ? patch(`/vendors/me/services/${svc.id}`, b) : post('/vendors/me/services', b); }, onSuccess: onClose });
  const cat = cats.data?.categories.find((c) => c.slug === f.categorySlug);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={svc.id ? 'Edit service' : 'Add service'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.categorySlug || !f.title} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-3">
        <ErrorText error={save.error} />
        <Field label="Category">
          <select className="input" value={f.categorySlug} onChange={set('categorySlug')}>
            <option value="">Select category</option>
            {cats.data?.groups.map((g) => <optgroup key={g} label={g}>{cats.data.categories.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</optgroup>)}
          </select>
        </Field>
        {cat && <div className="flex flex-wrap gap-1">{cat.suggestions.map((s) => <button key={s} type="button" onClick={() => setF({ ...f, title: s })} className="rounded-full border border-ink-200 px-2.5 py-0.5 text-xs hover:border-brand-300 hover:bg-brand-50">{s}</button>)}</div>}
        <Field label="Service title"><Input value={f.title} onChange={set('title')} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min price (₹)"><Input type="number" value={f.priceMin} onChange={set('priceMin')} /></Field>
          <Field label="Max price (₹)"><Input type="number" value={f.priceMax} onChange={set('priceMax')} /></Field>
          <Field label="Unit"><Select value={f.unit} onChange={set('unit')} options={['per event', 'per match', 'per day', 'per piece', 'per person per day', 'per room per night', 'per project', 'per team', 'lump sum']} /></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Sponsor portal ---------------- */
export function SponsorHome() {
  const [within, setWithin] = useState('');
  const [tier, setTier] = useState('');
  const [city, setCity] = useState('');
  const [interest, setInterest] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const tiers = useQuery({ queryKey: ['tiers'], queryFn: () => get<string[]>('/sponsors/tiers') });
  const params = new URLSearchParams({ ...(within && { within }), ...(tier && { tier }), ...(city && { city }) }).toString();
  const leagues = useQuery({ queryKey: ['marketplace', params], queryFn: () => get<any[]>(`/sponsors/marketplace?${params}`) });
  const send = useMutation({ mutationFn: () => post(`/sponsors/opportunities/${interest.opp.id}/interest`, { message: msg }), onSuccess: () => { setInterest(null); setMsg(''); leagues.refetch(); } });
  return (
    <>
      <PageHeader title="League Marketplace" subtitle="Upcoming leagues, their readiness, and open sponsorship opportunities with pricing and deliverables." />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Starting within"><Select value={within} onChange={(e) => setWithin(e.target.value)} placeholder="Any time" options={[{ value: '1', label: 'Next month' }, { value: '2', label: 'Next 2 months' }, { value: '3', label: 'Next 3 months' }, { value: '6', label: 'Next 6 months' }, { value: '12', label: 'Next 12 months' }]} /></Field>
          <Field label="Opportunity type"><Select value={tier} onChange={(e) => setTier(e.target.value)} placeholder="All types" options={tiers.data ?? []} /></Field>
          <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any city" /></Field>
        </div>
      </Card>
      {send.isSuccess && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Interest sent — the league owner has been notified. Continue in Messages.</div>}
      {leagues.isLoading ? <Spinner /> : !leagues.data?.length ? <Card><Empty icon={<Trophy className="h-5 w-5" />} title="No leagues match these filters" /></Card> : (
        <div className="space-y-6">
          {leagues.data.map((l) => (
            <Card key={l.id} padded={false}>
              <div className="grid gap-5 border-b border-ink-100 p-5 md:grid-cols-[1fr_260px]">
                <div className="flex gap-4">
                  <Avatar name={l.name} src={l.logoUrl} size={64} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{l.name}</h3><StatusBadge status={l.status} /></div>
                    <p className="text-sm text-ink-500">{[l.sport, l.format, l.category].filter(Boolean).join(' · ')}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
                      {l.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{date(l.startDate)} – {date(l.endDate)}</span>
                      <span>{l._count.teams} teams · {l._count.registrations} players</span>
                    </div>
                    {l.description && <p className="mt-2 text-sm text-ink-700">{l.description}</p>}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">League readiness</span><span className="font-bold text-brand-700">{l.progress.percent}%</span></div>
                  <Progress value={l.progress.percent} />
                  <p className="mt-2 text-xs text-ink-500">{l.progress.criticalDone}/{l.progress.criticalTotal} critical milestones done</p>
                </div>
              </div>
              {l.opportunities.length ? (
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {l.opportunities.map((o: any) => (
                    <div key={o.id} className="flex flex-col rounded-xl border border-ink-200 p-4">
                      <div className="flex items-start justify-between gap-2"><Badge color="violet">{o.tier}</Badge>{o.status === 'IN_DISCUSSION' && <Badge color="amber">In discussion</Badge>}</div>
                      <p className="mt-2 font-bold">{o.title}</p>
                      <p className="text-xl font-extrabold text-brand-700">{inrShort(o.price)}</p>
                      <ul className="mt-2 flex-1 space-y-1">{o.deliverables.slice(0, 4).map((d: string, i: number) => <li key={i} className="flex gap-1.5 text-xs text-ink-700"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{d}</li>)}</ul>
                      <Button size="sm" className="mt-3" onClick={() => { setInterest({ opp: o, league: l }); setMsg(`Hi, we're interested in the ${o.title} package for ${l.name}. Please share the detailed proposal and audience data.`); }}>Contact league owner</Button>
                    </div>
                  ))}
                </div>
              ) : <p className="p-5 text-sm text-ink-500">No open opportunities right now.</p>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!interest} onClose={() => setInterest(null)} title={`${interest?.opp.title} — ${interest?.league.name}`} footer={<><Button variant="secondary" onClick={() => setInterest(null)}>Cancel</Button><Button loading={send.isPending} onClick={() => send.mutate()}>Send to league owner</Button></>}>
        <ErrorText error={send.error} />
        <Textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </Modal>
    </>
  );
}

export function SponsorProfile() {
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ['my-sponsor'], queryFn: () => get('/sponsors/me/profile') });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (p.data && !f) setF(p.data); }, [p.data, f]);
  const save = useMutation({ mutationFn: () => patch('/sponsors/me/profile', { companyName: f.companyName, industry: f.industry, website: f.website, city: f.city, description: f.description, budgetMin: f.budgetMin || null, budgetMax: f.budgetMax || null }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-sponsor'] }) });
  if (!f) return <Spinner />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Company Profile" subtitle="Leagues see this when they search for sponsors." actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>} />
      {save.isSuccess && <p className="mb-3 text-sm text-emerald-700">Saved.</p>}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" className="sm:col-span-2"><Input value={f.companyName} onChange={set('companyName')} /></Field>
          <Field label="Industry"><Input value={f.industry ?? ''} onChange={set('industry')} /></Field>
          <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
          <Field label="Website" className="sm:col-span-2"><Input value={f.website ?? ''} onChange={set('website')} /></Field>
          <Field label="What you look for in a partnership" className="sm:col-span-2"><Textarea value={f.description ?? ''} onChange={set('description')} /></Field>
          <Field label="Budget from (₹)"><Input type="number" value={f.budgetMin ?? ''} onChange={set('budgetMin')} /></Field>
          <Field label="Budget up to (₹)"><Input type="number" value={f.budgetMax ?? ''} onChange={set('budgetMax')} /></Field>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Player portal ---------------- */
export function PlayerHome() {
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ['my-player'], queryFn: () => get('/players/me') });
  const open = useQuery({ queryKey: ['open-leagues'], queryFn: () => get<any[]>('/players/open-leagues') });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (p.data && !f) setF({ ...p.data, dob: dateInput(p.data.dob) }); }, [p.data, f]);
  const save = useMutation({ mutationFn: () => patch('/players/me', { dob: f.dob || null, city: f.city, state: f.state, playingRole: f.playingRole, battingStyle: f.battingStyle, bowlingStyle: f.bowlingStyle, bio: f.bio, matches: f.matches, runs: f.runs, wickets: f.wickets, videoUrl: f.videoUrl }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-player'] }) });
  const register = useMutation({ mutationFn: (id: string) => post(`/players/register/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-player'] }) });
  if (!f) return <Spinner />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const registered = new Set(p.data.registrations.map((r: any) => r.leagueId));
  return (
    <>
      <PageHeader title="My Player Profile" subtitle="Keep your profile sharp — scouts and league managers see it when you register." actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save profile</Button>} />
      {save.isSuccess && <p className="mb-3 text-sm text-emerald-700">Saved.</p>}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Profile">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Playing role"><Select value={f.playingRole ?? ''} onChange={set('playingRole')} placeholder="Select" options={['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper']} /></Field>
            <Field label="Batting style"><Select value={f.battingStyle ?? ''} onChange={set('battingStyle')} placeholder="Select" options={['Right-hand bat', 'Left-hand bat']} /></Field>
            <Field label="Bowling style"><Select value={f.bowlingStyle ?? ''} onChange={set('bowlingStyle')} placeholder="None" options={['Right-arm fast', 'Right-arm medium', 'Left-arm fast', 'Left-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin', 'Left-arm orthodox', 'Left-arm wrist-spin']} /></Field>
            <Field label="Date of birth"><Input type="date" value={f.dob} onChange={set('dob')} /></Field>
            <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
            <Field label="State"><Input value={f.state ?? ''} onChange={set('state')} /></Field>
            <Field label="Matches"><Input type="number" value={f.matches} onChange={set('matches')} /></Field>
            <Field label="Runs"><Input type="number" value={f.runs} onChange={set('runs')} /></Field>
            <Field label="Wickets"><Input type="number" value={f.wickets} onChange={set('wickets')} /></Field>
            <Field label="Highlights video link" className="sm:col-span-3"><Input value={f.videoUrl ?? ''} onChange={set('videoUrl')} placeholder="https://youtube.com/…" /></Field>
            <Field label="About you" className="sm:col-span-3"><Textarea value={f.bio ?? ''} onChange={set('bio')} /></Field>
          </div>
        </Card>
        <div className="space-y-6">
          <PlayerTrials />
          <Card title="My registrations" padded={false}>
            {!p.data.registrations.length ? <Empty title="Not registered yet" text="Register for an open league below." /> : (
              <ul className="divide-y divide-ink-100">
                {p.data.registrations.map((r: any) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={r.league.name} src={r.league.logoUrl} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.league.name}</p><p className="text-xs text-ink-500">{r.team ? `Picked by ${r.team.name}` : date(r.league.startDate)}</p></div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Open leagues" padded={false}>
            {!open.data?.length ? <Empty title="No open leagues right now" /> : (
              <ul className="divide-y divide-ink-100">
                {open.data.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={l.name} src={l.logoUrl} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="text-xs text-ink-500">{[l.format, l.city, date(l.startDate)].filter(Boolean).join(' · ')}</p></div>
                    {registered.has(l.id) ? <Badge color="green">Registered</Badge> : <Button size="sm" loading={register.isPending && register.variables === l.id} onClick={() => register.mutate(l.id)}>Register</Button>}
                  </li>
                ))}
              </ul>
            )}
            {register.error && <div className="p-3"><ErrorText error={register.error} /></div>}
          </Card>
        </div>
      </div>
    </>
  );
}

function PlayerTrials() {
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ['my-trials'], queryFn: () => get<any[]>('/players/trials') });
  const reg = useMutation({ mutationFn: (id: string) => post(`/players/trials/${id}/register`), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-trials'] }) });
  if (!t.data?.length) return null;
  return (
    <Card title="Trials" padded={false}>
      <ul className="divide-y divide-ink-100">
        {t.data.map((x) => (
          <li key={x.id} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{x.title}</p>
                <p className="text-xs text-ink-500">{x.league.name} · {new Date(x.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {[x.venue, x.city].filter(Boolean).join(', ')}</p>
              </div>
              {!x.myPass && <Button size="sm" disabled={x.full} loading={reg.isPending && reg.variables === x.id} onClick={() => reg.mutate(x.id)}>{x.full ? 'Full' : 'Register'}</Button>}
            </div>
            {x.myPass && (
              <div className="mt-3 flex items-center gap-4 rounded-xl border border-ink-200 p-3">
                <img src={`/api/qr?data=${encodeURIComponent(x.myPass.code)}`} alt="Trial pass QR" className="h-24 w-24" />
                <div><p className="text-xs text-ink-500">Your trial pass — show at the gate</p><p className="font-mono text-lg font-bold">{x.myPass.code}</p>{x.myPass.checkedInAt && <Badge color="green">Checked in</Badge>}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {reg.error && <div className="p-3"><ErrorText error={reg.error} /></div>}
    </Card>
  );
}
