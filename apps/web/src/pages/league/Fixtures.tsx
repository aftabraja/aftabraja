import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ExternalLink, MapPin, Pencil, Plus, Radio, Send, Trash2, Trophy, Wand2 } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, cx } from '../../components/ui';
import { StandingsTable } from '../../components/Scorecard';

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const toLocalInput = (d?: string | null) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Fixtures() {
  const { leagueId, league, isStaff } = useLeague();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'fixtures' | 'table' | 'venues'>('fixtures');
  const [gen, setGen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const matches = useQuery({ queryKey: ['matches', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/matches`) });
  const table = useQuery({ queryKey: ['standings', leagueId], queryFn: () => get(`/leagues/${leagueId}/standings`), enabled: tab === 'table' });
  const venues = useQuery({ queryKey: ['venues', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/venues`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['matches', leagueId] }); qc.invalidateQueries({ queryKey: ['standings', leagueId] }); };
  const publish = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/matches/publish`), onSuccess: refresh });
  const seed = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/schedule/seed-playoffs`), onSuccess: refresh });

  const byDay = useMemo(() => {
    const g = new Map<string, any[]>();
    (matches.data ?? []).forEach((m) => { const k = m.startsAt ? new Date(m.startsAt).toDateString() : 'TBA'; g.set(k, [...(g.get(k) ?? []), m]); });
    return [...g.entries()];
  }, [matches.data]);
  const unpublished = matches.data?.some((m) => !m.isPublished);
  const live = matches.data?.filter((m) => m.status === 'LIVE') ?? [];

  return (
    <>
      <PageHeader title="Fixtures & Results" subtitle="Auto-generate a fair schedule, score every match ball by ball, and keep the points table live."
        actions={isStaff && <>
          {league && <a href={`/l/${league.slug}`} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" />Public match centre</Button></a>}
          {unpublished && <Button variant="secondary" loading={publish.isPending} onClick={() => publish.mutate()}><Send className="h-4 w-4" />Publish schedule</Button>}
          <Button variant="secondary" onClick={() => setEdit({})}><Plus className="h-4 w-4" />Add match</Button>
          <Button onClick={() => setGen(true)}><Wand2 className="h-4 w-4" />Auto-generate</Button>
        </>} />
      {live.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {live.map((m) => (
            <Link key={m.id} to={`/leagues/${leagueId}/matches/${m.id}`} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100">
              <Radio className="h-5 w-5 animate-pulse text-red-600" /><span className="font-semibold">LIVE · Match {m.number}: {m.homeTeam?.name} vs {m.awayTeam?.name}</span><span className="ml-auto text-sm font-semibold text-red-700">{isStaff ? 'Open scorer →' : 'Watch →'}</span>
            </Link>
          ))}
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'fixtures', label: `Fixtures (${matches.data?.length ?? 0})` }, { value: 'table', label: 'Points table' }, { value: 'venues', label: `Venues (${venues.data?.length ?? 0})` }]} />

      {tab === 'fixtures' && (matches.isLoading ? <Spinner /> : !matches.data?.length ? (
        <Card><Empty icon={<CalendarPlus className="h-5 w-5" />} title="No fixtures yet" text="Add your venues, then let SportsIQ build a round-robin schedule with rest days and playoffs." action={isStaff && <Button onClick={() => setGen(true)}><Wand2 className="h-4 w-4" />Auto-generate schedule</Button>} /></Card>
      ) : (
        <div className="space-y-6">
          {isStaff && matches.data.some((m) => m.stage !== 'League' && (!m.homeTeamId || !m.awayTeamId)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm">
              <span><Trophy className="mr-2 inline h-4 w-4 text-amber-500" />When the league stage ends, fill the playoff slots from the points table. Later rounds fill automatically as results come in.</span>
              <Button size="sm" variant="secondary" loading={seed.isPending} onClick={() => seed.mutate()}>Seed playoffs from table</Button>
            </div>
          )}
          {byDay.map(([day, ms]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">{day === 'TBA' ? 'Date TBA' : fmtDay(ms[0].startsAt)}</p>
              <div className="card divide-y divide-ink-100">
                {ms.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="w-20 text-sm"><p className="font-semibold">{m.startsAt ? fmtTime(m.startsAt) : '—'}</p><p className="text-xs text-ink-500">Match {m.number}</p></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TeamChip t={m.homeTeam} label={m.homeLabel} winner={m.winnerTeamId === m.homeTeamId} />
                        <span className="text-xs font-semibold text-ink-400">vs</span>
                        <TeamChip t={m.awayTeam} label={m.awayLabel} winner={m.winnerTeamId === m.awayTeamId} />
                        {m.stage !== 'League' && <Badge color="violet">{m.stage}</Badge>}
                        {!m.isPublished && <Badge>Draft</Badge>}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">{m.venue && <><MapPin className="h-3 w-3" />{m.venue.name} · </>}{m.oversPerSide ?? 20} overs{m.resultText && <span className="ml-2 font-semibold text-emerald-700">{m.resultText}</span>}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === 'LIVE' && <Badge color="red">LIVE</Badge>}
                      <Link to={`/leagues/${leagueId}/matches/${m.id}`}><Button size="sm" variant={m.status === 'SCHEDULED' && isStaff ? 'primary' : 'secondary'}>{m.status === 'SCHEDULED' ? (isStaff ? 'Start scoring' : 'Preview') : m.status === 'LIVE' ? (isStaff ? 'Score' : 'Live') : 'Scorecard'}</Button></Link>
                      {isStaff && m.status === 'SCHEDULED' && <button onClick={() => setEdit(m)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'table' && <Card padded={false}>{table.isLoading ? <Spinner /> : <StandingsTable rows={table.data.rows} />}</Card>}
      {tab === 'venues' && <Venues leagueId={leagueId} venues={venues.data ?? []} canEdit={isStaff} />}

      {gen && <GenerateModal leagueId={leagueId} venues={venues.data ?? []} hasMatches={!!matches.data?.length} defaultStart={league?.startDate} onClose={() => { setGen(false); refresh(); }} />}
      {edit && <MatchModal leagueId={leagueId} match={edit} venues={venues.data ?? []} onClose={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function TeamChip({ t, label, winner }: { t: any; label?: string | null; winner?: boolean }) {
  return <span className={cx('flex items-center gap-2 font-semibold', winner && 'text-emerald-700')}>{t ? <><Avatar name={t.name} src={t.logoUrl} size={26} />{t.name}</> : <span className="rounded-md border border-dashed border-ink-300 px-2 py-0.5 text-sm font-medium text-ink-500">{label ?? 'TBD'}</span>}</span>;
}

function Venues({ leagueId, venues, canEdit }: { leagueId: string; venues: any[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', city: '', capacity: '' });
  const add = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/venues`, { ...f, capacity: f.capacity || null }), onSuccess: () => { setF({ name: '', city: '', capacity: '' }); qc.invalidateQueries({ queryKey: ['venues', leagueId] }); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/venues/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', leagueId] }) });
  return (
    <Card>
      {canEdit && (
        <div className="mb-5 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Venue name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
          <Button disabled={!f.name} loading={add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" />Add</Button>
        </div>
      )}
      {!venues.length ? <Empty icon={<MapPin className="h-5 w-5" />} title="No venues yet" text="Book grounds from the vendor marketplace, then add them here." /> : (
        <ul className="divide-y divide-ink-100">{venues.map((v) => <li key={v.id} className="flex items-center justify-between py-3"><span><span className="font-medium">{v.name}</span><span className="ml-2 text-sm text-ink-500">{[v.city, v.capacity && `${v.capacity.toLocaleString('en-IN')} seats`].filter(Boolean).join(' · ')}</span></span>{canEdit && <button onClick={() => remove.mutate(v.id)} className="text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}</li>)}</ul>
      )}
    </Card>
  );
}

function GenerateModal({ leagueId, venues, hasMatches, defaultStart, onClose }: { leagueId: string; venues: any[]; hasMatches: boolean; defaultStart?: string; onClose: () => void }) {
  const [f, setF] = useState({ startDate: (defaultStart ?? new Date().toISOString()).slice(0, 10), times: '16:00, 20:00', rounds: '1', restDays: '1', oversPerSide: '20', playoffs: 'IPL', restDaysBeforePlayoffs: '1', venueIds: venues.map((v) => v.id) as string[] });
  const gen = useMutation({
    mutationFn: () => post(`/leagues/${leagueId}/schedule/generate`, { ...f, times: f.times.split(',').map((t) => t.trim()).filter(Boolean), replace: true }),
    onSuccess: (r) => { alert(`Created ${r.created} matches (${r.leagueMatches} league matches over ${r.days} days). Review, then publish.`); onClose(); },
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} size="lg" title="Auto-generate schedule" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={gen.isPending} onClick={() => gen.mutate()}><Wand2 className="h-4 w-4" />Generate</Button></>}>
      <div className="space-y-4">
        <ErrorText error={gen.error} />
        {hasMatches && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This replaces the current schedule (only allowed before any match has started).</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="First match day"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Match start times" hint="Comma separated, 24h"><Input value={f.times} onChange={set('times')} /></Field>
          <Field label="Overs per side"><Input type="number" value={f.oversPerSide} onChange={set('oversPerSide')} /></Field>
          <Field label="Format"><Select value={f.rounds} onChange={set('rounds')} options={[{ value: '1', label: 'Single round-robin' }, { value: '2', label: 'Double round-robin (home & away)' }]} /></Field>
          <Field label="Min rest days between a team's games"><Input type="number" min={0} max={5} value={f.restDays} onChange={set('restDays')} /></Field>
          <Field label="Playoffs"><Select value={f.playoffs} onChange={set('playoffs')} options={[{ value: 'IPL', label: 'Q1, Eliminator, Q2, Final' }, { value: 'SEMIS', label: 'Semi-finals + Final' }, { value: 'FINAL', label: 'Final only (top 2)' }, { value: 'NONE', label: 'No playoffs' }]} /></Field>
        </div>
        <div>
          <p className="label">Venues (rotated)</p>
          {!venues.length ? <p className="text-sm text-ink-500">No venues yet — you can add them on the Venues tab and assign later.</p> : (
            <div className="flex flex-wrap gap-2">{venues.map((v) => (
              <label key={v.id} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm', f.venueIds.includes(v.id) ? 'border-brand-600 bg-brand-50' : 'border-ink-200')}>
                <input type="checkbox" checked={f.venueIds.includes(v.id)} onChange={(e) => setF({ ...f, venueIds: e.target.checked ? [...f.venueIds, v.id] : f.venueIds.filter((x) => x !== v.id) })} />{v.name}
              </label>
            ))}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MatchModal({ leagueId, match, venues, onClose }: { leagueId: string; match: any; venues: any[]; onClose: () => void }) {
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const [f, setF] = useState({ stage: match.stage ?? 'League', homeTeamId: match.homeTeamId ?? '', awayTeamId: match.awayTeamId ?? '', venueId: match.venueId ?? '', startsAt: toLocalInput(match.startsAt), oversPerSide: match.oversPerSide ?? 20 });
  const save = useMutation({
    mutationFn: () => { const b = { ...f, homeTeamId: f.homeTeamId || null, awayTeamId: f.awayTeamId || null, venueId: f.venueId || null, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null }; return match.id ? patch(`/leagues/${leagueId}/matches/${match.id}`, b) : post(`/leagues/${leagueId}/matches`, b); },
    onSuccess: onClose,
  });
  const remove = useMutation({ mutationFn: () => del(`/leagues/${leagueId}/matches/${match.id}`), onSuccess: onClose });
  const opts = (teams.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={match.id ? `Edit match ${match.number}` : 'Add match'} footer={<>{match.id && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => confirm('Delete match?') && remove.mutate()}>Delete</Button>}<Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><ErrorText error={save.error} /></div>
        <Field label={match.homeLabel ? `Home (${match.homeLabel})` : 'Home team'}><Select value={f.homeTeamId} onChange={set('homeTeamId')} placeholder="TBD" options={opts} /></Field>
        <Field label={match.awayLabel ? `Away (${match.awayLabel})` : 'Away team'}><Select value={f.awayTeamId} onChange={set('awayTeamId')} placeholder="TBD" options={opts} /></Field>
        <Field label="Date & time"><Input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></Field>
        <Field label="Venue"><Select value={f.venueId} onChange={set('venueId')} placeholder="—" options={venues.map((v) => ({ value: v.id, label: v.name }))} /></Field>
        <Field label="Stage"><Select value={f.stage} onChange={set('stage')} options={['League', 'Qualifier 1', 'Eliminator', 'Qualifier 2', 'Semi-final 1', 'Semi-final 2', 'Final']} /></Field>
        <Field label="Overs per side"><Input type="number" value={f.oversPerSide} onChange={set('oversPerSide')} /></Field>
      </div>
    </Modal>
  );
}
