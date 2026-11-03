import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Plus, Send, Star, Trash2 } from 'lucide-react';
import { del, get, post } from '../lib/api';
import { ago, date, inr } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, Spinner, Textarea, cx } from '../components/ui';
import { Attachments, UploadButton, WO_STATUS } from './league/Procurement';

export function VendorRfqs() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['v-rfqs'], queryFn: () => get<any[]>('/vendor-portal/rfqs') });
  const [quote, setQuote] = useState<any>(null);
  const submit = useMutation({ mutationFn: () => post(`/vendor-portal/rfqs/${quote.rfq.id}/quote`, { amount: quote.amount, gstAmount: quote.gstAmount || 0, timeline: quote.timeline, terms: quote.terms || undefined, validTill: quote.validTill || null, attachments: quote.attachments }), onSuccess: () => { setQuote(null); qc.invalidateQueries({ queryKey: ['v-rfqs'] }); } });
  const decline = useMutation({ mutationFn: (id: string) => post(`/vendor-portal/rfqs/${id}/decline`), onSuccess: () => qc.invalidateQueries({ queryKey: ['v-rfqs'] }) });
  const withdraw = useMutation({ mutationFn: (id: string) => post(`/vendor-portal/rfqs/${id}/withdraw`), onSuccess: () => qc.invalidateQueries({ queryKey: ['v-rfqs'] }) });
  if (list.isLoading) return <Spinner />;
  if (!list.data?.length) return <Card><Empty icon={<Send className="h-5 w-5" />} title="No quote requests yet" text="Leagues send requests to vendors in your categories. Complete your profile and services to get invited." /></Card>;
  return (
    <div className="space-y-4">
      {list.data.map((r) => {
        const q = r.myQuote;
        return (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={r.league?.name ?? '?'} src={r.league?.logoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-500">{r.league?.name} · RFQ-{r.number} · {r.categoryName} · {ago(r.createdAt)}</p>
                <p className="text-lg font-bold">{r.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.specs}</p>
                <p className="mt-2 text-sm text-ink-500">{[r.quantity && `Qty: ${r.quantity}`, r.location && `Location: ${r.location}`, r.neededBy && `Needed by ${date(r.neededBy)}`].filter(Boolean).join(' · ')}</p>
                <Attachments urls={r.attachments} />
              </div>
              <div className="text-right">
                {q ? <><Badge color={q.status === 'ACCEPTED' ? 'green' : q.status === 'REJECTED' ? 'red' : q.status === 'WITHDRAWN' ? 'gray' : 'blue'}>{q.status === 'SUBMITTED' ? 'Quote sent' : q.status.toLowerCase()}</Badge><p className="mt-1 text-lg font-bold">{inr(q.amount + q.gstAmount)}</p></>
                  : r.declined ? <Badge color="gray">Declined</Badge> : <Badge color={r.status === 'OPEN' ? 'amber' : 'gray'}>{r.status === 'OPEN' ? 'Awaiting your quote' : r.status.toLowerCase()}</Badge>}
              </div>
            </div>
            {r.status === 'OPEN' && !r.declined && (!q || ['SUBMITTED', 'WITHDRAWN'].includes(q.status)) && (
              <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4">
                <Button size="sm" onClick={() => setQuote({ rfq: r, amount: q?.amount ?? '', gstAmount: q?.gstAmount ?? '', timeline: q?.timeline ?? '', terms: q?.terms ?? '', validTill: q?.validTill?.slice(0, 10) ?? '', attachments: q?.attachments ?? [] })}>{q && q.status === 'SUBMITTED' ? 'Revise quote' : 'Submit quote'}</Button>
                {q?.status === 'SUBMITTED' ? <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(r.id)}>Withdraw</Button> : !q && <Button size="sm" variant="ghost" onClick={() => decline.mutate(r.id)}>Not interested</Button>}
              </div>
            )}
          </div>
        );
      })}
      <Modal open={!!quote} onClose={() => setQuote(null)} title={`Quote — ${quote?.rfq.title}`} footer={<><Button variant="secondary" onClick={() => setQuote(null)}>Cancel</Button><Button loading={submit.isPending} disabled={!quote?.amount || !quote?.timeline} onClick={() => submit.mutate()}><Send className="h-4 w-4" />Send quote</Button></>}>
        {quote && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={submit.error} /></div>
          <Field label="Amount excl. GST (₹)"><Input type="number" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} /></Field>
          <Field label="GST (₹)" hint={<span className="flex gap-2">{[5, 12, 18].map((p) => <button key={p} type="button" className="text-brand-700 hover:underline" onClick={() => setQuote({ ...quote, gstAmount: Math.round((Number(quote.amount) || 0) * p / 100) })}>{p}%</button>)}</span>}><Input type="number" value={quote.gstAmount} onChange={(e) => setQuote({ ...quote, gstAmount: e.target.value })} /></Field>
          <Field label="Delivery timeline" className="col-span-2"><Input value={quote.timeline} onChange={(e) => setQuote({ ...quote, timeline: e.target.value })} placeholder="e.g. Sample in 5 days, bulk in 12 days" /></Field>
          <Field label="Terms" className="col-span-2"><Textarea rows={3} value={quote.terms} onChange={(e) => setQuote({ ...quote, terms: e.target.value })} placeholder="Advance %, payment schedule, inclusions/exclusions" /></Field>
          <Field label="Valid till"><Input type="date" value={quote.validTill} onChange={(e) => setQuote({ ...quote, validTill: e.target.value })} /></Field>
          <div className="flex items-end"><UploadButton label="Attach quote / samples" onAdd={(a) => setQuote({ ...quote, attachments: [...quote.attachments, ...a] })} /></div>
          <p className="col-span-2 text-sm font-semibold">Total: {inr((Number(quote.amount) || 0) + (Number(quote.gstAmount) || 0))}</p>
        </div>}
      </Modal>
    </div>
  );
}

export function VendorWorkOrders() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['v-wos'], queryFn: () => get<any[]>('/vendor-portal/work-orders') });
  const [open, setOpen] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const upd = useMutation({ mutationFn: ({ id, kind }: any) => post(`/vendor-portal/work-orders/${id}/updates`, { kind, body: body || undefined, attachments: files }), onSuccess: () => { setBody(''); setFiles([]); qc.invalidateQueries({ queryKey: ['v-wos'] }); } });
  if (list.isLoading) return <Spinner />;
  if (!list.data?.length) return <Card><Empty title="No work orders yet" text="When a league awards you a quote, the work order appears here." /></Card>;
  return (
    <div className="space-y-4">
      {list.data.map((w) => {
        const isOpen = open === w.id;
        const closed = ['COMPLETED', 'CANCELLED'].includes(w.status);
        return (
          <div key={w.id} className={cx('card', w.overdue && 'border-red-300')}>
            <button onClick={() => setOpen(isOpen ? null : w.id)} className="flex w-full flex-wrap items-center gap-4 p-5 text-left">
              <Avatar name={w.league?.name ?? '?'} src={w.league?.logoUrl} size={40} />
              <div className="min-w-0 flex-1"><p className="text-xs text-ink-500">{w.league?.name} · WO-{w.number}</p><p className="font-bold">{w.title}</p><p className={cx('text-xs', w.overdue ? 'font-semibold text-red-600' : 'text-ink-500')}>Due {date(w.dueDate)}{w.overdue && ' · overdue'}</p></div>
              <p className="font-bold">{inr(w.amount + w.gstAmount)}</p>
              <Badge color={WO_STATUS[w.status].color}>{WO_STATUS[w.status].label}</Badge>
            </button>
            {isOpen && (
              <div className="border-t border-ink-100 p-5">
                <p className="whitespace-pre-wrap text-sm text-ink-700">{w.scope}</p>
                <ol className="mt-4 space-y-3">
                  {w.updates.map((u: any) => (
                    <li key={u.id} className={cx('rounded-lg border p-3 text-sm', u.kind === 'REVISION' ? 'border-amber-300 bg-amber-50' : u.side === 'LEAGUE' ? 'border-ink-200' : 'border-brand-100 bg-brand-50/40')}>
                      <p className="text-xs"><b>{u.authorName}</b> · {ago(u.createdAt)} {u.kind === 'REVISION' && <Badge color="amber">Changes requested</Badge>}{u.status && <Badge color={WO_STATUS[u.status]?.color}>{WO_STATUS[u.status]?.label}</Badge>}</p>
                      {u.body && <p className="mt-1 whitespace-pre-wrap">{u.body}</p>}
                      <Attachments urls={u.attachments} />
                    </li>
                  ))}
                </ol>
                {!closed && (
                  <div className="mt-4 space-y-2">
                    <ErrorText error={upd.error} />
                    <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Progress update, question, or notes on the proof you're uploading" />
                    <div className="flex flex-wrap items-center gap-2">
                      <UploadButton label="Photos / documents" onAdd={(a) => setFiles([...files, ...a])} />{files.length > 0 && <span className="text-xs text-ink-500">{files.length} file(s)</span>}
                      <span className="flex-1" />
                      {w.status === 'NOT_STARTED' && <Button size="sm" variant="secondary" onClick={() => upd.mutate({ id: w.id, kind: 'START' })}>Start work</Button>}
                      <Button size="sm" variant="secondary" disabled={!body && !files.length} onClick={() => upd.mutate({ id: w.id, kind: files.length ? 'PROOF' : 'COMMENT' })}>{files.length ? 'Upload proof' : 'Send update'}</Button>
                      {w.status === 'IN_PROGRESS' && <Button size="sm" onClick={() => upd.mutate({ id: w.id, kind: 'SUBMIT' })}>Submit for review</Button>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VendorPortfolio() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['v-portfolio'], queryFn: () => get<any[]>('/vendor-portal/portfolio') });
  const [f, setF] = useState<any>(null);
  const add = useMutation({ mutationFn: () => post('/vendor-portal/portfolio', f), onSuccess: () => { setF(null); qc.invalidateQueries({ queryKey: ['v-portfolio'] }); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/vendor-portal/portfolio/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['v-portfolio'] }) });
  return (
    <>
      <div className="mb-4 flex justify-between"><p className="text-sm text-ink-500">Show leagues your best work. Use only images you have rights to publish.</p><Button onClick={() => setF({ title: '', client: '', description: '', imageUrl: '', videoUrl: '' })}><Plus className="h-4 w-4" />Add work</Button></div>
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Card><Empty icon={<ImageIcon className="h-5 w-5" />} title="No portfolio items yet" /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-ink-50 text-ink-300"><ImageIcon className="h-8 w-8" /></div>}
              <div className="p-4"><div className="flex justify-between gap-2"><p className="font-semibold">{p.title}</p><button onClick={() => remove.mutate(p.id)} className="text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>{p.client && <p className="text-xs text-ink-500">for {p.client}</p>}{p.description && <p className="mt-1 text-sm text-ink-700">{p.description}</p>}{p.videoUrl && <a href={p.videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">Watch video</a>}</div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!f} onClose={() => setF(null)} title="Add portfolio item" footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button loading={add.isPending} disabled={!f?.title} onClick={() => add.mutate()}>Save</Button></>}>
        {f && <div className="space-y-3">
          <ErrorText error={add.error} />
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Kits for City Premier League 2025" /></Field>
          <Field label="Client"><Input value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Video link (optional)"><Input value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://youtube.com/…" /></Field>
          <div className="flex items-center gap-3">{f.imageUrl && <img src={f.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />}<UploadButton label={f.imageUrl ? 'Replace image' : 'Upload image'} onAdd={(a) => setF({ ...f, imageUrl: a[0] })} /></div>
        </div>}
      </Modal>
    </>
  );
}

export function VendorReviews() {
  const list = useQuery({ queryKey: ['v-reviews'], queryFn: () => get<any[]>('/vendor-portal/reviews') });
  if (list.isLoading) return <Spinner />;
  if (!list.data?.length) return <Card><Empty icon={<Star className="h-5 w-5" />} title="No reviews yet" text="Leagues rate you after each completed work order. Ratings appear on your public profile." /></Card>;
  return (
    <Card padded={false}><ul className="divide-y divide-ink-100">{list.data.map((r) => {
      const avg = (r.quality + r.onTime + r.value) / 3;
      return <li key={r.id} className="px-5 py-4"><div className="flex items-center justify-between"><p className="font-semibold">{r.leagueName}</p><span className="flex items-center gap-1 font-bold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{avg.toFixed(1)}</span></div><p className="text-xs text-ink-500">Quality {r.quality} · On time {r.onTime} · Value {r.value} · {date(r.createdAt)}</p>{r.comment && <p className="mt-1 text-sm">“{r.comment}”</p>}</li>;
    })}</ul></Card>
  );
}

