import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UsersRound } from 'lucide-react';
import { get, patch } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { inr } from '../../lib/format';
import { Avatar, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Tabs } from '../../components/ui';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'SOLD', 'UNSOLD', 'REJECTED'] as const;

export default function Players() {
  const { leagueId, isStaff } = useLeague();
  const qc = useQueryClient();
  const regs = useQuery({ queryKey: ['registrations', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/registrations`) });
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const [tab, setTab] = useState<'ALL' | (typeof STATUSES)[number]>('ALL');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const update = useMutation({ mutationFn: ({ id, ...b }: any) => patch(`/leagues/${leagueId}/registrations/${id}`, b), onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['registrations', leagueId] }); qc.invalidateQueries({ queryKey: ['teams', leagueId] }); } });

  const rows = useMemo(() => (regs.data ?? []).filter((r) => (tab === 'ALL' || r.status === tab) && (!q || r.player.user.name.toLowerCase().includes(q.toLowerCase()) || r.player.playingRole?.toLowerCase().includes(q.toLowerCase()))), [regs.data, tab, q]);
  const count = (s: string) => regs.data?.filter((r) => r.status === s).length ?? 0;

  return (
    <>
      <PageHeader title="Players" subtitle="Registrations, shortlisting, categories, base prices and squad allocation." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ALL', label: `All (${regs.data?.length ?? 0})` }, ...STATUSES.map((s) => ({ value: s, label: `${s[0]}${s.slice(1).toLowerCase()} (${count(s)})` }))]} />
      <Card padded={false}>
        <div className="border-b border-ink-100 p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Search name or role" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        {regs.isLoading ? <Spinner /> : (
          <Table head={['Player', 'Role', 'Style', 'Record', 'Category', 'Base price', 'Status', 'Team', '']}
            empty={!rows.length && <Empty icon={<UsersRound className="h-5 w-5" />} title="No players here" text="Players register from their SportsIQ player portal. Share your league with them." />}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/50">
                <td className="td"><div className="flex items-center gap-3"><Avatar name={r.player.user.name} size={32} /><div><p className="font-medium text-ink-900">{r.player.user.name}</p><p className="text-xs text-ink-500">{r.player.city ?? ''}</p></div></div></td>
                <td className="td">{r.player.playingRole ?? '—'}</td>
                <td className="td text-xs">{[r.player.battingStyle, r.player.bowlingStyle].filter(Boolean).join(' · ') || '—'}</td>
                <td className="td text-xs">{r.player.matches}M · {r.player.runs}R · {r.player.wickets}W</td>
                <td className="td">{r.category ?? '—'}</td>
                <td className="td">{inr(r.basePrice)}</td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td">{r.team ? `${r.team.name}${r.soldPrice ? ` · ${inr(r.soldPrice)}` : ''}` : '—'}</td>
                <td className="td text-right">{isStaff && <Button size="sm" variant="secondary" onClick={() => setEdit({ id: r.id, name: r.player.user.name, status: r.status, category: r.category ?? '', basePrice: r.basePrice ?? '', soldPrice: r.soldPrice ?? '', teamId: r.teamId ?? '' })}>Manage</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`Manage ${edit.name}`} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => update.mutate({ ...edit, name: undefined, basePrice: edit.basePrice || null, soldPrice: edit.soldPrice || null, teamId: edit.teamId || null, category: edit.category || null })}>Save</Button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={[...STATUSES]} /></Field>
            <Field label="Category"><Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="—" options={['Icon', 'A', 'B', 'C', 'Emerging', 'Overseas']} /></Field>
            <Field label="Base price (₹)"><Input type="number" value={edit.basePrice} onChange={(e) => setEdit({ ...edit, basePrice: e.target.value })} /></Field>
            <Field label="Sold price (₹)"><Input type="number" value={edit.soldPrice} onChange={(e) => setEdit({ ...edit, soldPrice: e.target.value })} /></Field>
            <Field label="Team" className="col-span-2"><Select value={edit.teamId} onChange={(e) => setEdit({ ...edit, teamId: e.target.value })} placeholder="Not assigned" options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
