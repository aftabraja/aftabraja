import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, ExternalLink, Plus, ScanLine, Ticket, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date, inr, inrShort } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, StatusBadge, Table, Tabs } from '../../components/ui';

export default function Ticketing() {
  const { leagueId, league } = useLeague();
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ['tickets', leagueId], queryFn: () => get(`/leagues/${leagueId}/tickets`) });
  const matches = useQuery({ queryKey: ['matches', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/matches`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['tickets', leagueId] });
  const [tab, setTab] = useState<'categories' | 'orders' | 'gate' | 'promos'>('categories');
  const [cat, setCat] = useState<any>(null);
  const [box, setBox] = useState<any>(null);
  const [code, setCode] = useState('');
  const saveCat = useMutation({ mutationFn: () => { const b = { name: cat.name, price: cat.price, quantity: cat.quantity, matchId: cat.matchId || null, isActive: cat.isActive }; return cat.id ? patch(`/leagues/${leagueId}/tickets/categories/${cat.id}`, b) : post(`/leagues/${leagueId}/tickets/categories`, b); }, onSuccess: () => { setCat(null); refresh(); } });
  const delCat = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/tickets/categories/${id}`), onSuccess: refresh });
  const issue = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/tickets/box-office`, box), onSuccess: (o) => { setBox(null); refresh(); window.open(`/ticket/${o.code}`, '_blank'); } });
  const checkin = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/tickets/checkin`, { code }), onSuccess: () => { setCode(''); refresh(); } });
  if (t.isLoading) return <Spinner />;
  const { categories, orders, summary } = t.data;
  const matchLabel = (m: any) => `Match ${m.number}: ${m.homeTeam?.name ?? m.homeLabel ?? 'TBD'} vs ${m.awayTeam?.name ?? m.awayLabel ?? 'TBD'}`;

  return (
    <>
      <PageHeader title="Ticketing" subtitle="Sell tickets online from your public match centre, issue box-office tickets and scan QR codes at the gate."
        actions={<>{league && <a href={`/l/${league.slug}#tickets`} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" />Public ticket page</Button></a>}<Button onClick={() => setCat({ name: '', price: '', quantity: '', matchId: '', isActive: true })}><Plus className="h-4 w-4" />Ticket category</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ticket revenue" value={inrShort(summary.revenue)} tone="green" />
        <Stat label="Tickets sold" value={summary.ticketsSold.toLocaleString('en-IN')} sub={`of ${summary.capacity.toLocaleString('en-IN')} capacity`} />
        <Stat label="Occupancy" value={`${summary.capacity ? Math.round((summary.ticketsSold / summary.capacity) * 100) : 0}%`} />
        <Stat label="Entered at gate" value={summary.checkedIn.toLocaleString('en-IN')} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'categories', label: 'Categories' }, { value: 'orders', label: `Orders (${orders.length})` }, { value: 'gate', label: 'Gate check-in' }, { value: 'promos', label: 'Promo codes' }]} />
      {tab === 'promos' && <Promos categories={categories} />}
      {tab === 'categories' && (!categories.length ? <Card><Empty icon={<Ticket className="h-5 w-5" />} title="No ticket categories" text="Create categories like General, Pavilion and VIP — for the whole season or a specific match." /></Card> : (
        <Card padded={false}>
          <Table head={['Category', 'Valid for', 'Price', 'Sold', '', 'Status', '']}>
            {categories.map((c: any) => (
              <tr key={c.id}>
                <td className="td font-semibold text-ink-900">{c.name}</td><td className="td">{c.match ? matchLabel(c.match) : 'Season / any match'}</td><td className="td">{inr(c.price)}</td>
                <td className="td">{c.sold}/{c.quantity}</td><td className="td w-40"><Progress value={(c.sold / c.quantity) * 100} /></td>
                <td className="td">{c.isActive ? <StatusBadge status="OPEN" /> : <StatusBadge status="CLOSED" />}</td>
                <td className="td text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="secondary" onClick={() => setBox({ categoryId: c.id, qty: 1, buyerName: '', email: '', phone: '', complimentary: false })}>Box office</Button><Button size="sm" variant="ghost" onClick={() => setCat({ ...c, matchId: c.matchId ?? '' })}>Edit</Button><button onClick={() => confirm('Delete category?') && delCat.mutate(c.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
          <div className="px-5 py-3"><ErrorText error={delCat.error} /></div>
        </Card>
      ))}
      {tab === 'orders' && (
        <Card padded={false}>
          <Table head={['Code', 'Buyer', 'Category', 'Qty', 'Amount', 'Entered', 'Status', 'When']} empty={!orders.length && <Empty title="No orders yet" />}>
            {orders.map((o: any) => <tr key={o.id}><td className="td"><a href={`/ticket/${o.code}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-brand-700 hover:underline">{o.code}</a></td><td className="td"><p className="text-ink-900">{o.buyerName}</p><p className="text-xs text-ink-500">{o.email}</p></td><td className="td">{o.category.name}</td><td className="td">{o.qty}</td><td className="td">{inr(o.amount)}</td><td className="td">{o.checkedIn}/{o.qty}</td><td className="td"><StatusBadge status={o.status} /></td><td className="td">{ago(o.createdAt)}</td></tr>)}
          </Table>
        </Card>
      )}
      {tab === 'gate' && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); if (code) checkin.mutate(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Ticket code" hint="Type, or use a USB / Bluetooth QR scanner — it types the code and presses Enter" className="flex-1"><Input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TK-…" /></Field>
            <Button size="lg" loading={checkin.isPending}><ScanLine className="h-4 w-4" />Admit</Button>
          </form>
          <div className="mt-4">
            <ErrorText error={checkin.error} />
            {checkin.data && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800"><p className="text-lg font-bold">✓ Admit — {checkin.data.buyerName}</p><p className="text-sm">{checkin.data.category.name} · {checkin.data.checkedIn} of {checkin.data.qty} entries used</p></div>}
          </div>
        </Card>
      )}
      <Modal open={!!cat} onClose={() => setCat(null)} title={cat?.id ? 'Edit ticket category' : 'New ticket category'} footer={<><Button variant="secondary" onClick={() => setCat(null)}>Cancel</Button><Button loading={saveCat.isPending} onClick={() => saveCat.mutate()}>Save</Button></>}>
        {cat && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={saveCat.error} /></div>
          <Field label="Name" className="col-span-2"><Input value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="General Stand, Pavilion, VIP Box…" /></Field>
          <Field label="Price (₹)" hint="0 = free registration"><Input type="number" value={cat.price} onChange={(e) => setCat({ ...cat, price: e.target.value })} /></Field>
          <Field label="Quantity"><Input type="number" value={cat.quantity} onChange={(e) => setCat({ ...cat, quantity: e.target.value })} /></Field>
          <Field label="Valid for" className="col-span-2"><Select value={cat.matchId} onChange={(e) => setCat({ ...cat, matchId: e.target.value })} placeholder="Season pass / any match" options={(matches.data ?? []).map((m) => ({ value: m.id, label: matchLabel(m) }))} /></Field>
          <Field label="On sale"><Select value={cat.isActive ? 'y' : 'n'} onChange={(e) => setCat({ ...cat, isActive: e.target.value === 'y' })} options={[{ value: 'y', label: 'Yes' }, { value: 'n', label: 'No' }]} /></Field>
        </div>}
      </Modal>
      <Modal open={!!box} onClose={() => setBox(null)} title="Box office — issue tickets" footer={<><Button variant="secondary" onClick={() => setBox(null)}>Cancel</Button><Button disabled={!box?.buyerName} loading={issue.isPending} onClick={() => issue.mutate()}>Issue & print</Button></>}>
        {box && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={issue.error} /></div>
          <Field label="Name" className="col-span-2"><Input value={box.buyerName} onChange={(e) => setBox({ ...box, buyerName: e.target.value })} /></Field>
          <Field label="Quantity"><Input type="number" min={1} value={box.qty} onChange={(e) => setBox({ ...box, qty: Number(e.target.value) })} /></Field>
          <Field label="Type"><Select value={box.complimentary ? 'comp' : 'cash'} onChange={(e) => setBox({ ...box, complimentary: e.target.value === 'comp' })} options={[{ value: 'cash', label: 'Paid at counter' }, { value: 'comp', label: 'Complimentary' }]} /></Field>
          <Field label="Email (optional)"><Input value={box.email} onChange={(e) => setBox({ ...box, email: e.target.value })} /></Field>
          <Field label="Phone (optional)"><Input value={box.phone} onChange={(e) => setBox({ ...box, phone: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  );
}

function Promos({ categories }: { categories: any[] }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['promos', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/tickets/promos`) });
  const [f, setF] = useState<any>(null);
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/tickets/promos`, { ...f, value: Number(f.value), maxUses: f.maxUses ? Number(f.maxUses) : null, minQty: Number(f.minQty) || 1, validFrom: f.validFrom || null, validTo: f.validTo || null }), onSuccess: () => { setF(null); q.refetch(); } });
  const toggle = useMutation({ mutationFn: (p: any) => patch(`/leagues/${leagueId}/tickets/promos/${p.id}`, { active: !p.active }), onSuccess: () => q.refetch() });
  return (
    <Card padded={false} title={<span className="flex items-center gap-2"><BadgePercent className="h-4 w-4" />Promo codes</span>} action={<Button size="sm" onClick={() => setF({ code: '', kind: 'PERCENT', value: 10, maxUses: '', minQty: 1, categoryIds: [], validFrom: '', validTo: '' })}><Plus className="h-3.5 w-3.5" />New code</Button>}>
      {q.isLoading ? <Spinner /> : (
        <Table head={['Code', 'Offer', 'Applies to', 'Uses', 'Tickets', 'Discount given', 'Net revenue', 'Valid till', '']} empty={!q.data?.length && <Empty icon={<BadgePercent className="h-5 w-5" />} title="No promo codes" text="Create codes for students, early birds, corporate groups or sponsor giveaways. Fans enter them at checkout." />}>
          {q.data?.map((p) => (
            <tr key={p.id}>
              <td className="td font-mono font-semibold text-ink-900">{p.code}</td>
              <td className="td">{p.kind === 'PERCENT' ? `${p.value}% off` : `${inr(p.value)} off`}{p.minQty > 1 && <span className="block text-xs text-ink-500">min {p.minQty} tickets</span>}</td>
              <td className="td text-xs">{p.categoryIds.length ? categories.filter((c) => p.categoryIds.includes(c.id)).map((c) => c.name).join(', ') : 'All tickets'}</td>
              <td className="td">{p.used}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
              <td className="td">{p.tickets}</td>
              <td className="td">{inr(p.discountGiven)}</td>
              <td className="td">{inr(p.revenue)}</td>
              <td className="td">{p.validTo ? date(p.validTo) : '—'}</td>
              <td className="td text-right"><button onClick={() => toggle.mutate(p)}><Badge color={p.active ? 'green' : 'gray'}>{p.active ? 'active' : 'paused'}</Badge></button></td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!f} onClose={() => setF(null)} title="New promo code" footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button disabled={!f?.code || f.code.length < 3} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        {f && <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><ErrorText error={create.error} /></div>
          <Field label="Code"><Input className="font-mono uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="STUDENT20" /></Field>
          <Field label="Discount"><div className="flex gap-2"><select className="input w-28" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="PERCENT">% off</option><option value="FLAT">₹ off</option></select><Input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div></Field>
          <Field label="Maximum uses" hint="Blank = unlimited"><Input type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></Field>
          <Field label="Minimum tickets per order"><Input type="number" min={1} max={10} value={f.minQty} onChange={(e) => setF({ ...f, minQty: e.target.value })} /></Field>
          <Field label="Valid from"><Input type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} /></Field>
          <Field label="Valid till"><Input type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></Field>
          <div className="sm:col-span-2"><p className="label">Applies to</p><div className="flex flex-wrap gap-3">{categories.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.categoryIds.includes(c.id)} onChange={(e) => setF({ ...f, categoryIds: e.target.checked ? [...f.categoryIds, c.id] : f.categoryIds.filter((x: string) => x !== c.id) })} />{c.name}</label>)}</div><p className="mt-1 text-xs text-ink-500">Leave all unticked to apply to every ticket type.</p></div>
        </div>}
      </Modal>
    </Card>
  );
}
