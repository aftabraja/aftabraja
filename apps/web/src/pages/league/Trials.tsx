import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ClipboardCheck, MapPin, Plus, ScanLine, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, StatusBadge, Table, Textarea } from '../../components/ui';

const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function TrialsList() {
  const { leagueId } = useLeague();
  const qc = useQueryClient();
  const trials = useQuery({ queryKey: ['trials', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/trials`) });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', city: '', venue: '', date: '', capacity: '100', inviteOnly: false });
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/trials`, { ...f, date: new Date(f.date).toISOString() }), onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['trials', leagueId] }); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/trials/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['trials', leagueId] }) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader title="Trials" subtitle="Schedule trial batches, check players in with QR passes, score them and auto-shortlist for the auction." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New trial</Button>} />
      {trials.isLoading ? <Spinner /> : !trials.data?.length ? <Card><Empty icon={<ClipboardCheck className="h-5 w-5" />} title="No trials scheduled" text="Create a trial batch. Registered players can sign up from their portal and get a QR pass." action={<Button onClick={() => setOpen(true)}>Create trial</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trials.data.map((t) => (
            <div key={t.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2"><Link to={`/leagues/${leagueId}/trials/${t.id}`} className="text-lg font-bold hover:text-brand-700">{t.title}</Link>{t.inviteOnly ? <Badge color="violet">Invite only</Badge> : <Badge color="blue">Open</Badge>}</div>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500"><CalendarDays className="h-4 w-4" />{fmt(t.date)}</p>
              <p className="flex items-center gap-1.5 text-sm text-ink-500"><MapPin className="h-4 w-4" />{[t.venue, t.city].filter(Boolean).join(', ') || '—'}</p>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>{t.registered}/{t.capacity} registered</span><span>{t.checkedIn} checked in · {t.scored} scored</span></div><Progress value={(t.registered / t.capacity) * 100} /></div>
              <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4"><Link to={`/leagues/${leagueId}/trials/${t.id}`} className="flex-1"><Button size="sm" className="w-full">Open trial desk</Button></Link><Button size="sm" variant="ghost" onClick={() => confirm('Delete this trial?') && remove.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New trial batch" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!f.title || !f.date} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={create.error} /></div>
          <Field label="Title" className="col-span-2"><Input value={f.title} onChange={set('title')} placeholder="Mumbai trials — Batch 1" /></Field>
          <Field label="Date & time"><Input type="datetime-local" value={f.date} onChange={set('date')} /></Field>
          <Field label="Capacity"><Input type="number" value={f.capacity} onChange={set('capacity')} /></Field>
          <Field label="Venue"><Input value={f.venue} onChange={set('venue')} /></Field>
          <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Registration" className="col-span-2"><Select value={f.inviteOnly ? 'invite' : 'open'} onChange={(e) => setF({ ...f, inviteOnly: e.target.value === 'invite' })} options={[{ value: 'open', label: 'Open — registered players can sign up' }, { value: 'invite', label: 'Invite only — league adds players' }]} /></Field>
        </div>
      </Modal>
    </>
  );
}

export function TrialDesk() {
  const { leagueId } = useLeague();
  const { tid } = useParams();
  const qc = useQueryClient();
  const key = ['trial', tid];
  const t = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/trials/${tid}`) });
  const regs = useQuery({ queryKey: ['registrations', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/registrations`) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [score, setScore] = useState<any>(null);
  const [sl, setSl] = useState<{ minTotal: string; role: string; maxAge: string } | null>(null);
  const checkin = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/trials/${tid}/checkin`, { code }), onSuccess: () => { setCode(''); refresh(); } });
  const add = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/trials/${tid}/entries`, { regIds: sel }), onSuccess: () => { setInvite(false); setSel([]); refresh(); } });
  const saveScore = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/trials/${tid}/entries/${score.id}`, { batting: score.batting === '' ? null : score.batting, bowling: score.bowling === '' ? null : score.bowling, fielding: score.fielding === '' ? null : score.fielding, fitness: score.fitness === '' ? null : score.fitness, comments: score.comments }), onSuccess: () => { setScore(null); refresh(); } });
  const shortlist = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/trials/${tid}/shortlist`, { minTotal: sl!.minTotal, role: sl!.role || undefined, maxAge: sl!.maxAge || undefined }), onSuccess: (r) => { alert(`${r.shortlisted} players shortlisted for the auction.`); setSl(null); refresh(); qc.invalidateQueries({ queryKey: ['registrations', leagueId] }); } });
  if (t.isLoading) return <Spinner />;
  const d = t.data;
  const inTrial = new Set(d.entries.map((e: any) => e.regId));

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/trials`} className="hover:underline">Trials</Link>} title={d.title} subtitle={`${fmt(d.date)} · ${[d.venue, d.city].filter(Boolean).join(', ')}`}
        actions={<><Button variant="secondary" onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" />Add players</Button><Button onClick={() => setSl({ minTotal: '24', role: '', maxAge: '' })}><Sparkles className="h-4 w-4" />Auto-shortlist</Button></>} />
      <Card className="mb-6">
        <form onSubmit={(e) => { e.preventDefault(); if (code) checkin.mutate(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Gate check-in" hint="Type or scan the player's pass code (TR-XXXXXXXX)" className="flex-1"><Input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TR-…" /></Field>
          <Button loading={checkin.isPending}><ScanLine className="h-4 w-4" />Check in</Button>
        </form>
        <div className="mt-2"><ErrorText error={checkin.error} />{checkin.isSuccess && <p className="text-sm text-emerald-700">Checked in ✓</p>}</div>
      </Card>
      <Card padded={false}>
        <Table head={['Player', 'Role', 'Pass', 'Checked in', 'Bat', 'Bowl', 'Field', 'Fit', 'Total /40', 'Status', '']} empty={!d.entries.length && <Empty title="No players in this trial yet" />}>
          {d.entries.map((e: any) => (
            <tr key={e.id}>
              <td className="td"><p className="font-medium text-ink-900">{e.name}</p><p className="text-xs text-ink-500">{e.phone ?? ''}</p></td>
              <td className="td">{e.role ?? '—'}</td>
              <td className="td font-mono text-xs">{e.code}</td>
              <td className="td">{e.checkedInAt ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />{new Date(e.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-ink-400">—</span>}</td>
              {['batting', 'bowling', 'fielding', 'fitness'].map((k) => <td key={k} className="td text-center">{e[k] ?? '—'}</td>)}
              <td className="td text-center font-bold">{e.total ?? '—'}</td>
              <td className="td"><StatusBadge status={e.status} /></td>
              <td className="td text-right"><Button size="sm" variant="secondary" onClick={() => setScore({ id: e.id, name: e.name, batting: e.batting ?? '', bowling: e.bowling ?? '', fielding: e.fielding ?? '', fitness: e.fitness ?? '', comments: e.comments ?? '' })}>Score</Button></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={!!score} onClose={() => setScore(null)} title={`Evaluate ${score?.name}`} footer={<><Button variant="secondary" onClick={() => setScore(null)}>Cancel</Button><Button loading={saveScore.isPending} onClick={() => saveScore.mutate()}>Save</Button></>}>
        {score && <div className="grid grid-cols-2 gap-3">
          {['batting', 'bowling', 'fielding', 'fitness'].map((k) => <Field key={k} label={`${k} (0–10)`}><Input type="number" min={0} max={10} value={score[k]} onChange={(e) => setScore({ ...score, [k]: e.target.value })} /></Field>)}
          <Field label="Scout comments" className="col-span-2"><Textarea value={score.comments} onChange={(e) => setScore({ ...score, comments: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={invite} onClose={() => setInvite(false)} size="lg" title="Add registered players" footer={<><Button variant="secondary" onClick={() => setInvite(false)}>Cancel</Button><Button disabled={!sel.length} loading={add.isPending} onClick={() => add.mutate()}>Add {sel.length} players</Button></>}>
        <ul className="divide-y divide-ink-100">{(regs.data ?? []).filter((g) => !inTrial.has(g.id)).map((g) => (
          <li key={g.id}><label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={sel.includes(g.id)} onChange={(e) => setSel(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id))} /><span className="flex-1 font-medium">{g.player.user.name}</span><span className="text-ink-500">{g.player.playingRole}</span><StatusBadge status={g.status} /></label></li>
        ))}</ul>
      </Modal>
      <Modal open={!!sl} onClose={() => setSl(null)} title="Auto-shortlist" footer={<><Button variant="secondary" onClick={() => setSl(null)}>Cancel</Button><Button loading={shortlist.isPending} onClick={() => shortlist.mutate()}>Shortlist</Button></>}>
        {sl && <div className="grid grid-cols-3 gap-3">
          <Field label="Min total (/40)"><Input type="number" value={sl.minTotal} onChange={(e) => setSl({ ...sl, minTotal: e.target.value })} /></Field>
          <Field label="Role"><Select value={sl.role} onChange={(e) => setSl({ ...sl, role: e.target.value })} placeholder="Any" options={['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper']} /></Field>
          <Field label="Max age"><Input type="number" value={sl.maxAge} onChange={(e) => setSl({ ...sl, maxAge: e.target.value })} /></Field>
          <p className="col-span-3 text-xs text-ink-500">Matching players move to "Shortlisted" and enter the auction pool. They're notified automatically.</p>
        </div>}
      </Modal>
    </>
  );
}
