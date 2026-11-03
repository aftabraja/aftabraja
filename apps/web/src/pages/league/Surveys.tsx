import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Mail, Plus, Smile } from 'lucide-react';
import { get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, cx } from '../../components/ui';

const AUD: Record<string, string> = { FANS: 'Fans', PLAYERS: 'Players', TEAMS: 'Team owners', SPONSORS: 'Sponsors', VENDORS: 'Vendors', STAFF: 'Staff' };
const npsColor = (n: number | null) => (n == null ? 'text-ink-400' : n >= 30 ? 'text-emerald-600' : n >= 0 ? 'text-amber-600' : 'text-red-600');

export default function Surveys() {
  const { leagueId } = useLeague();
  const list = useQuery({ queryKey: ['surveys', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/surveys`) });
  const matches = useQuery({ queryKey: ['matches', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/matches`) });
  const [f, setF] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/surveys`, { ...f, matchId: f.matchId || null, question: f.question || undefined }), onSuccess: (s: any) => { setF(null); list.refetch(); setOpen(s.id); } });
  const all = list.data ?? [];
  const fans = all.filter((s) => s.audience === 'FANS');
  const overall = fans.reduce((a, s) => a + s.nps.responses, 0);
  return (
    <>
      <PageHeader title="Fan Surveys (NPS)" subtitle="Ask fans, players, team owners and sponsors one question — how likely are they to recommend you — and track your Net Promoter Score match by match."
        actions={<Button onClick={() => setF({ title: '', audience: 'FANS', matchId: '', question: '' })}><Plus className="h-4 w-4" />New survey</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Surveys" value={all.length} />
        <Stat label="Fan responses" value={overall} />
        <Stat label="Latest fan NPS" value={fans[0]?.nps.score ?? '—'} sub="−100 to +100 · above 30 is good" />
      </div>
      <Card padded={false}>
        {list.isLoading ? <Spinner /> : (
          <Table head={['Survey', 'Audience', 'Responses', 'NPS', 'Promoters / detractors', 'Created', '']} empty={!all.length && <Empty icon={<Smile className="h-5 w-5" />} title="No surveys yet" text="Create a fan survey after a match and email it to everyone who bought a ticket." />}>
            {all.map((s) => (
              <tr key={s.id}>
                <td className="td"><button onClick={() => setOpen(s.id)} className="font-medium text-ink-900 hover:text-brand-700">{s.title}</button>{!s.active && <Badge className="ml-2">closed</Badge>}</td>
                <td className="td">{AUD[s.audience]}</td>
                <td className="td">{s.nps.responses}</td>
                <td className={cx('td text-lg font-bold', npsColor(s.nps.score))}>{s.nps.score ?? '—'}</td>
                <td className="td text-xs">{s.nps.responses ? `${s.nps.promoters}% / ${s.nps.detractors}%` : '—'}</td>
                <td className="td">{date(s.createdAt)}</td>
                <td className="td text-right"><Button size="sm" variant="secondary" onClick={() => setOpen(s.id)}>Results</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!f} onClose={() => setF(null)} title="New NPS survey" footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button disabled={!f?.title || f.title.length < 3} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        {f && <div className="grid gap-3">
          <ErrorText error={create.error} />
          <Field label="Title"><Input value={f.title} placeholder="Match 4 fan experience" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={Object.entries(AUD).map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Match (optional)"><Select value={f.matchId} onChange={(e) => setF({ ...f, matchId: e.target.value })} placeholder="Whole season" options={(matches.data ?? []).map((m) => ({ value: m.id, label: `M${m.number}: ${m.homeTeam?.shortName ?? m.homeLabel ?? 'TBD'} vs ${m.awayTeam?.shortName ?? m.awayLabel ?? 'TBD'}` }))} /></Field>
          </div>
          <Field label="Question" hint="Leave blank for the standard NPS question"><Input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder="How likely are you to recommend … to a friend?" /></Field>
        </div>}
      </Modal>
      {open && <SurveyResults id={open} onClose={() => { setOpen(null); list.refetch(); }} />}
    </>
  );
}

function SurveyResults({ id, onClose }: { id: string; onClose: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['survey', id], queryFn: () => get(`/leagues/${leagueId}/surveys/${id}`) });
  const send = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/surveys/${id}/send-to-ticket-buyers`, {}) });
  const close = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/surveys/${id}`, { active: !q.data.active }), onSuccess: () => q.refetch() });
  const [copied, setCopied] = useState(false);
  const s = q.data;
  const max = s ? Math.max(1, ...s.nps.distribution) : 1;
  return (
    <Modal open onClose={onClose} size="xl" title={s?.title ?? 'Survey'} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {!s ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{s.url}</span>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(s.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy link'}</Button>
            {s.audience === 'FANS' && <Button size="sm" loading={send.isPending} onClick={() => confirm('Email this survey to every ticket buyer?') && send.mutate()}><Mail className="h-3.5 w-3.5" />Email ticket buyers</Button>}
            <Button size="sm" variant="ghost" onClick={() => close.mutate()}>{s.active ? 'Close survey' : 'Reopen'}</Button>
          </div>
          {send.data && <p className="text-sm text-emerald-700">Sent to {send.data.sent} ticket buyer{send.data.sent === 1 ? '' : 's'}.</p>}
          <ErrorText error={send.error} />
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-ink-200 p-4 text-center"><p className={cx('text-4xl font-extrabold', npsColor(s.nps.score))}>{s.nps.score ?? '—'}</p><p className="text-xs text-ink-500">NPS · {s.nps.responses} responses</p></div>
            <div className="rounded-xl border border-ink-200 p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{s.nps.promoters}%</p><p className="text-xs text-ink-500">Promoters (9–10)</p></div>
            <div className="rounded-xl border border-ink-200 p-4 text-center"><p className="text-2xl font-bold text-amber-600">{s.nps.passives}%</p><p className="text-xs text-ink-500">Passives (7–8)</p></div>
            <div className="rounded-xl border border-ink-200 p-4 text-center"><p className="text-2xl font-bold text-red-600">{s.nps.detractors}%</p><p className="text-xs text-ink-500">Detractors (0–6)</p></div>
          </div>
          <div>
            <p className="label">Score distribution</p>
            <div className="flex h-32 items-end gap-1.5">
              {s.nps.distribution.map((n: number, k: number) => (
                <div key={k} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] text-ink-500">{n || ''}</span>
                  <div className={cx('w-full rounded-t', k >= 9 ? 'bg-emerald-500' : k >= 7 ? 'bg-amber-400' : 'bg-red-400')} style={{ height: `${(n / max) * 90}px`, minHeight: n ? 4 : 1 }} />
                  <span className="text-[11px] font-semibold">{k}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Comments</p>
            {!s.responses.filter((r: any) => r.comment).length ? <p className="text-sm text-ink-500">No comments yet.</p> : (
              <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
                {s.responses.filter((r: any) => r.comment).map((r: any) => (
                  <li key={r.id} className="flex gap-3 px-3 py-2.5 text-sm"><span className={cx('w-7 shrink-0 text-center font-bold', r.score >= 9 ? 'text-emerald-600' : r.score >= 7 ? 'text-amber-600' : 'text-red-600')}>{r.score}</span><div className="min-w-0"><p>{r.comment}</p><p className="text-xs text-ink-500">{r.name ?? 'Anonymous'} · {ago(r.createdAt)}</p></div></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
