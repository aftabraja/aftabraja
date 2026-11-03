import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { inr, inrShort } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Stat, StatusBadge, Textarea } from '../../components/ui';

export const TIER_TEMPLATES: Record<string, string[]> = {
  Title: ['League naming rights', 'Logo on all jerseys (chest)', 'Trophy branding', 'All broadcast graphics', 'Press conference backdrop'],
  'Powered By': ['"Powered by" logo lock-up', 'Jersey sleeve logo', 'LED exposure every match'],
  Associate: ['Logo on boundary boards', 'Digital mentions', 'Hospitality passes'],
  Jersey: ['Logo on jersey (position as agreed)', 'Logo on training kits'],
  'On-ground': ['Boundary boards', 'Sight-screen branding', 'Toss area branding'],
  Broadcast: ['On-screen graphic', 'Commentator mentions', 'Replay sponsor'],
  Digital: ['Instagram reels', 'YouTube shorts', 'Contest integration', 'Website banner'],
  Hospitality: ['VIP box', 'Meet & greet with players', 'Award presentation'],
  'Official Partner': ['"Official partner" category rights', 'Logo on website', 'Product sampling'],
};

export default function Sponsorships() {
  const { leagueId, isStaff } = useLeague();
  const qc = useQueryClient();
  const opps = useQuery({ queryKey: ['opps', leagueId], queryFn: () => get<any[]>(`/sponsors/leagues/${leagueId}/opportunities`) });
  const [edit, setEdit] = useState<any>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['opps', leagueId] });
  const setStatus = useMutation({ mutationFn: ({ id, status }: any) => patch(`/sponsors/leagues/${leagueId}/opportunities/${id}`, { status }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/sponsors/leagues/${leagueId}/opportunities/${id}`), onSuccess: refresh });
  const data = opps.data ?? [];
  const total = data.reduce((s, o) => s + o.price * o.slots, 0);
  const sold = data.filter((o) => o.status === 'SOLD').reduce((s, o) => s + o.price * o.slots, 0);

  return (
    <>
      <PageHeader title="Sponsorship Opportunities" subtitle="Build your inventory. Sponsors on SportsIQ see open opportunities and can contact you directly."
        actions={isStaff && <Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />New opportunity</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Inventory value" value={inrShort(total)} sub={`${data.length} opportunities`} />
        <Stat label="Sold" value={inrShort(sold)} tone="green" sub={`${data.filter((o) => o.status === 'SOLD').length} closed`} />
        <Stat label="In discussion" value={data.filter((o) => o.status === 'IN_DISCUSSION').length} sub="active sponsor conversations" />
      </div>
      {opps.isLoading ? <Spinner /> : !data.length ? (
        <Card><Empty icon={<Megaphone className="h-5 w-5" />} title="No sponsorship inventory yet" text="Start with Title, Powered By and Jersey slots, then add on-ground, broadcast and digital assets." action={isStaff && <Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />Create first opportunity</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <div key={o.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div><Badge color="violet">{o.tier}</Badge><p className="mt-2 text-lg font-bold">{o.title}</p></div>
                <StatusBadge status={o.status} />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-brand-700">{inr(o.price)}{o.slots > 1 && <span className="text-sm font-medium text-ink-500"> × {o.slots} slots</span>}</p>
              {o.description && <p className="mt-2 text-sm text-ink-500">{o.description}</p>}
              <ul className="mt-3 flex-1 space-y-1.5">
                {o.deliverables.map((d: string, i: number) => <li key={i} className="flex gap-2 text-sm text-ink-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{d}</li>)}
              </ul>
              {isStaff && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                  {o.status !== 'SOLD' && <Button size="sm" variant="success" onClick={() => setStatus.mutate({ id: o.id, status: 'SOLD' })}>Mark sold</Button>}
                  {o.status === 'SOLD' && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: o.id, status: 'OPEN' })}>Reopen</Button>}
                  <Button size="sm" variant="secondary" onClick={() => setEdit(o)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => confirm('Delete this opportunity?') && remove.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {edit && <OppModal opp={edit} leagueId={leagueId} onClose={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function OppModal({ opp, leagueId, onClose }: { opp: any; leagueId: string; onClose: () => void }) {
  const tiers = useQuery({ queryKey: ['tiers'], queryFn: () => get<string[]>('/sponsors/tiers') });
  const [f, setF] = useState({ title: opp.title ?? '', tier: opp.tier ?? 'Title', description: opp.description ?? '', price: opp.price ?? '', slots: opp.slots ?? 1, deliverables: (opp.deliverables ?? TIER_TEMPLATES.Title) as string[] });
  const [d, setD] = useState('');
  const save = useMutation({ mutationFn: () => opp.id ? patch(`/sponsors/leagues/${leagueId}/opportunities/${opp.id}`, f) : post(`/sponsors/leagues/${leagueId}/opportunities`, f), onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="lg" title={opp.id ? 'Edit opportunity' : 'New sponsorship opportunity'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorText error={save.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tier"><Select value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value, deliverables: opp.id ? f.deliverables : TIER_TEMPLATES[e.target.value] ?? [] })} options={tiers.data ?? [f.tier]} /></Field>
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title Sponsor" /></Field>
          <Field label="Price (₹)"><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Slots available"><Input type="number" min={1} value={f.slots} onChange={(e) => setF({ ...f, slots: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div>
          <p className="label">Deliverables</p>
          <ul className="space-y-1.5">
            {f.deliverables.map((x, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="flex-1">{x}</span>
                <button onClick={() => setF({ ...f, deliverables: f.deliverables.filter((_, j) => j !== i) })} className="text-ink-400 hover:text-red-600" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input value={d} onChange={(e) => setD(e.target.value)} placeholder="Add deliverable, e.g. 5 Instagram reels" onKeyDown={(e) => { if (e.key === 'Enter' && d.trim()) { e.preventDefault(); setF({ ...f, deliverables: [...f.deliverables, d.trim()] }); setD(''); } }} />
            <Button variant="secondary" onClick={() => { if (d.trim()) { setF({ ...f, deliverables: [...f.deliverables, d.trim()] }); setD(''); } }}>Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
