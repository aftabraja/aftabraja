import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, Radio, Trash2, Tv } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Table, Tabs, cx } from '../../components/ui';

const PHASE_LABEL: Record<string, string> = { 'T-7': 'One week out', 'T-2': 'Two days out', 'T-1': 'Day before', MATCH_DAY: 'Match day', POST: 'After the match' };
const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
const dtInput = (d?: string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
const fixture = (m: any) => `${m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeLabel ?? 'TBD'} vs ${m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awayLabel ?? 'TBD'}`;

export default function MatchDay() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'checklists' | 'broadcast'>((params.get('tab') as any) ?? 'checklists');
  return (
    <>
      <PageHeader title="Match-day Operations" subtitle="Run sheet for every match — from officials and permissions a week out to the ground handover — plus broadcast slots for your TV / OTT partners." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setParams(t === 'checklists' ? {} : { tab: t }); }} tabs={[{ value: 'checklists', label: 'Match-day checklists' }, { value: 'broadcast', label: 'Broadcast & TV slots' }]} />
      {tab === 'checklists' ? <Checklists initial={params.get('match')} /> : <Broadcast />}
    </>
  );
}

function Checklists({ initial }: { initial: string | null }) {
  const { leagueId } = useLeague();
  const list = useQuery({ queryKey: ['matchday', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/matchday/summary`) });
  const [sel, setSel] = useState<string | null>(initial);
  useEffect(() => { if (!sel && list.data?.length) setSel(list.data[0].id); }, [list.data, sel]);
  if (list.isLoading) return <Spinner />;
  if (!list.data?.length) return <Card><Empty icon={<ClipboardCheck className="h-5 w-5" />} title="No upcoming matches" text="Create your fixtures first — every match gets a ready-made run sheet." action={<Link to={`/leagues/${leagueId}/fixtures`}><Button>Go to fixtures</Button></Link>} /></Card>;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card padded={false} className="h-fit">
        <ul className="max-h-[70vh] divide-y divide-ink-100 overflow-y-auto">
          {list.data.map((m) => (
            <li key={m.id}>
              <button onClick={() => setSel(m.id)} className={cx('w-full px-4 py-3 text-left hover:bg-ink-50', sel === m.id && 'bg-brand-50')}>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">M{m.number} · {fixture(m)}</span>{m.status === 'LIVE' && <Badge color="red">live</Badge>}</div>
                <p className="text-xs text-ink-500">{when(m.startsAt)}{m.venue ? ` · ${m.venue.name}` : ''}</p>
                {m.checklist ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress className="h-1.5 flex-1" value={(m.checklist.done / m.checklist.total) * 100} tone={m.checklist.criticalOpen ? 'red' : 'green'} />
                    <span className="text-[11px] text-ink-500">{m.checklist.done}/{m.checklist.total}</span>
                    {m.checklist.overdue > 0 && <span className="text-[11px] font-semibold text-red-600">{m.checklist.overdue} overdue</span>}
                  </div>
                ) : <p className="mt-1 text-[11px] text-ink-400">Run sheet not opened yet</p>}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {sel && <MatchChecklist key={sel} matchId={sel} />}
    </div>
  );
}

function MatchChecklist({ matchId }: { matchId: string }) {
  const { leagueId } = useLeague();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['checklist', matchId], queryFn: () => get(`/leagues/${leagueId}/matchday/checklist/${matchId}`) });
  const refresh = () => { q.refetch(); qc.invalidateQueries({ queryKey: ['matchday', leagueId] }); };
  const toggle = useMutation({ mutationFn: ({ id, done }: any) => patch(`/leagues/${leagueId}/matchday/checklist/items/${id}`, { done }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/matchday/checklist/items/${id}`), onSuccess: refresh });
  const [add, setAdd] = useState<any>(null);
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/matchday/checklist/${matchId}/items`, { ...add, dueAt: add.dueAt || null }), onSuccess: () => { setAdd(null); refresh(); } });
  if (q.isLoading) return <Spinner />;
  const { match: m, items, summary, phases } = q.data;
  const now = Date.now();
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1"><p className="text-lg font-bold">Match {m.number} · {fixture(m)}</p><p className="text-sm text-ink-500">{when(m.startsAt)}{m.venue ? ` · ${m.venue.name}` : ''} · {m.stage}</p></div>
          <div className="text-right"><p className="text-2xl font-extrabold text-brand-700">{summary.done}/{summary.total}</p><p className="text-xs text-ink-500">checks done</p></div>
          <Button variant="secondary" onClick={() => setAdd({ title: '', phase: 'MATCH_DAY', department: 'Operations', critical: false, dueAt: '' })}><Plus className="h-4 w-4" />Add check</Button>
          <Link to={`/leagues/${leagueId}/matches/${m.id}`}><Button>Match centre</Button></Link>
        </div>
        {summary.criticalOpen > 0
          ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-800"><AlertTriangle className="h-4 w-4" />{summary.criticalOpen} critical check{summary.criticalOpen > 1 ? 's' : ''} open — scoring can't start until they are done.</p>
          : <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />All critical checks done — cleared for the toss.</p>}
      </Card>
      {phases.map((ph: string) => {
        const rows = items.filter((i: any) => i.phase === ph);
        if (!rows.length) return null;
        return (
          <Card key={ph} title={<span className="flex items-center gap-2">{PHASE_LABEL[ph]} <span className="text-xs font-normal text-ink-500">{rows.filter((r: any) => r.done).length}/{rows.length}</span></span>} padded={false}>
            <ul className="divide-y divide-ink-100">
              {rows.map((it: any) => {
                const overdue = !it.done && it.dueAt && new Date(it.dueAt).getTime() < now;
                return (
                  <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={it.done} onChange={(e) => toggle.mutate({ id: it.id, done: e.target.checked })} aria-label={it.title} />
                    <div className="min-w-0 flex-1">
                      <p className={cx('text-sm', it.done && 'text-ink-500 line-through')}>{it.title}{it.critical && <Badge color="red" className="ml-2">critical</Badge>}</p>
                      <p className="text-xs text-ink-500">{it.department} · due {when(it.dueAt)}{overdue && <span className="ml-1 font-semibold text-red-600">overdue</span>}{it.done && it.doneBy && ` · done by ${it.doneBy} ${when(it.doneAt)}`}</p>
                    </div>
                    {!it.critical && <button onClick={() => confirm('Remove this check?') && remove.mutate(it.id)} className="p-1 text-ink-300 hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      <Modal open={!!add} onClose={() => setAdd(null)} title="Add a check" footer={<><Button variant="secondary" onClick={() => setAdd(null)}>Cancel</Button><Button disabled={!add?.title || add.title.length < 3} loading={create.isPending} onClick={() => create.mutate()}>Add</Button></>}>
        {add && <div className="grid gap-3 sm:grid-cols-2">
          <ErrorText error={create.error} />
          <Field label="What needs to happen" className="sm:col-span-2"><Input value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} /></Field>
          <Field label="When"><Select value={add.phase} onChange={(e) => setAdd({ ...add, phase: e.target.value })} options={phases.map((p: string) => ({ value: p, label: PHASE_LABEL[p] }))} /></Field>
          <Field label="Department"><Select value={add.department} onChange={(e) => setAdd({ ...add, department: e.target.value })} options={['Operations', 'Cricket Operations', 'Logistics', 'Production', 'Commercial', 'Marketing', 'Finance', 'Legal']} /></Field>
          <Field label="Due"><Input type="datetime-local" value={add.dueAt} onChange={(e) => setAdd({ ...add, dueAt: e.target.value })} /></Field>
          <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={add.critical} onChange={(e) => setAdd({ ...add, critical: e.target.checked })} />Must be done before the toss</label>
        </div>}
      </Modal>
    </div>
  );
}

function Broadcast() {
  const { leagueId, isStaff } = useLeague();
  const q = useQuery({ queryKey: ['broadcast', leagueId], queryFn: () => get(`/leagues/${leagueId}/matchday/broadcast`) });
  const [edit, setEdit] = useState<any>(null);
  const [bulk, setBulk] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/matchday/broadcast/${edit.id}`, { broadcaster: edit.broadcaster || null, tvSlot: edit.tvSlot || null, onAirAt: edit.onAirAt || null, offAirAt: edit.offAirAt || null, streamUrl: edit.streamUrl || '' }), onSuccess: () => { setEdit(null); q.refetch(); } });
  const assign = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/matchday/broadcast/bulk`, { ...bulk, matchIds: picked }), onSuccess: () => { setBulk(null); setPicked([]); q.refetch(); } });
  if (q.isLoading) return <Spinner />;
  const { matches, clashes } = q.data;
  return (
    <>
      {clashes > 0 && <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4" />{clashes} broadcast clash{clashes > 1 ? 'es' : ''}: the same broadcaster has overlapping on-air windows.</p>}
      <Card padded={false} title={<span className="flex items-center gap-2"><Tv className="h-4 w-4" />Broadcast schedule</span>} action={isStaff && <Button size="sm" disabled={!picked.length} onClick={() => setBulk({ broadcaster: '', tvSlot: 'Prime time', preShowMinutes: 30, durationHours: 4 })}><Radio className="h-3.5 w-3.5" />Assign broadcaster ({picked.length})</Button>}>
        <Table head={[isStaff ? <input type="checkbox" aria-label="Select all" checked={picked.length === matches.length && matches.length > 0} onChange={(e) => setPicked(e.target.checked ? matches.map((m: any) => m.id) : [])} /> : '', '#', 'Fixture', 'First ball', 'Broadcaster', 'Slot', 'On air', 'Stream', '']}
          empty={!matches.length && <Empty icon={<Tv className="h-5 w-5" />} title="No fixtures yet" />}>
          {matches.map((m: any) => (
            <tr key={m.id} className={cx(m.clashWith.length > 0 && 'bg-amber-50/60')}>
              <td className="td">{isStaff && <input type="checkbox" checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} aria-label={`Select match ${m.number}`} />}</td>
              <td className="td">{m.number}</td>
              <td className="td font-medium text-ink-900">{fixture(m)}<span className="block text-xs font-normal text-ink-500">{m.stage}{m.venue ? ` · ${m.venue.name}` : ''}</span></td>
              <td className="td">{when(m.startsAt)}</td>
              <td className="td">{m.broadcaster ?? <span className="text-ink-400">—</span>}{m.clashWith.length > 0 && <span className="block text-xs font-semibold text-amber-700">clashes with M{m.clashWith.join(', M')}</span>}</td>
              <td className="td">{m.tvSlot ?? '—'}</td>
              <td className="td text-xs">{m.onAirAt ? `${when(m.onAirAt)} – ${m.offAirAt ? new Date(m.offAirAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''}` : '—'}</td>
              <td className="td text-xs">{m.streamUrl ? <a href={m.streamUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">link</a> : '—'}</td>
              <td className="td text-right">{isStaff && <Button size="sm" variant="secondary" onClick={() => setEdit({ ...m, onAirAt: dtInput(m.onAirAt), offAirAt: dtInput(m.offAirAt) })}>Edit</Button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="mt-3 text-xs text-ink-500">Download the schedule for your broadcaster from Reports → Broadcast Schedule (Excel / PDF / CSV).</p>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Broadcast — Match ${edit.number}` : ''} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        {edit && <div className="grid gap-3 sm:grid-cols-2">
          <ErrorText error={save.error} />
          <Field label="Broadcaster / OTT"><Input value={edit.broadcaster ?? ''} onChange={(e) => setEdit({ ...edit, broadcaster: e.target.value })} /></Field>
          <Field label="Slot"><Input value={edit.tvSlot ?? ''} placeholder="Prime time" onChange={(e) => setEdit({ ...edit, tvSlot: e.target.value })} /></Field>
          <Field label="On air"><Input type="datetime-local" value={edit.onAirAt} onChange={(e) => setEdit({ ...edit, onAirAt: e.target.value })} /></Field>
          <Field label="Off air"><Input type="datetime-local" value={edit.offAirAt} onChange={(e) => setEdit({ ...edit, offAirAt: e.target.value })} /></Field>
          <Field label="Stream link" className="sm:col-span-2"><Input value={edit.streamUrl ?? ''} placeholder="https://" onChange={(e) => setEdit({ ...edit, streamUrl: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!bulk} onClose={() => setBulk(null)} title={`Assign ${picked.length} match${picked.length === 1 ? '' : 'es'}`} footer={<><Button variant="secondary" onClick={() => setBulk(null)}>Cancel</Button><Button disabled={!bulk?.broadcaster} loading={assign.isPending} onClick={() => assign.mutate()}>Assign</Button></>}>
        {bulk && <div className="grid gap-3 sm:grid-cols-2">
          <ErrorText error={assign.error} />
          <Field label="Broadcaster / OTT"><Input value={bulk.broadcaster} onChange={(e) => setBulk({ ...bulk, broadcaster: e.target.value })} /></Field>
          <Field label="Slot name"><Input value={bulk.tvSlot} onChange={(e) => setBulk({ ...bulk, tvSlot: e.target.value })} /></Field>
          <Field label="Pre-show (minutes before first ball)"><Input type="number" value={bulk.preShowMinutes} onChange={(e) => setBulk({ ...bulk, preShowMinutes: Number(e.target.value) })} /></Field>
          <Field label="Window length (hours)"><Input type="number" value={bulk.durationHours} onChange={(e) => setBulk({ ...bulk, durationHours: Number(e.target.value) })} /></Field>
        </div>}
      </Modal>
    </>
  );
}
