import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Link2, Mail, Newspaper, Plus, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Tabs, Textarea, cx } from '../../components/ui';
import { Attachments, UploadButton } from './Procurement';

const TYPES: Record<string, string> = { MATCH_PROMO: 'Match promo', RESULT: 'Result', TEAM_REVEAL: 'Team reveal', PLAYER_STORY: 'Player story', SPONSOR_SHOUTOUT: 'Sponsor shout-out', CONTEST: 'Contest', ANNOUNCEMENT: 'Announcement', OTHER: 'Other' };
const CHANNELS = ['INSTAGRAM', 'FACEBOOK', 'X', 'YOUTUBE', 'LINKEDIN', 'WHATSAPP'];
const STATUS: Record<string, string> = { IDEA: 'gray', DRAFT: 'gray', IN_REVIEW: 'amber', APPROVED: 'blue', PUBLISHED: 'green' };
const STATUS_DOT: Record<string, string> = { IDEA: 'bg-ink-300', DRAFT: 'bg-ink-400', IN_REVIEW: 'bg-amber-500', APPROVED: 'bg-brand-600', PUBLISHED: 'bg-emerald-500' };
const localInput = (d?: string | Date | null) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Marketing() {
  const { leagueId } = useLeague();
  const [tab, setTab] = useState<'calendar' | 'assets' | 'contacts' | 'pr'>('calendar');
  return (
    <>
      <PageHeader title="Marketing & PR" subtitle="Plan and approve social content, keep every creative in one library, and send press releases to your media list." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'calendar', label: 'Content calendar' }, { value: 'assets', label: 'Asset library' }, { value: 'contacts', label: 'Media contacts' }, { value: 'pr', label: 'Press releases' }]} />
      {tab === 'calendar' && <Calendar leagueId={leagueId} />}
      {tab === 'assets' && <Assets leagueId={leagueId} />}
      {tab === 'contacts' && <Contacts leagueId={leagueId} />}
      {tab === 'pr' && <Releases leagueId={leagueId} />}
    </>
  );
}

function Calendar({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [edit, setEdit] = useState<any>(null);
  const posts = useQuery({ queryKey: ['posts', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/posts`) });
  const plan = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/marketing/posts/plan-matches`, { count: 8 }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['posts', leagueId] }); alert(`${r.created} match-day posts added as drafts.`); } });
  const days = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const byDay = (d: Date) => (posts.data ?? []).filter((p) => new Date(p.scheduledAt).toDateString() === d.toDateString());
  const counts = (posts.data ?? []).reduce<Record<string, number>>((a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }), {});
  const newPost = (d?: Date) => { const at = d ? new Date(d) : new Date(); at.setHours(18, 0, 0, 0); setEdit({ title: '', type: 'OTHER', channels: ['INSTAGRAM'], scheduledAt: localInput(at), caption: '', assets: [], status: 'DRAFT', assigneeId: '', deliverableId: '', matchId: '' }); };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1"><Button size="sm" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button><span className="w-40 text-center font-semibold">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><Button size="sm" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button></div>
        <div className="flex flex-wrap gap-3 text-xs text-ink-500">{Object.keys(STATUS).map((s) => <span key={s} className="flex items-center gap-1"><span className={cx('h-2 w-2 rounded-full', STATUS_DOT[s])} />{s.replace('_', ' ').toLowerCase()} ({counts[s] ?? 0})</span>)}</div>
        <span className="flex-1" />
        <Button variant="secondary" loading={plan.isPending} onClick={() => plan.mutate()}><Wand2 className="h-4 w-4" />Auto-plan match-day posts</Button>
        <Button onClick={() => newPost()}><Plus className="h-4 w-4" />New post</Button>
      </div>
      {posts.isLoading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50 text-center text-xs font-semibold text-ink-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const items = byDay(d);
              const other = d.getMonth() !== month.getMonth();
              const today = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} onDoubleClick={() => newPost(d)} className={cx('min-h-[104px] border-b border-r border-ink-100 p-1.5', other && 'bg-ink-50/50')}>
                  <p className={cx('mb-1 text-xs font-semibold', other ? 'text-ink-300' : 'text-ink-500', today && 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white')}>{d.getDate()}</p>
                  <div className="space-y-1">{items.slice(0, 3).map((p) => (
                    <button key={p.id} onClick={() => setEdit({ ...p, scheduledAt: localInput(p.scheduledAt), assigneeId: p.assigneeId ?? '', deliverableId: p.deliverableId ?? '', matchId: p.matchId ?? '' })} className="flex w-full items-center gap-1 truncate rounded bg-white px-1.5 py-0.5 text-left text-[11px] shadow-sm ring-1 ring-ink-100 hover:ring-brand-300">
                      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[p.status])} /><span className="truncate">{p.title}</span>
                    </button>
                  ))}{items.length > 3 && <p className="text-[10px] text-ink-500">+{items.length - 3} more</p>}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">Double-click a day to add a post. Posts linked to a sponsor deliverable count toward it automatically when published.</p>
      {edit && <PostModal leagueId={leagueId} post={edit} onClose={() => { setEdit(null); qc.invalidateQueries({ queryKey: ['posts', leagueId] }); }} />}
    </>
  );
}

function PostModal({ leagueId, post: p, onClose }: { leagueId: string; post: any; onClose: () => void }) {
  const [f, setF] = useState(p);
  const members = useQuery({ queryKey: ['crm', leagueId], queryFn: () => get(`/leagues/${leagueId}/crm`) });
  const dels = useQuery({ queryKey: ['deliverables', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/crm/deliverables`) });
  const assets = useQuery({ queryKey: ['assets', leagueId, ''], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/assets`) });
  const [pick, setPick] = useState(false);
  const body = () => ({ title: f.title, type: f.type, channels: f.channels, scheduledAt: new Date(f.scheduledAt).toISOString(), caption: f.caption || null, assets: f.assets, assigneeId: f.assigneeId || null, deliverableId: f.deliverableId || null, matchId: f.matchId || null, publishedUrl: f.publishedUrl || null });
  const save = useMutation({ mutationFn: (status?: string) => (p.id ? patch(`/leagues/${leagueId}/marketing/posts/${p.id}`, { ...body(), ...(status && { status }) }) : post(`/leagues/${leagueId}/marketing/posts`, { ...body(), status: status ?? f.status })), onSuccess: onClose });
  const remove = useMutation({ mutationFn: () => del(`/leagues/${leagueId}/marketing/posts/${p.id}`), onSuccess: onClose });
  const digital = (dels.data ?? []).flatMap((d) => d.deliverables.filter((x: any) => ['DIGITAL', 'OTHER'].includes(x.channel) && x.delivered < x.quantity).map((x: any) => ({ value: x.id, label: `${d.company}: ${x.title} (${x.delivered}/${x.quantity})` })));
  const st = p.status;
  return (
    <Modal open onClose={onClose} size="lg" title={p.id ? 'Edit post' : 'New post'}
      footer={<>
        {p.id && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => confirm('Delete this post?') && remove.mutate()}><Trash2 className="h-4 w-4" /></Button>}
        <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>
        {['IDEA', 'DRAFT'].includes(st) && <Button variant="secondary" onClick={() => save.mutate('IN_REVIEW')}>Send for review</Button>}
        {st === 'IN_REVIEW' && <Button onClick={() => save.mutate('APPROVED')}>Approve</Button>}
        {st === 'APPROVED' && <Button variant="success" onClick={() => save.mutate('PUBLISHED')}>Mark published</Button>}
      </>}>
      <div className="space-y-3">
        <ErrorText error={save.error} />
        {p.id && <Badge color={STATUS[st]}>{st.replace('_', ' ').toLowerCase()}</Badge>}
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={Object.entries(TYPES).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Scheduled"><Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></Field>
          <Field label="Assigned to"><Select value={f.assigneeId ?? ''} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} placeholder="—" options={(members.data?.owners ?? []).map((o: any) => ({ value: o.id, label: o.name }))} /></Field>
        </div>
        <div><p className="label">Channels</p><div className="flex flex-wrap gap-2">{CHANNELS.map((c) => <label key={c} className={cx('cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold', f.channels.includes(c) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')}><input type="checkbox" className="hidden" checked={f.channels.includes(c)} onChange={(e) => setF({ ...f, channels: e.target.checked ? [...f.channels, c] : f.channels.filter((x: string) => x !== c) })} />{c.toLowerCase()}</label>)}</div></div>
        <Field label="Caption"><Textarea rows={4} value={f.caption ?? ''} onChange={(e) => setF({ ...f, caption: e.target.value })} /></Field>
        <div>
          <p className="label">Creatives</p>
          <Attachments urls={f.assets} />
          <div className="mt-2 flex gap-2"><UploadButton label="Upload" onAdd={(a) => setF({ ...f, assets: [...f.assets, ...a] })} /><Button size="sm" variant="secondary" onClick={() => setPick(!pick)}><ImageIcon className="h-3.5 w-3.5" />From library</Button>{f.assets.length > 0 && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, assets: [] })}>Clear</Button>}</div>
          {pick && <div className="mt-2 grid max-h-48 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-ink-200 p-2">{(assets.data ?? []).filter((a) => a.kind !== 'DOCUMENT').map((a) => <button key={a.id} onClick={() => setF({ ...f, assets: [...f.assets, a.url] })} title={a.title}><img src={a.url} alt={a.title} className="h-16 w-full rounded object-cover" /></button>)}</div>}
        </div>
        <Field label="Counts toward sponsor deliverable (optional)"><Select value={f.deliverableId ?? ''} onChange={(e) => setF({ ...f, deliverableId: e.target.value })} placeholder="— none —" options={digital} /></Field>
        {['APPROVED', 'PUBLISHED'].includes(st) && <Field label="Published link"><Input value={f.publishedUrl ?? ''} onChange={(e) => setF({ ...f, publishedUrl: e.target.value })} placeholder="https://instagram.com/p/…" /></Field>}
      </div>
    </Modal>
  );
}

function Assets({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['assets', leagueId, tag + q], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/assets?${new URLSearchParams({ ...(tag && { tag }), ...(q && { q }) })}`) });
  const [up, setUp] = useState<{ items: { title: string; url: string; kind: string }[]; tags: string } | null>(null);
  const save = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/marketing/assets`, { items: up!.items, tags: up!.tags.split(',') }), onSuccess: () => { setUp(null); qc.invalidateQueries({ queryKey: ['assets', leagueId] }); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/marketing/assets/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['assets', leagueId] }) });
  const allTags = [...new Set((list.data ?? []).flatMap((a) => a.tags))].sort();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input className="w-56" placeholder="Search titles" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">{tag && <Badge color="blue" className="cursor-pointer" ><button onClick={() => setTag('')}>#{tag} ✕</button></Badge>}{!tag && allTags.slice(0, 12).map((t) => <button key={t} onClick={() => setTag(t)} className="rounded-full border border-ink-200 px-2 py-0.5 text-xs hover:bg-ink-50">#{t}</button>)}</div>
        <span className="flex-1" />
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"><Plus className="h-4 w-4" />Upload creatives
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            if (files.some((x) => x.size > 5e6)) return alert('Each file must be under 5 MB');
            const items = await Promise.all(files.map(async (x) => ({ title: x.name.replace(/\.[^.]+$/, ''), kind: x.type === 'application/pdf' ? 'DOCUMENT' : 'IMAGE', url: await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(x); }) })));
            setUp({ items, tags: '' }); e.target.value = '';
          }} />
        </label>
      </div>
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Card><Empty icon={<ImageIcon className="h-5 w-5" />} title="No creatives yet" text="Upload posters, match graphics, logos and photos. Tag them by team, match or sponsor to find them later." /></Card> : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.data.map((a) => (
            <div key={a.id} className="card group overflow-hidden">
              <a href={a.url} target="_blank" rel="noreferrer">{a.kind === 'DOCUMENT' ? <div className="flex h-32 items-center justify-center bg-ink-50"><FileText className="h-8 w-8 text-ink-400" /></div> : <img src={a.url} alt={a.title} className="h-32 w-full object-cover" />}</a>
              <div className="p-2"><div className="flex items-start justify-between gap-1"><p className="truncate text-xs font-semibold">{a.title}</p><button onClick={() => confirm('Delete this asset?') && remove.mutate(a.id)} className="text-ink-300 opacity-0 hover:text-red-600 group-hover:opacity-100" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div><p className="truncate text-[10px] text-ink-500">{a.tags.map((t: string) => `#${t}`).join(' ') || 'untagged'}</p></div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!up} onClose={() => setUp(null)} title={`Add ${up?.items.length} file(s)`} footer={<><Button variant="secondary" onClick={() => setUp(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save to library</Button></>}>
        {up && <div className="space-y-3">
          <ErrorText error={save.error} />
          {up.items.map((it, i) => <Input key={i} value={it.title} onChange={(e) => setUp({ ...up, items: up.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />)}
          <Field label="Tags" hint="Comma separated — e.g. match-5, mumbai-mavericks, freshbrew, poster"><Input value={up.tags} onChange={(e) => setUp({ ...up, tags: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  );
}

function Contacts({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['media-contacts', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/contacts`) });
  const [f, setF] = useState<any>(null);
  const [imp, setImp] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['media-contacts', leagueId] });
  const save = useMutation({ mutationFn: () => (f.id ? patch(`/leagues/${leagueId}/marketing/contacts/${f.id}`, f) : post(`/leagues/${leagueId}/marketing/contacts`, f)), onSuccess: () => { setF(null); refresh(); } });
  const doImport = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/marketing/contacts/import`, { text: imp }), onSuccess: (r) => { setImp(null); refresh(); alert(`${r.imported} contacts imported.`); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/marketing/contacts/${id}`), onSuccess: refresh });
  return (
    <>
      <div className="mb-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setImp('')}>Bulk import</Button><Button onClick={() => setF({ name: '', outlet: '', kind: 'Digital', beat: 'Cricket', email: '', phone: '', city: '' })}><Plus className="h-4 w-4" />Add contact</Button></div>
      <Card padded={false}>
        <Table head={['Name', 'Outlet', 'Type', 'Beat', 'Email', 'Phone', 'City', '']} empty={!list.data?.length && <Empty icon={<Newspaper className="h-5 w-5" />} title="No media contacts yet" text="Build your list of journalists, channels and creators to send press releases." />}>
          {list.data?.map((c) => (
            <tr key={c.id}>
              <td className="td font-medium text-ink-900">{c.name}</td><td className="td">{c.outlet}</td><td className="td"><Badge>{c.kind}</Badge></td><td className="td">{c.beat ?? '—'}</td><td className="td">{c.email ?? '—'}</td><td className="td">{c.phone ?? '—'}</td><td className="td">{c.city ?? '—'}</td>
              <td className="td text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setF({ ...c, email: c.email ?? '', phone: c.phone ?? '', city: c.city ?? '', beat: c.beat ?? '' })}>Edit</Button><button onClick={() => remove.mutate(c.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>
          ))}
        </Table>
      </Card>
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? 'Edit contact' : 'Add media contact'} footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button loading={save.isPending} disabled={!f?.name || !f?.outlet} onClick={() => save.mutate()}>Save</Button></>}>
        {f && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={save.error} /></div>
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Outlet"><Input value={f.outlet} onChange={(e) => setF({ ...f, outlet: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={['Print', 'TV', 'Digital', 'Radio', 'Agency', 'Influencer']} /></Field>
          <Field label="Beat"><Input value={f.beat} onChange={(e) => setF({ ...f, beat: e.target.value })} /></Field>
          <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={imp !== null} onClose={() => setImp(null)} title="Bulk import contacts" footer={<><Button variant="secondary" onClick={() => setImp(null)}>Cancel</Button><Button loading={doImport.isPending} disabled={!imp} onClick={() => doImport.mutate()}>Import</Button></>}>
        <ErrorText error={doImport.error} />
        <p className="mb-2 text-sm text-ink-500">One contact per line: <b>Name, Outlet, Email, Phone, Type, City</b> (paste from Excel works too).</p>
        <Textarea rows={8} value={imp ?? ''} onChange={(e) => setImp(e.target.value)} placeholder={'Ritika Rao, Mumbai Sports Daily, ritika@example.com, 9800000000, Print, Mumbai'} />
      </Modal>
    </>
  );
}

function Releases({ leagueId }: { leagueId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useLeague();
  const list = useQuery({ queryKey: ['releases', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/releases`) });
  const contacts = useQuery({ queryKey: ['media-contacts', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/marketing/contacts`) });
  const [open, setOpen] = useState<any>(null);
  const [sendTo, setSendTo] = useState<string[] | null>(null);
  const [cov, setCov] = useState({ outlet: '', url: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['releases', leagueId] });
  const create = useMutation({ mutationFn: (template: string) => post(`/leagues/${leagueId}/marketing/releases`, { template }), onSuccess: (r) => { refresh(); setOpen(r); } });
  const save = useMutation({ mutationFn: (b: any) => patch(`/leagues/${leagueId}/marketing/releases/${open.id}`, b), onSuccess: (r) => { setOpen(r); setCov({ outlet: '', url: '' }); refresh(); } });
  const send = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/marketing/releases/${open.id}/send`, { contactIds: sendTo }), onSuccess: (r) => { setSendTo(null); setOpen(null); refresh(); alert(`Sent to ${r.sent} contacts.`); } });
  const templates = [['launch', 'League launch'], ['auction', 'Auction results'], ['result', 'Latest match result'], ['standings', 'Points table update'], ['sponsor', 'New sponsor'], ['champions', 'Champions']];
  return (
    <>
      <Card className="mb-4">
        <p className="label flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-amber-500" />Draft from your league data</p>
        <div className="flex flex-wrap gap-2">{templates.map(([k, l]) => <Button key={k} size="sm" variant="secondary" loading={create.isPending && create.variables === k} onClick={() => create.mutate(k)}>{l}</Button>)}</div>
        <ErrorText error={create.error} />
      </Card>
      <Card padded={false}>
        <Table head={['Title', 'Status', 'Sent', 'Coverage', 'Updated', '']} empty={!list.data?.length && <Empty icon={<Newspaper className="h-5 w-5" />} title="No press releases yet" />}>
          {list.data?.map((r) => (
            <tr key={r.id}>
              <td className="td font-medium text-ink-900">{r.title}</td>
              <td className="td"><Badge color={r.status === 'SENT' ? 'green' : r.status === 'APPROVED' ? 'blue' : 'gray'}>{r.status.toLowerCase()}</Badge></td>
              <td className="td">{r.sentAt ? `${date(r.sentAt)} · ${r.sentTo} contacts` : '—'}</td>
              <td className="td">{r.coverage.length}</td><td className="td">{ago(r.updatedAt)}</td>
              <td className="td text-right"><Button size="sm" variant="secondary" onClick={() => setOpen(r)}>Open</Button></td>
            </tr>
          ))}
        </Table>
      </Card>
      {open && (
        <Modal open onClose={() => setOpen(null)} size="xl" title={<span className="flex items-center gap-2">Press release <Badge color={open.status === 'SENT' ? 'green' : open.status === 'APPROVED' ? 'blue' : 'gray'}>{open.status.toLowerCase()}</Badge></span>}
          footer={<>
            {open.status === 'DRAFT' && <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate({ title: open.title, body: open.body })}>Save draft</Button>}
            {open.status === 'DRAFT' && isAdmin && <Button onClick={() => save.mutate({ title: open.title, body: open.body, status: 'APPROVED' })}>Approve</Button>}
            {open.status === 'APPROVED' && <Button onClick={() => setSendTo((contacts.data ?? []).filter((c) => c.email).map((c) => c.id))}><Send className="h-4 w-4" />Send to media</Button>}
          </>}>
          <div className="space-y-3">
            <ErrorText error={save.error} />
            {open.status === 'DRAFT' && !isAdmin && <p className="text-xs text-amber-700">The league owner approves releases before they can be sent.</p>}
            <Input value={open.title} disabled={open.status === 'SENT'} onChange={(e) => setOpen({ ...open, title: e.target.value })} className="font-semibold" />
            <Textarea rows={14} value={open.body} disabled={open.status === 'SENT'} onChange={(e) => setOpen({ ...open, body: e.target.value })} />
            {open.status !== 'DRAFT' && open.approvedBy && <p className="text-xs text-ink-500">Approved by {open.approvedBy}{open.status === 'APPROVED' && ' — editing sends it back to draft.'}</p>}
            {open.status === 'SENT' && (
              <div>
                <p className="label">Coverage</p>
                <ul className="mb-2 space-y-1 text-sm">{open.coverage.map((c: any, i: number) => <li key={i}><a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline"><ExternalLink className="h-3 w-3" />{c.outlet}</a> <span className="text-xs text-ink-400">{c.date}</span></li>)}</ul>
                <div className="flex gap-2"><Input placeholder="Outlet" value={cov.outlet} onChange={(e) => setCov({ ...cov, outlet: e.target.value })} /><Input placeholder="https://…" value={cov.url} onChange={(e) => setCov({ ...cov, url: e.target.value })} /><Button variant="secondary" disabled={!cov.outlet || !cov.url} onClick={() => save.mutate({ addCoverage: cov })}><Link2 className="h-4 w-4" />Add</Button></div>
              </div>
            )}
          </div>
        </Modal>
      )}
      <Modal open={!!sendTo} onClose={() => setSendTo(null)} title="Send press release" footer={<><Button variant="secondary" onClick={() => setSendTo(null)}>Cancel</Button><Button loading={send.isPending} disabled={!sendTo?.length} onClick={() => send.mutate()}><Mail className="h-4 w-4" />Send to {sendTo?.length} contacts</Button></>}>
        <ErrorText error={send.error} />
        {!contacts.data?.some((c) => c.email) ? <p className="text-sm text-ink-500">Add media contacts with email addresses first.</p> : (
          <div className="max-h-72 space-y-1 overflow-y-auto">{contacts.data.filter((c) => c.email).map((c) => <label key={c.id} className="flex items-center gap-2 p-1.5 text-sm"><input type="checkbox" checked={sendTo?.includes(c.id)} onChange={(e) => setSendTo(e.target.checked ? [...(sendTo ?? []), c.id] : (sendTo ?? []).filter((x) => x !== c.id))} />{c.name} <span className="text-xs text-ink-500">{c.outlet} · {c.email}</span></label>)}</div>
        )}
      </Modal>
    </>
  );
}
