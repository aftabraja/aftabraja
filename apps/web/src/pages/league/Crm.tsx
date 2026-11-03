import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, MessageSquare, Phone, Plus, Presentation, Trophy, Users, X } from 'lucide-react';
import { get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date, inr, inrShort } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, Tabs, cx } from '../../components/ui';
import { Comments } from '../../components/Comments';
import { Attachments, UploadButton } from './Procurement';

const STAGES = [
  { key: 'LEAD', label: 'Lead', color: 'bg-ink-400' }, { key: 'CONTACTED', label: 'Contacted', color: 'bg-brand-400' }, { key: 'PROPOSAL', label: 'Proposal sent', color: 'bg-brand-600' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-amber-500' }, { key: 'WON', label: 'Won', color: 'bg-emerald-500' }, { key: 'LOST', label: 'Lost', color: 'bg-red-400' },
];
const CHANNEL: Record<string, string> = { JERSEY: 'Jersey', ON_GROUND: 'On-ground', BROADCAST: 'Broadcast', DIGITAL: 'Digital', HOSPITALITY: 'Hospitality', OTHER: 'Other' };

export default function Crm() {
  const { leagueId } = useLeague();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pipeline' | 'deliverables'>('pipeline');
  const q = useQuery({ queryKey: ['crm', leagueId], queryFn: () => get(`/leagues/${leagueId}/crm`) });
  const [params] = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('deal'));
  const [add, setAdd] = useState(false);
  const move = useMutation({ mutationFn: ({ id, stage, lostReason }: any) => patch(`/leagues/${leagueId}/crm/deals/${id}`, { stage, lostReason }), onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', leagueId] }) });
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  return (
    <>
      <PageHeader title="Sponsor CRM" subtitle="Track every sponsor from first contact to signed deal — then deliver every promise with proof."
        actions={<><Link to={`/leagues/${leagueId}/sponsors`}><Button variant="secondary"><Users className="h-4 w-4" />Find sponsors</Button></Link><Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New deal</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open pipeline" value={inrShort(d.summary.pipeline)} sub={(() => { const n = d.deals.filter((x: any) => !["WON", "LOST"].includes(x.stage)).length; return `${n} deal${n === 1 ? "" : "s"}`; })()} />
        <Stat label="Weighted forecast" value={inrShort(d.summary.weighted)} sub="value × stage probability" />
        <Stat label="Won" value={inrShort(d.summary.won)} tone="green" />
        <Stat label="Win rate" value={d.summary.winRate != null ? `${d.summary.winRate}%` : '—'} sub="of closed deals" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pipeline', label: 'Pipeline' }, { value: 'deliverables', label: 'Deliverables' }]} />
      {tab === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => {
            const items = d.deals.filter((x: any) => x.stage === s.key);
            return (
              <div key={s.key} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-sm font-semibold"><span className={cx('h-2.5 w-2.5 rounded-full', s.color)} />{s.label}</span><span className="text-xs text-ink-500">{items.length} · {inrShort(items.reduce((a: number, x: any) => a + x.value, 0))}</span></div>
                <div className="min-h-[200px] space-y-2 rounded-xl bg-ink-50 p-2">
                  {items.map((x: any) => (
                    <div key={x.id} className="card cursor-pointer p-3 transition hover:border-brand-200" onClick={() => setOpen(x.id)}>
                      <p className="truncate font-semibold">{x.company}</p>
                      <p className="text-sm font-bold text-brand-700">{inr(x.value)}</p>
                      <p className="mt-1 truncate text-xs text-ink-500">{d.opportunities.find((o: any) => o.id === x.opportunityId)?.title ?? 'Custom package'}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400"><span>{x.ownerName ?? '—'}</span><span>{x.source === 'MARKETPLACE' ? 'via marketplace' : ago(x.updatedAt)}</span></div>
                      {x.progress != null && <div className="mt-2"><Progress value={x.progress} tone={x.progress === 100 ? 'green' : 'brand'} /><p className="mt-0.5 text-[11px] text-ink-500">{x.progress}% delivered</p></div>}
                      {!['WON', 'LOST'].includes(x.stage) && (
                        <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {(() => { const i = STAGES.findIndex((z) => z.key === x.stage); const nx = STAGES[i + 1]; return nx && nx.key !== 'WON' ? <button className="rounded border border-ink-200 px-2 py-0.5 text-[11px] font-semibold hover:bg-ink-50" onClick={() => move.mutate({ id: x.id, stage: nx.key })}>→ {nx.label}</button> : null; })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'deliverables' && <Deliverables leagueId={leagueId} />}
      {open && <DealDrawer leagueId={leagueId} id={open} owners={d.owners} opportunities={d.opportunities} onClose={() => { setOpen(null); qc.invalidateQueries({ queryKey: ['crm', leagueId] }); }} />}
      {add && <NewDeal leagueId={leagueId} owners={d.owners} opportunities={d.opportunities} onClose={() => { setAdd(false); qc.invalidateQueries({ queryKey: ['crm', leagueId] }); }} />}
    </>
  );
}

function NewDeal({ leagueId, owners, opportunities, onClose }: { leagueId: string; owners: any[]; opportunities: any[]; onClose: () => void }) {
  const sponsors = useQuery({ queryKey: ['sponsors', ''], queryFn: () => get<any[]>('/sponsors') });
  const [f, setF] = useState<any>({ company: '', contactName: '', email: '', phone: '', opportunityId: '', value: '', expectedClose: '', ownerId: owners[0]?.id, stage: 'LEAD', sponsorUserId: '' });
  const save = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/crm/deals`, { ...f, value: f.value || 0, opportunityId: f.opportunityId || null, expectedClose: f.expectedClose || null, sponsorUserId: f.sponsorUserId || null }), onSuccess: onClose });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title="New sponsor deal" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.company} onClick={() => save.mutate()}>Create deal</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><ErrorText error={save.error} /></div>
        <Field label="Sponsor on SportsIQ (optional)" className="col-span-2"><Select value={f.sponsorUserId} onChange={(e) => { const sp = sponsors.data?.find((x) => x.user.id === e.target.value); setF({ ...f, sponsorUserId: e.target.value, company: sp?.companyName ?? f.company, contactName: sp?.user.name ?? f.contactName, email: sp?.user.email ?? f.email }); }} placeholder="— not on SportsIQ —" options={(sponsors.data ?? []).map((x) => ({ value: x.user.id, label: x.companyName }))} /></Field>
        <Field label="Company"><Input value={f.company} onChange={set('company')} /></Field>
        <Field label="Contact person"><Input value={f.contactName} onChange={set('contactName')} /></Field>
        <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Package" className="col-span-2"><Select value={f.opportunityId} onChange={(e) => { const o = opportunities.find((x) => x.id === e.target.value); setF({ ...f, opportunityId: e.target.value, value: o?.price ?? f.value }); }} placeholder="Custom package" options={opportunities.filter((o) => o.status !== 'SOLD').map((o) => ({ value: o.id, label: `${o.title} — ${inrShort(o.price)}` }))} /></Field>
        <Field label="Deal value (₹)"><Input type="number" value={f.value} onChange={set('value')} /></Field>
        <Field label="Expected close"><Input type="date" value={f.expectedClose} onChange={set('expectedClose')} /></Field>
        <Field label="Stage"><Select value={f.stage} onChange={set('stage')} options={STAGES.filter((s) => !['WON', 'LOST'].includes(s.key)).map((s) => ({ value: s.key, label: s.label }))} /></Field>
        <Field label="Owner"><Select value={f.ownerId} onChange={set('ownerId')} options={owners.map((o) => ({ value: o.id, label: o.name }))} /></Field>
      </div>
    </Modal>
  );
}

function DealDrawer({ leagueId, id, owners, opportunities, onClose }: { leagueId: string; id: string; owners: any[]; opportunities: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const key = ['deal', id];
  const q = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/crm/deals/${id}`) });
  const [act, setAct] = useState({ kind: 'NOTE', body: '' });
  const [win, setWin] = useState<any>(null);
  const [lost, setLost] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const addAct = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/crm/deals/${id}/activities`, act), onSuccess: () => { setAct({ ...act, body: '' }); refresh(); } });
  const upd = useMutation({ mutationFn: (b: any) => patch(`/leagues/${leagueId}/crm/deals/${id}`, b), onSuccess: () => { setLost(null); refresh(); } });
  const doc = useMutation({ mutationFn: (kind: string) => post(`/leagues/${leagueId}/crm/deals/${id}/documents`, { kind }), onSuccess: (r) => nav(r.deckId ? `/leagues/${leagueId}/decks/${r.deckId}` : `/leagues/${leagueId}/contracts/${r.contractId}`) });
  const won = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/crm/deals/${id}/win`, win), onSuccess: () => { setWin(null); refresh(); } });
  if (q.isLoading) return null;
  const d = q.data;
  const opp = opportunities.find((o) => o.id === d.opportunityId);
  const icon: Record<string, any> = { CALL: Phone, EMAIL: MessageSquare, MEETING: Users, DOCUMENT: FileText, STAGE: Trophy, NOTE: MessageSquare };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-6 py-4">
          <div><p className="text-lg font-bold">{d.company}</p><p className="text-sm text-ink-500">{[d.contactName, d.email, d.phone].filter(Boolean).join(' · ')}</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          <ErrorText error={upd.error || doc.error || won.error} />
          <div className="flex flex-wrap gap-1">{STAGES.map((s) => (
            <button key={s.key} disabled={d.stage === 'WON' || s.key === 'WON'} onClick={() => (s.key === 'LOST' ? setLost('') : upd.mutate({ stage: s.key }))}
              className={cx('rounded-full px-3 py-1 text-xs font-semibold', d.stage === s.key ? `${s.color} text-white` : 'bg-ink-100 text-ink-600 hover:bg-ink-200 disabled:opacity-40')}>{s.label}</button>
          ))}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value (₹)"><Input type="number" defaultValue={d.value} onBlur={(e) => Number(e.target.value) !== d.value && upd.mutate({ value: e.target.value })} disabled={d.stage === 'WON'} /></Field>
            <Field label="Expected close"><Input type="date" defaultValue={d.expectedClose?.slice(0, 10) ?? ''} onBlur={(e) => upd.mutate({ expectedClose: e.target.value || null })} /></Field>
            <Field label="Package"><Select value={d.opportunityId ?? ''} onChange={(e) => upd.mutate({ opportunityId: e.target.value || null })} placeholder="Custom" options={opportunities.map((o) => ({ value: o.id, label: o.title }))} /></Field>
            <Field label="Owner"><Select value={d.ownerId ?? ''} onChange={(e) => upd.mutate({ ownerId: e.target.value })} options={owners.map((o) => ({ value: o.id, label: o.name }))} /></Field>
          </div>
          {d.stage === 'LOST' && d.lostReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Lost: {d.lostReason}</p>}
          <div className="flex flex-wrap gap-2">
            {d.deckId ? <Link to={`/leagues/${leagueId}/decks/${d.deckId}`}><Button size="sm" variant="secondary"><Presentation className="h-3.5 w-3.5" />Open deck</Button></Link> : <Button size="sm" variant="secondary" loading={doc.isPending && doc.variables === 'DECK'} onClick={() => doc.mutate('DECK')}><Presentation className="h-3.5 w-3.5" />Create personalised deck</Button>}
            {d.contractId ? <Link to={`/leagues/${leagueId}/contracts/${d.contractId}`}><Button size="sm" variant="secondary"><FileText className="h-3.5 w-3.5" />Open agreement</Button></Link> : <Button size="sm" variant="secondary" loading={doc.isPending && doc.variables === 'CONTRACT'} onClick={() => doc.mutate('CONTRACT')}><FileText className="h-3.5 w-3.5" />Draft agreement</Button>}
            {d.conversationId && <Link to={`/messages/${d.conversationId}`}><Button size="sm" variant="secondary"><MessageSquare className="h-3.5 w-3.5" />Chat</Button></Link>}
            {!['WON', 'LOST'].includes(d.stage) && <Button size="sm" variant="success" onClick={() => setWin({ value: d.value, addReceivable: true, dueDate: '' })}><Trophy className="h-3.5 w-3.5" />Mark as won</Button>}
          </div>
          {d.stage === 'WON' && (
            <Card title={`Deliverables (${d.deliverables.length})`}>
              {!d.deliverables.length ? <p className="text-sm text-ink-500">No deliverables — add them on the Deliverables tab.</p> : <ul className="space-y-1.5 text-sm">{d.deliverables.map((x: any) => <li key={x.id} className="flex justify-between gap-2"><span>{x.title}</span><span className={cx('text-xs font-semibold', x.delivered >= x.quantity ? 'text-emerald-600' : 'text-ink-500')}>{x.delivered}/{x.quantity}</span></li>)}</ul>}
            </Card>
          )}
          <div>
            <p className="label">Log activity</p>
            <div className="flex gap-2"><select className="input w-32" value={act.kind} onChange={(e) => setAct({ ...act, kind: e.target.value })}>{['NOTE', 'CALL', 'EMAIL', 'MEETING'].map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}</select><Input value={act.body} onChange={(e) => setAct({ ...act, body: e.target.value })} placeholder="What happened? Next step?" /><Button loading={addAct.isPending} disabled={act.body.length < 2} onClick={() => addAct.mutate()}>Add</Button></div>
          </div>
          <ol className="space-y-3">
            {d.activities.map((a: any) => { const I = icon[a.kind] ?? MessageSquare; return (
              <li key={a.id} className="flex gap-3 text-sm"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600"><I className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="whitespace-pre-wrap">{a.body}</p><p className="text-xs text-ink-400">{a.authorName} · {a.kind.toLowerCase()} · {ago(a.createdAt)}</p></div></li>
            ); })}
          </ol>
          {opp && <p className="text-xs text-ink-500">Package: {opp.title} · list price {inr(opp.price)}</p>}
          <Comments leagueId={leagueId} type="SponsorDeal" id={id} title="Team discussion" />
        </div>
      </div>
      <Modal open={!!win} onClose={() => setWin(null)} title={`Close ${d.company} as won`} footer={<><Button variant="secondary" onClick={() => setWin(null)}>Cancel</Button><Button variant="success" loading={won.isPending} onClick={() => won.mutate()}>Mark as won</Button></>}>
        {win && <div className="space-y-3">
          <Field label="Final value (₹)"><Input type="number" value={win.value} onChange={(e) => setWin({ ...win, value: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={win.addReceivable} onChange={(e) => setWin({ ...win, addReceivable: e.target.checked })} />Add to Finance as a sponsorship receivable</label>
          {win.addReceivable && <Field label="Payment due"><Input type="date" value={win.dueDate} onChange={(e) => setWin({ ...win, dueDate: e.target.value })} /></Field>}
          <p className="text-xs text-ink-500">{opp ? `The ${opp.title} package is marked sold and its deliverables are created for tracking.` : 'Add deliverables on the Deliverables tab.'}</p>
        </div>}
      </Modal>
      <Modal open={lost !== null} onClose={() => setLost(null)} title="Mark as lost" footer={<><Button variant="secondary" onClick={() => setLost(null)}>Cancel</Button><Button variant="danger" disabled={!lost} onClick={() => upd.mutate({ stage: 'LOST', lostReason: lost })}>Mark lost</Button></>}>
        <Field label="Why was it lost?"><Select value={lost ?? ''} onChange={(e) => setLost(e.target.value)} placeholder="Select reason" options={['Budget', 'Timing', 'Chose another property', 'No response', 'Category conflict', 'Other']} /></Field>
      </Modal>
    </div>
  );
}

function Deliverables({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['deliverables', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/crm/deliverables`) });
  const upd = useMutation({ mutationFn: ({ id, ...b }: any) => patch(`/leagues/${leagueId}/crm/deliverables/${id}`, b), onSuccess: () => qc.invalidateQueries({ queryKey: ['deliverables', leagueId] }) });
  const add = useMutation({ mutationFn: ({ dealId, title }: any) => post(`/leagues/${leagueId}/crm/deals/${dealId}/deliverables`, { title }), onSuccess: () => qc.invalidateQueries({ queryKey: ['deliverables', leagueId] }) });
  const [newTitle, setNewTitle] = useState<Record<string, string>>({});
  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <Card><Empty icon={<CheckCircle2 className="h-5 w-5" />} title="No won deals yet" text="When you mark a deal as won, the package's deliverables appear here for tracking with proof." /></Card>;
  return (
    <div className="space-y-6">
      <ErrorText error={upd.error} />
      {q.data.map((deal) => {
        const tot = deal.deliverables.reduce((s: number, x: any) => s + x.quantity, 0);
        const done = deal.deliverables.reduce((s: number, x: any) => s + Math.min(x.delivered, x.quantity), 0);
        return (
          <Card key={deal.id} padded={false} title={<span>{deal.company} <span className="font-normal text-ink-500">· {inr(deal.value)}</span></span>} action={<span className="flex w-48 items-center gap-2 text-xs"><Progress value={tot ? (done / tot) * 100 : 0} tone={done === tot && tot ? 'green' : 'brand'} />{tot ? Math.round((done / tot) * 100) : 0}%</span>}>
            <ul className="divide-y divide-ink-100">
              {deal.deliverables.map((x: any) => {
                const complete = x.delivered >= x.quantity;
                return (
                  <li key={x.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cx('flex h-6 w-6 items-center justify-center rounded-full', complete ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-400')}><CheckCircle2 className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="font-medium">{x.title}</span> <Badge className="ml-1">{CHANNEL[x.channel]}</Badge>{x.dueDate && <span className="ml-2 text-xs text-ink-500">due {date(x.dueDate)}</span>}</span>
                      <div className="flex items-center gap-1 text-sm">
                        <button className="h-7 w-7 rounded border border-ink-200 hover:bg-ink-50 disabled:opacity-40" disabled={x.delivered <= 0} onClick={() => upd.mutate({ id: x.id, delivered: x.delivered - 1 })}>−</button>
                        <span className="w-12 text-center font-semibold">{x.delivered}/{x.quantity}</span>
                        <button className="h-7 w-7 rounded border border-ink-200 hover:bg-ink-50 disabled:opacity-40" disabled={complete} onClick={() => upd.mutate({ id: x.id, delivered: x.delivered + 1 })}>+</button>
                      </div>
                      <UploadButton label="Proof" onAdd={(a) => upd.mutate({ id: x.id, addProofs: a })} />
                    </div>
                    <div className="pl-9"><Attachments urls={x.proofs} /></div>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2 border-t border-ink-100 p-3"><Input value={newTitle[deal.id] ?? ''} onChange={(e) => setNewTitle({ ...newTitle, [deal.id]: e.target.value })} placeholder="Add a deliverable, e.g. 5 Instagram reels" /><Button variant="secondary" disabled={!newTitle[deal.id]} onClick={() => { add.mutate({ dealId: deal.id, title: newTitle[deal.id] }); setNewTitle({ ...newTitle, [deal.id]: '' }); }}>Add</Button></div>
          </Card>
        );
      })}
      <p className="text-xs text-ink-500">A deliverable can only be marked complete once proof is attached. Sponsors on SportsIQ see progress and proof on their dashboard.</p>
    </div>
  );
}

/** Sponsor's own dashboard */
export function SponsorDeals() {
  const q = useQuery({ queryKey: ['my-deals'], queryFn: () => get<any[]>('/sponsor-portal/deals') });
  if (q.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader title="My Sponsorships" subtitle="Every deliverable the league promised you, with live progress and proof." />
      {!q.data?.length ? <Card><Empty icon={<Trophy className="h-5 w-5" />} title="No confirmed sponsorships yet" text="Once a league confirms your deal, deliverables and proof appear here." /></Card> : (
        <div className="space-y-6">
          {q.data.map((d) => {
            const tot = d.deliverables.reduce((s: number, x: any) => s + x.quantity, 0);
            const done = d.deliverables.reduce((s: number, x: any) => s + Math.min(x.delivered, x.quantity), 0);
            const st = (x: any) => (x.delivered >= x.quantity ? ['Completed', 'green'] : x.delivered > 0 ? ['In progress', 'amber'] : ['Pending', 'gray']);
            return (
              <Card key={d.id} title={<span>{d.league?.name} <span className="font-normal text-ink-500">· {inr(d.value)}</span></span>} action={<span className="flex w-48 items-center gap-2 text-xs"><Progress value={tot ? (done / tot) * 100 : 0} tone="green" />{tot ? Math.round((done / tot) * 100) : 0}%</span>} padded={false}>
                <div className="grid grid-cols-3 gap-px border-b border-ink-100 bg-ink-100 text-center text-sm">
                  {(['Completed', 'In progress', 'Pending'] as const).map((l) => <div key={l} className="bg-white p-3"><p className="text-xl font-bold">{d.deliverables.filter((x: any) => st(x)[0] === l).length}</p><p className="text-xs text-ink-500">{l}</p></div>)}
                </div>
                <ul className="divide-y divide-ink-100">{d.deliverables.map((x: any) => (
                  <li key={x.id} className="px-5 py-3 text-sm"><div className="flex items-center justify-between gap-3"><span>{x.title}</span><span className="flex items-center gap-2"><span className="text-xs text-ink-500">{x.delivered}/{x.quantity}</span><Badge color={st(x)[1]}>{st(x)[0]}</Badge></span></div><Attachments urls={x.proofs} /></li>
                ))}</ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
