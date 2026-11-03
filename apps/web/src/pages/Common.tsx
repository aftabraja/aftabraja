import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageSquare, Send } from 'lucide-react';
import { api, get, post } from '../lib/api';
import { checkout } from '../lib/pay';
import { download } from '../lib/download';
import { useAuth } from '../lib/auth';
import { ago, date, inr, ROLE_LABEL } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, PageHeader, Spinner, StatusBadge, cx } from '../components/ui';
import { VendorBrowser } from '../components/VendorPanel';

export function Marketplace() {
  return (
    <>
      <PageHeader title="Vendor Marketplace" subtitle="Everything a league needs — 70+ categories from stadiums and umpires to jersey printers, anchors and trophy makers." />
      <div className="card h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden"><VendorBrowser /></div>
    </>
  );
}

const displayName = (u: any) => u.vendorProfile?.companyName ?? u.sponsorProfile?.companyName ?? u.name;

export function Messages() {
  const { cid } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['conversations'], queryFn: () => get<any[]>('/messages'), refetchInterval: 15_000 });
  const convo = useQuery({ queryKey: ['conversation', cid], queryFn: () => get(`/messages/${cid}`), enabled: !!cid, refetchInterval: 8_000 });
  const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const send = useMutation({ mutationFn: () => post(`/messages/${cid}/messages`, { body }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['conversation', cid] }); qc.invalidateQueries({ queryKey: ['conversations'] }); } });
  useEffect(() => { end.current?.scrollIntoView(); qc.invalidateQueries({ queryKey: ['unread-messages'] }); }, [convo.data?.messages?.length, qc]);

  return (
    <>
      <PageHeader title="Messages" subtitle="Talk to vendors, sponsors, team owners and league management." />
      <div className="card grid h-[calc(100vh-13rem)] min-h-[520px] overflow-hidden md:grid-cols-[320px_1fr]">
        <div className={cx('overflow-y-auto border-r border-ink-100', cid && 'hidden md:block')}>
          {list.isLoading ? <Spinner /> : !list.data?.length ? <Empty icon={<MessageSquare className="h-5 w-5" />} title="No conversations" text="Contact a vendor or sponsor to start one." /> :
            list.data.map((c) => {
              const other = c.participants.find((p: any) => p.userId !== user?.id)?.user ?? c.participants[0].user;
              return (
                <button key={c.id} onClick={() => nav(`/messages/${c.id}`)} className={cx('flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50', c.id === cid && 'bg-brand-50')}>
                  <Avatar name={displayName(other)} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2"><p className={cx('truncate text-sm', c.unread ? 'font-bold' : 'font-medium')}>{displayName(other)}</p>{c.lastMessage && <span className="shrink-0 text-[11px] text-ink-400">{ago(c.lastMessage.createdAt)}</span>}</div>
                    <p className="truncate text-xs text-ink-500">{c.subject ?? ROLE_LABEL[other.role]}</p>
                    {c.lastMessage && <p className={cx('truncate text-xs', c.unread ? 'text-ink-900' : 'text-ink-400')}>{c.lastMessage.body}</p>}
                  </div>
                  {c.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              );
            })}
        </div>
        <div className={cx('flex min-h-0 flex-col', !cid && 'hidden md:flex')}>
          {!cid ? <Empty icon={<MessageSquare className="h-5 w-5" />} title="Select a conversation" /> : convo.isLoading ? <Spinner /> : (
            <>
              <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3">
                <button className="text-xs font-semibold text-brand-700 md:hidden" onClick={() => nav('/messages')}>Back</button>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{convo.data.participants.filter((p: any) => p.userId !== user?.id).map((p: any) => displayName(p.user)).join(', ')}</p>
                  <p className="truncate text-xs text-ink-500">{convo.data.subject}{convo.data.league && ` · ${convo.data.league.name}`}</p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-ink-50/50 p-5">
                {convo.data.messages.map((m: any) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cx('flex', mine && 'justify-end')}>
                      <div className={cx('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-sm bg-brand-700 text-white' : 'rounded-bl-sm border border-ink-200 bg-white')}>
                        {!mine && <p className="mb-0.5 text-xs font-semibold text-brand-700">{m.sender.name}</p>}
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={cx('mt-1 text-[10px]', mine ? 'text-white/60' : 'text-ink-400')}>{ago(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }} className="flex gap-2 border-t border-ink-100 p-3">
                <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
                <Button loading={send.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function Notifications() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const n = useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications') });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const tone: Record<string, string> = { success: 'green', alert: 'red', warning: 'amber', info: 'blue' };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" subtitle="Alerts for step completions, budget overshoots, messages, registrations and sponsor interest." actions={<Button variant="secondary" onClick={() => readAll.mutate()}>Mark all read</Button>} />
      <Card padded={false}>
        {n.isLoading ? <Spinner /> : !n.data.items.length ? <Empty icon={<Bell className="h-5 w-5" />} title="No notifications yet" /> : (
          <ul className="divide-y divide-ink-100">
            {n.data.items.map((x: any) => (
              <li key={x.id}>
                <button onClick={() => { post(`/notifications/${x.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })); if (x.link) nav(x.link); }} className={cx('flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-ink-50', !x.readAt && 'bg-brand-50/30')}>
                  <Badge color={tone[x.type]}>{x.type}</Badge>
                  <div className="min-w-0 flex-1"><p className={cx('text-sm', !x.readAt && 'font-semibold')}>{x.title}</p>{x.body && <p className="text-sm text-ink-500">{x.body}</p>}</div>
                  <span className="shrink-0 text-xs text-ink-400">{ago(x.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function Account() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const delReq = useMutation({ mutationFn: () => post('/auth/me/delete-request') });
  const [pw, setPw] = useState({ current: '', next: '' });
  const change = useMutation({ mutationFn: () => post('/auth/change-password', pw), onSuccess: () => setPw({ current: '', next: '' }) });
  const sub = user?.subscriptions?.[0];
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Account & Subscription" />
      <Card title="Profile">
        <div className="flex items-center gap-4"><Avatar name={user!.name} size={56} /><div><p className="font-bold">{user!.name}</p><p className="text-sm text-ink-500">{user!.email}</p><Badge color="blue" className="mt-1">{ROLE_LABEL[user!.role]}</Badge></div></div>
      </Card>
      {sub && (
        <Card title="Subscription">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm text-ink-500">{ROLE_LABEL[sub.plan] ?? sub.plan} plan</p><p className="text-2xl font-bold">{sub.amount ? inr(sub.amount) : 'Free'}</p><p className="text-xs text-ink-500">Valid till {date(sub.validTill)}</p></div>
            <StatusBadge status={sub.status} />
          </div>
          {sub.status !== 'ACTIVE' && sub.amount > 0 && <PayPlan amount={sub.amount} onPaid={() => { qc.invalidateQueries(); window.location.reload(); }} />}
        </Card>
      )}
      <Invoices />
      <Card title="Change password">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Current password"><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Button loading={change.isPending} onClick={() => change.mutate()}>Update</Button>
        </div>
        <div className="mt-3"><ErrorText error={change.error} />{change.isSuccess && <p className="text-sm text-emerald-700">Password updated.</p>}</div>
      </Card>
      <Card title="Your data & privacy">
        <p className="text-sm text-ink-500">Under India's DPDP Act you can access your data and ask us to erase it. See our <Link to="/privacy" className="text-brand-700 hover:underline">Privacy Policy</Link>.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => download('/auth/me/export', 'sportsiq-my-data.json')}>Download my data</Button>
          <Button variant="ghost" className="text-red-600" loading={delReq.isPending} disabled={delReq.isSuccess} onClick={() => confirm('Request deletion of your account? Our team will process it and confirm by email. Records we must keep by law (e.g. invoices) are retained.') && delReq.mutate()}>{delReq.isSuccess ? 'Deletion requested' : 'Request account deletion'}</Button>
        </div>
      </Card>
    </div>
  );
}

function PayPlan({ amount, onPaid }: { amount: number; onPaid: () => void }) {
  const b = useQuery({ queryKey: ['billing'], queryFn: () => get('/payments/billing') });
  const cfg = useQuery({ queryKey: ['pay-config'], queryFn: () => get('/payments/config') });
  const [f, setF] = useState<any>(null);
  const save = useMutation({ mutationFn: () => api('/payments/billing', { method: 'PUT', body: f }), onSuccess: () => { setF(null); b.refetch(); } });
  const pay = useMutation({ mutationFn: async () => checkout(await post('/payments/subscription')), onSuccess: onPaid });
  if (b.isLoading || cfg.isLoading) return null;
  const p = b.data.profile;
  const intra = p && p.state === cfg.data.platformState;
  const gst = Math.round((amount * cfg.data.gstRate) / 100);
  if (!p || f) {
    const v = f ?? { name: '', gstin: '', state: cfg.data.platformState, address: '' };
    return (
      <div className="mt-4 space-y-3 rounded-xl border border-ink-200 p-4">
        <p className="text-sm font-semibold">Billing details for your GST invoice</p>
        <ErrorText error={save.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name / company"><Input value={v.name} onChange={(e) => setF({ ...v, name: e.target.value })} /></Field>
          <Field label="GSTIN (optional)" hint="Add it to claim input tax credit"><Input value={v.gstin ?? ''} onChange={(e) => setF({ ...v, gstin: e.target.value.toUpperCase() })} maxLength={15} /></Field>
          <Field label="State"><select className="input" value={v.state} onChange={(e) => setF({ ...v, state: e.target.value })}>{b.data.states.map((s: string) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Address"><Input value={v.address ?? ''} onChange={(e) => setF({ ...v, address: e.target.value })} /></Field>
        </div>
        <Button loading={save.isPending} disabled={!v.name} onClick={() => { setF(v); save.mutate(); }}>Save billing details</Button>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Activate your plan</p>
          <p className="mt-1">Plan {inr(amount)} + GST {cfg.data.gstRate}% ({intra ? `CGST ${cfg.data.gstRate / 2}% + SGST ${cfg.data.gstRate / 2}%` : `IGST ${cfg.data.gstRate}%`}) {inr(gst)} = <b>{inr(amount + gst)}</b></p>
          <p className="mt-1 text-xs">Billed to {p.name}{p.gstin ? ` · GSTIN ${p.gstin}` : ''} · {p.state} <button className="ml-1 font-semibold underline" onClick={() => setF({ ...p, gstin: p.gstin ?? '', address: p.address ?? '' })}>Edit</button></p>
        </div>
        <Button loading={pay.isPending} onClick={() => pay.mutate()}>Pay {inr(amount + gst)}</Button>
      </div>
      <ErrorText error={pay.error} />
    </div>
  );
}

function Invoices() {
  const inv = useQuery({ queryKey: ['invoices'], queryFn: () => get<any[]>('/payments/invoices') });
  if (!inv.data?.length) return null;
  return (
    <Card title="Invoices" padded={false}>
      <ul className="divide-y divide-ink-100">
        {inv.data.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span><b>{i.number}</b> <span className="text-ink-500">· {date(i.issuedAt)} · {i.description}</span></span>
            <span className="flex items-center gap-3"><b>{inr(i.total)}</b><Button size="sm" variant="secondary" onClick={() => download(`/payments/invoices/${i.id}/pdf`, `${i.number}.pdf`)}>PDF</Button></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
