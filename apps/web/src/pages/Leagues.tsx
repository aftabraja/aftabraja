import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Sparkles, Store, Trophy, Upload, Users } from 'lucide-react';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, fileToDataUrl } from '../lib/format';
import { Avatar, Button, Card, Empty, ErrorText, Field, Input, PageHeader, Progress, Select, Spinner, StatusBadge, Textarea, cx } from '../components/ui';
import { AiLogoStudio } from '../components/AiLogoStudio';
import { useVendorPanel } from '../components/VendorPanel';

export function LeaguesPage() {
  const { user } = useAuth();
  const leagues = useQuery({ queryKey: ['leagues'], queryFn: () => get<any[]>('/leagues') });
  const canCreate = user?.role === 'LEAGUE_OWNER' || user?.role === 'SUPER_ADMIN';
  return (
    <>
      <PageHeader title="My Leagues" subtitle="Every league you own, manage or have a team in." actions={canCreate && <Link to="/leagues/new"><Button><Plus className="h-4 w-4" />Create league</Button></Link>} />
      {leagues.isLoading ? <Spinner /> : !leagues.data?.length ? (
        <Card><Empty icon={<Trophy className="h-5 w-5" />} title="No leagues yet" text={canCreate ? 'Create your first league and SportsIQ will guide you through every step.' : 'When a league adds you, it will show up here.'} action={canCreate && <Link to="/leagues/new"><Button><Plus className="h-4 w-4" />Create league</Button></Link>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leagues.data.map((l) => (
            <Link key={l.id} to={`/leagues/${l.id}`} className="card group p-5 transition hover:border-brand-200 hover:shadow-pop">
              <div className="flex items-start gap-4">
                <Avatar name={l.name} src={l.logoUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="truncate font-bold group-hover:text-brand-700">{l.name}</p><StatusBadge status={l.status} /></div>
                  <p className="mt-0.5 text-xs text-ink-500">{[l.sport, l.format, l.category].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500">
                    {l.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{date(l.startDate)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{l._count.teams} teams</span>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-ink-700">League readiness</span><span className="font-bold text-brand-700">{l.progress.percent}%</span></div>
                <Progress value={l.progress.percent} />
                {l.progress.nextStep && <p className="mt-2 truncate text-xs text-ink-500">Next: {l.progress.nextStep.title}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const STEPS = ['Basics', 'Logo & brand', 'Schedule & teams'];

export function CreateLeague() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const [step, setStep] = useState(0);
  const [ai, setAi] = useState(false);
  const [f, setF] = useState<any>({ name: '', shortCode: '', sport: 'Cricket', format: 'T20', category: 'Open', city: '', description: '', logoUrl: '', startDate: '', endDate: '', numTeams: 8, teamPurse: '' });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: () => post('/leagues', { ...f, logoUrl: f.logoUrl || null, startDate: f.startDate || null, endDate: f.endDate || null, teamPurse: f.teamPurse || null, shortCode: f.shortCode || null }),
    onSuccess: (l) => { qc.invalidateQueries({ queryKey: ['leagues'] }); nav(`/leagues/${l.id}/playbook`); },
  });
  const next = (e: FormEvent) => { e.preventDefault(); step < 2 ? setStep(step + 1) : create.mutate(); };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create a new league" subtitle="Three quick steps. You can change everything later." breadcrumb={<Link to="/leagues" className="hover:underline">My Leagues</Link>} />
      <ol className="mb-6 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cx('rounded-lg border px-3 py-2 text-xs font-semibold', i === step ? 'border-brand-600 bg-brand-50 text-brand-700' : i < step ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-ink-200 text-ink-500')}>
            <span className="mr-1.5 opacity-60">Step {i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <form onSubmit={next}>
        <Card>
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="League name" className="sm:col-span-2"><Input required value={f.name} onChange={set('name')} placeholder="e.g. Corporate League T10" /></Field>
              <Field label="Short code" hint="Used on jerseys, tickets & hashtags"><Input maxLength={10} value={f.shortCode} onChange={set('shortCode')} placeholder="CLT10" /></Field>
              <Field label="Sport"><Select value={f.sport} onChange={set('sport')} options={['Cricket', 'Football', 'Kabaddi', 'Badminton', 'Volleyball', 'Basketball', 'Hockey', 'Tennis', 'Other']} /></Field>
              <Field label="Format"><Select value={f.format} onChange={set('format')} options={['T10', 'T20', 'The Hundred', 'ODI', 'Box Cricket', 'Indoor', 'Tennis Ball', 'Other']} /></Field>
              <Field label="Category"><Select value={f.category} onChange={set('category')} options={['Open', 'Corporate', 'Celebrity', 'State-level', 'District', 'School / University', 'Women', 'Veterans']} /></Field>
              <Field label="Host city"><Input value={f.city} onChange={set('city')} placeholder="Mumbai" /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} placeholder="Positioning, target audience, key USPs…" /></Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
              <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 p-3">
                {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-center text-xs text-ink-400">No logo yet</span>}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-ink-700">Add your league logo. Don't have one yet? Generate concepts with AI or hire a designer.</p>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-3 hover:bg-ink-50">
                  <Upload className="h-5 w-5 text-brand-700" /><span className="text-sm font-semibold">Upload logo</span><span className="text-xs text-ink-500">PNG, SVG or JPG · up to 2 MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, logoUrl: await fileToDataUrl(file) }); }} />
                </label>
                <button type="button" onClick={() => setAi(true)} className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3 text-left hover:bg-ink-50">
                  <Sparkles className="h-5 w-5 text-amber-500" /><span className="text-sm font-semibold">Design with SportsIQ AI</span><span className="text-xs text-ink-500">Instant crest concepts</span>
                </button>
                <button type="button" onClick={() => openVendors('logo-design')} className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3 text-left hover:bg-ink-50">
                  <Store className="h-5 w-5 text-brand-700" /><span className="text-sm font-semibold">Search logo designers</span><span className="text-xs text-ink-500">Opens vendor marketplace</span>
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Season start"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
              <Field label="Season end"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
              <Field label="Number of teams" hint="We'll create team slots you can sell as franchises"><Input type="number" min={0} max={64} value={f.numTeams} onChange={set('numTeams')} /></Field>
              <Field label="Auction purse per team (₹)"><Input type="number" min={0} value={f.teamPurse} onChange={set('teamPurse')} placeholder="5000000" /></Field>
            </div>
          )}
          <div className="mt-6"><ErrorText error={create.error} /></div>
          <div className="mt-6 flex justify-between border-t border-ink-100 pt-5">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4" />Back</Button>
            <Button loading={create.isPending}>{step < 2 ? <>Continue<ChevronRight className="h-4 w-4" /></> : 'Create league & open playbook'}</Button>
          </div>
        </Card>
      </form>
      <AiLogoStudio open={ai} onClose={() => setAi(false)} defaultName={f.name} defaultCode={f.shortCode} onSelect={(u) => setF({ ...f, logoUrl: u })} />
    </div>
  );
}
