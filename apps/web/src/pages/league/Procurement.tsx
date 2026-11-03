import { useEffect, useState } from 'react';
import { ComplianceBadge } from '../../components/ComplianceBadge';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardList, FileText, Paperclip, Plus, Send, Star, Trophy } from 'lucide-react';
import { get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date, fileToDataUrl, inr, inrShort } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Tabs, Textarea, cx } from '../../components/ui';
import { Comments } from '../../components/Comments';
import { useCategories } from '../../components/VendorPanel';

export const WO_STATUS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Not started', color: 'gray' }, IN_PROGRESS: { label: 'In progress', color: 'blue' }, UNDER_REVIEW: { label: 'Under review', color: 'amber' },
  COMPLETED: { label: 'Completed', color: 'green' }, CANCELLED: { label: 'Cancelled', color: 'red' },
};
const RFQ_COLOR: Record<string, string> = { OPEN: 'blue', AWARDED: 'green', CLOSED: 'gray', CANCELLED: 'red' };

export function Attachments({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u, i) => /\.(png|jpe?g|webp|gif|svg)$/i.test(u)
        ? <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-20 w-20 rounded-lg border border-ink-200 object-cover" /></a>
        : <a key={i} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-xs hover:bg-ink-50"><Paperclip className="h-3 w-3" />File {i + 1}</a>)}
    </div>
  );
}

export function UploadButton({ onAdd, label = 'Attach files' }: { onAdd: (dataUrls: string[]) => void; label?: string }) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-xs font-semibold hover:bg-ink-50">
      <Paperclip className="h-3.5 w-3.5" />{label}
      <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
        const files = [...(e.target.files ?? [])];
        if (files.some((f) => f.size > 5e6)) return alert('Each file must be under 5 MB');
        onAdd(await Promise.all(files.map(fileToDataUrl)));
        e.target.value = '';
      }} />
    </label>
  );
}

export default function Procurement() {
  const { leagueId } = useLeague();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'rfqs' | 'work'>(params.get('tab') === 'work' ? 'work' : 'rfqs');
  const [newRfq, setNewRfq] = useState<{ category?: string; vendor?: string } | null>(params.get('new') ? { category: params.get('category') ?? undefined, vendor: params.get('vendor') ?? undefined } : null);
  const rfqs = useQuery({ queryKey: ['rfqs', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/procurement/rfqs`) });
  const wos = useQuery({ queryKey: ['work-orders', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/procurement/work-orders`) });
  const cats = useCategories();
  const catName = (slug: string) => cats.data?.categories.find((c) => c.slug === slug)?.name ?? slug;
  const overdue = wos.data?.filter((w) => w.overdue).length ?? 0;
  const review = wos.data?.filter((w) => w.status === 'UNDER_REVIEW').length ?? 0;

  return (
    <>
      <PageHeader title="Procurement" subtitle="Request quotes from several vendors, compare them side by side, award work orders and track delivery with proofs."
        actions={<Button onClick={() => setNewRfq({})}><Plus className="h-4 w-4" />Request quotes</Button>} />
      {(overdue > 0 || review > 0) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {overdue > 0 && <button onClick={() => setTab('work')} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{overdue} work order{overdue > 1 ? 's' : ''} overdue</button>}
          {review > 0 && <button onClick={() => setTab('work')} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"><ClipboardList className="h-4 w-4" />{review} waiting for your review</button>}
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'rfqs', label: `Requests for quote (${rfqs.data?.length ?? 0})` }, { value: 'work', label: `Work orders (${wos.data?.length ?? 0})` }]} />
      {tab === 'rfqs' && (
        <Card padded={false}>
          {rfqs.isLoading ? <Spinner /> : (
            <Table head={['RFQ', 'Category', 'Needed by', 'Budget', 'Invited', 'Quotes', 'Lowest', 'Status', '']} empty={!rfqs.data?.length && <Empty icon={<Send className="h-5 w-5" />} title="No requests yet" text="Describe what you need once and send it to every relevant vendor. Quotes come back here for comparison." action={<Button onClick={() => setNewRfq({})}>Request quotes</Button>} />}>
              {rfqs.data?.map((r) => (
                <tr key={r.id}>
                  <td className="td"><Link to={`/leagues/${leagueId}/procurement/rfqs/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">RFQ-{r.number} · {r.title}</Link></td>
                  <td className="td">{catName(r.categorySlug)}</td><td className="td">{date(r.neededBy)}</td><td className="td">{r.budgetMax ? inrShort(r.budgetMax) : '—'}</td>
                  <td className="td">{r._count.invites}</td><td className="td font-semibold">{r._count.quotes}</td><td className="td">{r.lowest ? inr(r.lowest) : '—'}</td>
                  <td className="td"><Badge color={RFQ_COLOR[r.status]}>{r.status.toLowerCase()}</Badge></td>
                  <td className="td text-right"><Link to={`/leagues/${leagueId}/procurement/rfqs/${r.id}`}><Button size="sm" variant="secondary">{r._count.quotes && r.status === 'OPEN' ? 'Compare' : 'Open'}</Button></Link></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      {tab === 'work' && (
        <Card padded={false}>
          {wos.isLoading ? <Spinner /> : (
            <Table head={['Work order', 'Vendor', 'Due', 'Value', 'Status', 'Rating', '']} empty={!wos.data?.length && <Empty icon={<ClipboardList className="h-5 w-5" />} title="No work orders yet" text="Award a quote to create one automatically." />}>
              {wos.data?.map((w) => (
                <tr key={w.id} className={cx(w.overdue && 'bg-red-50/40')}>
                  <td className="td"><Link to={`/leagues/${leagueId}/procurement/work-orders/${w.id}`} className="font-medium text-ink-900 hover:text-brand-700">WO-{w.number} · {w.title}</Link></td>
                  <td className="td"><span className="flex items-center gap-1">{w.vendor.companyName}{w.vendor.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}</span></td>
                  <td className={cx('td', w.overdue && 'font-semibold text-red-600')}>{date(w.dueDate)}{w.overdue && ' · overdue'}</td>
                  <td className="td">{inr(w.amount + w.gstAmount)}</td>
                  <td className="td"><Badge color={WO_STATUS[w.status].color}>{WO_STATUS[w.status].label}</Badge></td>
                  <td className="td">{w.review ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{((w.review.quality + w.review.onTime + w.review.value) / 3).toFixed(1)}</span> : w.status === 'COMPLETED' ? <span className="text-xs text-amber-700">Rate vendor</span> : '—'}</td>
                  <td className="td text-right"><Link to={`/leagues/${leagueId}/procurement/work-orders/${w.id}`}><Button size="sm" variant="secondary">Open</Button></Link></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      {newRfq && <NewRfq leagueId={leagueId} initial={newRfq} onClose={() => setNewRfq(null)} />}
    </>
  );
}

function NewRfq({ leagueId, initial, onClose }: { leagueId: string; initial: { category?: string; vendor?: string }; onClose: () => void }) {
  const nav = useNavigate();
  const cats = useCategories();
  const [f, setF] = useState<any>({ categorySlug: initial.category ?? '', title: '', specs: '', quantity: '', location: '', neededBy: '', budgetMax: '', attachments: [] as string[], vendorIds: initial.vendor ? [initial.vendor] : [] as string[], inviteAllInCategory: false, city: '' });
  const vendors = useQuery({ queryKey: ['vendors-cat', f.categorySlug, f.city], queryFn: () => get<any[]>(`/vendors?category=${f.categorySlug}${f.city ? `&city=${encodeURIComponent(f.city)}` : ''}`), enabled: !!f.categorySlug });
  const cat = cats.data?.categories.find((c) => c.slug === f.categorySlug);
  useEffect(() => { if (cat && !f.title) setF((x: any) => ({ ...x, title: cat.name })); }, [cat]); // eslint-disable-line
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/procurement/rfqs`, { ...f, budgetMax: f.budgetMax || null, neededBy: f.neededBy || null, city: f.city || undefined }), onSuccess: (r) => nav(`/leagues/${leagueId}/procurement/rfqs/${r.id}`) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} size="xl" title="Request quotes from vendors" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={!f.categorySlug || !f.specs || (!f.vendorIds.length && !f.inviteAllInCategory)} onClick={() => create.mutate()}><Send className="h-4 w-4" />Send to {f.inviteAllInCategory ? 'all matching vendors' : `${f.vendorIds.length} vendor${f.vendorIds.length === 1 ? '' : 's'}`}</Button></>}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <ErrorText error={create.error} />
          <Field label="What do you need? (category)">
            <select className="input" value={f.categorySlug} onChange={(e) => setF({ ...f, categorySlug: e.target.value, vendorIds: [], title: '' })}>
              <option value="">Select category</option>
              {cats.data?.groups.map((g) => <optgroup key={g} label={g}>{cats.data.categories.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</optgroup>)}
            </select>
          </Field>
          <Field label="Title"><Input value={f.title} onChange={set('title')} /></Field>
          <Field label="Specifications" hint="Be specific: sizes, materials, hours, standards, what's included"><Textarea rows={5} value={f.specs} onChange={set('specs')} placeholder="e.g. Sublimated jerseys, 180 GSM, 8 teams × 25 sets, sizes S–XXL, name & number print, delivery in Mumbai" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><Input value={f.quantity} onChange={set('quantity')} placeholder="200 sets / 16 match days" /></Field>
            <Field label="Location"><Input value={f.location} onChange={set('location')} /></Field>
            <Field label="Needed by"><Input type="date" value={f.neededBy} onChange={set('neededBy')} /></Field>
            <Field label="Budget ceiling (₹, optional)" hint="Not shown to vendors"><Input type="number" value={f.budgetMax} onChange={set('budgetMax')} /></Field>
          </div>
          <div><UploadButton label="Attach designs / specs" onAdd={(a) => setF({ ...f, attachments: [...f.attachments, ...a] })} />{f.attachments.length > 0 && <span className="ml-2 text-xs text-ink-500">{f.attachments.length} attached</span>}</div>
        </div>
        <div>
          <p className="label">Invite vendors</p>
          {!f.categorySlug ? <p className="text-sm text-ink-500">Choose a category to see matching vendors.</p> : (
            <>
              <div className="mb-2 flex gap-2"><Input placeholder="Filter by city" value={f.city} onChange={set('city')} /></div>
              <label className="mb-2 flex items-center gap-2 rounded-lg bg-brand-50 p-2.5 text-sm"><input type="checkbox" checked={f.inviteAllInCategory} onChange={(e) => setF({ ...f, inviteAllInCategory: e.target.checked })} />Invite every {cat?.name ?? ''} vendor{f.city ? ` serving ${f.city}` : ''} on SportsIQ</label>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
                {vendors.isLoading ? <Spinner /> : !vendors.data?.length ? <p className="p-3 text-sm text-ink-500">No vendors in this category yet.</p> : vendors.data.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-ink-50">
                    <input type="checkbox" checked={f.inviteAllInCategory || f.vendorIds.includes(v.id)} disabled={f.inviteAllInCategory} onChange={(e) => setF({ ...f, vendorIds: e.target.checked ? [...f.vendorIds, v.id] : f.vendorIds.filter((x: string) => x !== v.id) })} />
                    <Avatar name={v.companyName} size={30} />
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-1 truncate text-sm font-medium">{v.companyName}{v.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-600" />}</span><span className="text-xs text-ink-500">{v.city} · {v.rating ? `★ ${v.rating.toFixed(1)} (${v.reviewCount})` : 'No reviews yet'}{v.startingPrice ? ` · from ${inrShort(v.startingPrice)}` : ''}</span></span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function RfqDetail() {
  const { leagueId } = useLeague();
  const { rid } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const r = useQuery({ queryKey: ['rfq', rid], queryFn: () => get(`/leagues/${leagueId}/procurement/rfqs/${rid}`) });
  const meta = useQuery({ queryKey: ['finance-meta'], queryFn: () => get(`/leagues/${leagueId}/finance/meta`) });
  const [award, setAward] = useState<any>(null);
  const awardM = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/procurement/quotes/${award.quote.id}/award`, award.opts), onSuccess: (x) => nav(`/leagues/${leagueId}/procurement/work-orders/${x.workOrderId}`) });
  const setStatus = useMutation({ mutationFn: (status: string) => patch(`/leagues/${leagueId}/procurement/rfqs/${rid}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['rfq', rid] }) });
  if (r.isLoading) return <Spinner />;
  const d = r.data;
  const live = d.quotes.filter((q: any) => q.status !== 'WITHDRAWN');
  const pending = d.invites.filter((i: any) => !d.quotes.some((q: any) => q.vendorId === i.vendorId));

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/procurement`} className="hover:underline">Procurement</Link>} title={`RFQ-${d.number} · ${d.title}`}
        subtitle={`${d.categoryName ?? d.categorySlug} · needed by ${date(d.neededBy)}${d.budgetMax ? ` · budget ${inr(d.budgetMax)}` : ''}`}
        actions={<><Badge color={RFQ_COLOR[d.status]} className="text-sm">{d.status.toLowerCase()}</Badge>{d.status === 'OPEN' && <Button variant="ghost" onClick={() => confirm('Cancel this RFQ? Vendors will no longer be able to quote.') && setStatus.mutate('CANCELLED')}>Cancel RFQ</Button>}{d.workOrder && <Link to={`/leagues/${leagueId}/procurement/work-orders/${d.workOrder.id}`}><Button>Open WO-{d.workOrder.number}</Button></Link>}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card title={`Quote comparison (${live.length})`} padded={false} className="min-w-0">
          {!live.length ? <Empty icon={<FileText className="h-5 w-5" />} title="No quotes yet" text={`${d.invites.length} vendors invited. You'll be notified as quotes arrive.`} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-50/70 text-xs uppercase text-ink-500"><tr><th className="th">Vendor</th><th className="th text-right">Amount</th><th className="th text-right">GST</th><th className="th text-right">Total</th><th className="th">Timeline</th><th className="th">Terms</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {d.quotes.map((q: any) => (
                    <tr key={q.id} className={cx(q.isLowest && 'bg-emerald-50/50', q.status === 'WITHDRAWN' && 'opacity-50')}>
                      <td className="td"><p className="flex items-center gap-1 font-medium text-ink-900">{q.vendor.companyName}{q.vendor.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}<ComplianceBadge c={d.compliance?.[q.vendorId]} /></p><p className="text-xs text-ink-500">{q.vendor.city} · {q.vendor.rating ? `★ ${q.vendor.rating.toFixed(1)} (${q.vendor.reviewCount})` : 'new vendor'} · {ago(q.updatedAt)}</p></td>
                      <td className="td text-right">{inr(q.amount)}</td><td className="td text-right">{inr(q.gstAmount)}</td>
                      <td className="td text-right font-bold text-ink-900">{inr(q.total)}{q.isLowest && <Badge color="green" className="ml-1">Lowest</Badge>}{q.overBudget && <Badge color="red" className="ml-1">Over budget</Badge>}</td>
                      <td className="td">{q.timeline}</td>
                      <td className="td max-w-xs whitespace-normal text-xs">{q.terms ?? '—'}{q.validTill && <p className="text-ink-400">Valid till {date(q.validTill)}</p>}<Attachments urls={q.attachments} /></td>
                      <td className="td text-right">{q.status === 'SUBMITTED' && d.status === 'OPEN' ? <Button size="sm" variant="success" onClick={() => setAward({ quote: q, opts: { createContract: true, createExpense: true, expenseCategory: 'Miscellaneous', dueDate: d.neededBy?.slice(0, 10) ?? '', contactPerson: '' } })}><Trophy className="h-3.5 w-3.5" />Award</Button> : <Badge color={q.status === 'ACCEPTED' ? 'green' : q.status === 'REJECTED' ? 'red' : 'gray'}>{q.status.toLowerCase()}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Requirement">
            <p className="whitespace-pre-wrap text-sm text-ink-700">{d.specs}</p>
            {d.quantity && <p className="mt-2 text-sm"><b>Quantity:</b> {d.quantity}</p>}
            {d.location && <p className="text-sm"><b>Location:</b> {d.location}</p>}
            <Attachments urls={d.attachments} />
          </Card>
          <Card title={`Invited (${d.invites.length})`} padded={false}>
            <ul className="divide-y divide-ink-100">{d.invites.map((i: any) => { const q = d.quotes.find((x: any) => x.vendorId === i.vendorId); return (
              <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="flex items-center gap-2">{i.vendor.companyName}<ComplianceBadge c={d.compliance?.[i.vendorId]} /></span>{q ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : i.declined ? <Badge color="red">declined</Badge> : <span className="text-xs text-ink-400">awaiting</span>}</li>
            ); })}</ul>
            {pending.length > 0 && <p className="px-5 pb-3 text-xs text-ink-500">{pending.length} vendor{pending.length > 1 ? 's have' : ' has'} not quoted yet.</p>}
          </Card>
        </div>
      </div>
      <Modal open={!!award} onClose={() => setAward(null)} title={`Award to ${award?.quote.vendor.companyName}`} footer={<><Button variant="secondary" onClick={() => setAward(null)}>Cancel</Button><Button variant="success" loading={awardM.isPending} onClick={() => awardM.mutate()}>Award & create work order</Button></>}>
        {award && <div className="space-y-3">
          <ErrorText error={awardM.error} />
          <p className="text-sm">Total <b>{inr(award.quote.total)}</b> · {award.quote.timeline}. Other quotes will be marked not selected and those vendors notified.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date"><Input type="date" value={award.opts.dueDate} onChange={(e) => setAward({ ...award, opts: { ...award.opts, dueDate: e.target.value } })} /></Field>
            <Field label="Your contact person"><Input value={award.opts.contactPerson} onChange={(e) => setAward({ ...award, opts: { ...award.opts, contactPerson: e.target.value } })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={award.opts.createContract} onChange={(e) => setAward({ ...award, opts: { ...award.opts, createContract: e.target.checked } })} />Create a vendor service agreement draft (verify with your lawyer)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={award.opts.createExpense} onChange={(e) => setAward({ ...award, opts: { ...award.opts, createExpense: e.target.checked } })} />Add to expenses as payable under</label>
          {award.opts.createExpense && <Select value={award.opts.expenseCategory} onChange={(e) => setAward({ ...award, opts: { ...award.opts, expenseCategory: e.target.value } })} options={meta.data?.expenseCategories ?? []} />}
        </div>}
      </Modal>
      <Comments className="mt-6" leagueId={leagueId} type="Rfq" id={rid!} />
    </>
  );
}

export function WorkOrderDetail() {
  const { leagueId } = useLeague();
  const { wid } = useParams();
  const qc = useQueryClient();
  const key = ['wo', wid];
  const w = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/procurement/work-orders/${wid}`) });
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [rate, setRate] = useState({ quality: 5, onTime: 5, value: 5, comment: '' });
  const upd = useMutation({ mutationFn: (kind: string) => post(`/leagues/${leagueId}/procurement/work-orders/${wid}/updates`, { kind, body: body || undefined, attachments: files }), onSuccess: (v) => { setBody(''); setFiles([]); qc.setQueryData(key, (o: any) => ({ ...o, ...v })); qc.invalidateQueries({ queryKey: ['work-orders', leagueId] }); } });
  const review = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/procurement/work-orders/${wid}/review`, rate), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const ms = useMutation({ mutationFn: (i: number) => post(`/leagues/${leagueId}/procurement/work-orders/${wid}/milestones/${i}`), onSuccess: (v) => qc.setQueryData(key, (o: any) => ({ ...o, ...v })) });
  if (w.isLoading) return <Spinner />;
  const d = w.data;
  const closed = ['COMPLETED', 'CANCELLED'].includes(d.status);
  const Stars = ({ k }: { k: 'quality' | 'onTime' | 'value' }) => <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRate({ ...rate, [k]: n })} aria-label={`${n} stars`}><Star className={cx('h-5 w-5', n <= rate[k] ? 'fill-amber-400 text-amber-400' : 'text-ink-300')} /></button>)}</span>;
  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/procurement?tab=work`} className="hover:underline">Procurement</Link>} title={`WO-${d.number} · ${d.title}`} subtitle={`${d.vendor.companyName} · ${inr(d.amount + d.gstAmount)} incl. GST · due ${date(d.dueDate)}`}
        actions={<><Badge color={WO_STATUS[d.status].color} className="text-sm">{WO_STATUS[d.status].label}</Badge>{d.overdue && <Badge color="red" className="text-sm">Overdue</Badge>}{d.contractId && <Link to={`/leagues/${leagueId}/contracts/${d.contractId}`}><Button variant="secondary"><FileText className="h-4 w-4" />Contract</Button></Link>}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Activity & proofs">
          <ol className="space-y-4">
            {d.updates.map((u: any) => (
              <li key={u.id} className={cx('rounded-xl border p-4', u.side === 'VENDOR' ? 'border-brand-100 bg-brand-50/40' : 'border-ink-200', u.kind === 'REVISION' && 'border-amber-300 bg-amber-50')}>
                <div className="flex items-center justify-between text-xs"><span className="font-semibold text-ink-900">{u.authorName} <span className="font-normal text-ink-500">· {u.side === 'VENDOR' ? 'Vendor' : 'League'}</span></span><span className="text-ink-400">{ago(u.createdAt)}</span></div>
                {u.status && <Badge color={WO_STATUS[u.status]?.color} className="mt-1">{WO_STATUS[u.status]?.label}</Badge>}
                {u.kind === 'REVISION' && <Badge color="amber" className="mt-1">Changes requested</Badge>}
                {u.kind === 'PROOF' && <Badge color="violet" className="mt-1">Proof</Badge>}
                {u.body && <p className="mt-2 whitespace-pre-wrap text-sm">{u.body}</p>}
                <Attachments urls={u.attachments} />
              </li>
            ))}
          </ol>
          {!closed && (
            <div className="mt-5 space-y-2 border-t border-ink-100 pt-4">
              <ErrorText error={upd.error} />
              <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message the vendor, or describe the changes you need…" />
              <div className="flex flex-wrap items-center gap-2">
                <UploadButton onAdd={(a) => setFiles([...files, ...a])} />{files.length > 0 && <span className="text-xs text-ink-500">{files.length} file(s)</span>}
                <span className="flex-1" />
                <Button size="sm" variant="secondary" loading={upd.isPending} disabled={!body} onClick={() => upd.mutate('COMMENT')}>Send message</Button>
                {d.status === 'UNDER_REVIEW' && <Button size="sm" variant="secondary" disabled={!body} onClick={() => upd.mutate('REVISION')}>Request changes</Button>}
                {['UNDER_REVIEW', 'IN_PROGRESS'].includes(d.status) && <Button size="sm" variant="success" onClick={() => confirm('Approve this work as complete?') && upd.mutate('APPROVE')}><CheckCircle2 className="h-3.5 w-3.5" />Approve completion</Button>}
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm('Cancel this work order?') && upd.mutate('CANCEL')}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          {d.milestones?.length > 0 && (
            <Card title="Delivery milestones">
              <ol className="space-y-2">{d.milestones.map((m: any, i: number) => {
                const next = !m.doneAt && d.milestones.slice(0, i).every((x: any) => x.doneAt);
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', m.doneAt ? 'bg-emerald-500 text-white' : next ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{m.doneAt ? '✓' : i + 1}</span>
                    <span className="min-w-0 flex-1"><span className={cx(m.doneAt ? 'text-ink-900' : 'text-ink-500')}>{m.name}</span>{m.doneAt && <span className="block text-xs text-ink-400">{m.by} · {ago(m.doneAt)}</span>}{m.proof && <Attachments urls={[m.proof]} />}</span>
                    {next && /approved/i.test(m.name) && !closed && <Button size="sm" variant="success" onClick={() => ms.mutate(i)}>Confirm</Button>}
                  </li>
                );
              })}</ol>
            </Card>
          )}
          <Card title="Scope"><p className="whitespace-pre-wrap text-sm text-ink-700">{d.scope}</p>{d.location && <p className="mt-2 text-sm"><b>Location:</b> {d.location}</p>}{d.contactPerson && <p className="text-sm"><b>Contact:</b> {d.contactPerson}</p>}</Card>
          {d.expenseId && <Card><p className="text-sm">Recorded as a payable expense. <Link to={`/leagues/${leagueId}/finance`} className="font-semibold text-brand-700 hover:underline">Open finance →</Link></p></Card>}
          {d.status === 'COMPLETED' && (
            <Card title="Rate this vendor">
              {d.review ? (
                <div className="text-sm"><p className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{((d.review.quality + d.review.onTime + d.review.value) / 3).toFixed(1)} / 5</p><p className="mt-1 text-ink-500">Quality {d.review.quality} · On time {d.review.onTime} · Value {d.review.value}</p>{d.review.comment && <p className="mt-2">“{d.review.comment}”</p>}</div>
              ) : (
                <div className="space-y-3 text-sm">
                  <ErrorText error={review.error} />
                  <div className="flex items-center justify-between">Quality <Stars k="quality" /></div>
                  <div className="flex items-center justify-between">On-time delivery <Stars k="onTime" /></div>
                  <div className="flex items-center justify-between">Value for money <Stars k="value" /></div>
                  <Textarea rows={3} value={rate.comment} onChange={(e) => setRate({ ...rate, comment: e.target.value })} placeholder="Would you hire them again? (shown on their profile)" />
                  <Button className="w-full" loading={review.isPending} onClick={() => review.mutate()}>Submit review</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
      <Comments className="mt-6" leagueId={leagueId} type="WorkOrder" id={wid!} title="Internal discussion" />
    </>
  );
}
