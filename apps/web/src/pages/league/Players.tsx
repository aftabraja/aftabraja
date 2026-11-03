import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Search, Settings2, UsersRound } from 'lucide-react';
import { get, patch } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { inr } from '../../lib/format';
import { Avatar, Badge, Button, ErrorText, Textarea, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Tabs } from '../../components/ui';

const KYC_COLOR: Record<string, string> = { PENDING: 'gray', SUBMITTED: 'amber', VERIFIED: 'green', REJECTED: 'red' };

function KycReview({ regId, onClose }: { regId: string; onClose: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['kyc', regId], queryFn: () => get(`/leagues/${leagueId}/squads/registrations/${regId}/documents`) });
  const [note, setNote] = useState<Record<string, string>>({});
  const decide = useMutation({ mutationFn: ({ id, status }: any) => patch(`/leagues/${leagueId}/squads/documents/${id}`, { status, note: note[id] || undefined }), onSuccess: () => q.refetch() });
  const d = q.data;
  return (
    <Modal open onClose={onClose} size="lg" title={d ? `KYC — ${d.name}` : 'KYC'} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      {!d ? <Spinner /> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">Status <Badge color={KYC_COLOR[d.kycStatus]}>{d.kycStatus.toLowerCase()}</Badge>{d.dob && <span className="text-ink-500">· DOB {new Date(d.dob).toLocaleDateString('en-IN')}</span>}
            <span className="text-ink-500">· Required: {d.required.map((t: string) => d.docTypes[t]).join(', ') || 'none'}</span></div>
          <ErrorText error={decide.error} />
          {!d.documents.length ? <Empty icon={<FileCheck2 className="h-5 w-5" />} title="No documents yet" text="The player uploads documents from their player portal." /> : (
            <ul className="space-y-2">{d.documents.map((doc: any) => (
              <li key={doc.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="font-medium">{d.docTypes[doc.type]}{doc.number && <span className="ml-2 text-xs text-ink-500">{doc.number}</span>}</p><a className="text-xs text-brand-700 hover:underline" href={doc.fileUrl} target="_blank" rel="noreferrer">Open file</a>{doc.note && <span className="ml-2 text-xs text-ink-500">“{doc.note}”</span>}</div>
                  <Badge color={doc.status === 'VERIFIED' ? 'green' : doc.status === 'REJECTED' ? 'red' : 'amber'}>{doc.status.toLowerCase()}{doc.reviewedBy ? ` · ${doc.reviewedBy}` : ''}</Badge>
                </div>
                {doc.status === 'PENDING' && (
                  <div className="mt-2 flex items-end gap-2">
                    <Textarea rows={1} className="flex-1" placeholder="Reason (needed to reject)" value={note[doc.id] ?? ''} onChange={(e) => setNote({ ...note, [doc.id]: e.target.value })} />
                    <Button size="sm" onClick={() => decide.mutate({ id: doc.id, status: 'VERIFIED' })}>Verify</Button>
                    <Button size="sm" variant="secondary" disabled={!note[doc.id]} onClick={() => decide.mutate({ id: doc.id, status: 'REJECTED' })}>Reject</Button>
                  </div>
                )}
              </li>
            ))}</ul>
          )}
          <p className="mt-3 text-[11px] text-ink-500">Check documents against the originals. Store only what you need and delete it after the season (DPDP Act).</p>
        </>
      )}
    </Modal>
  );
}

function RegistrationRules({ onClose }: { onClose: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['reg-settings', leagueId], queryFn: () => get(`/leagues/${leagueId}/squads/settings`) });
  const [f, setF] = useState<any>(null);
  if (q.data && !f) setF({ ...q.data, regOpensAt: q.data.regOpensAt?.slice(0, 10) ?? '', regClosesAt: q.data.regClosesAt?.slice(0, 10) ?? '', regMaxPlayers: q.data.regMaxPlayers ?? '', minAge: q.data.minAge ?? '', maxAge: q.data.maxAge ?? '' });
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/squads/settings`, { regOpensAt: f.regOpensAt || null, regClosesAt: f.regClosesAt || null, regFee: Number(f.regFee) || 0, regMaxPlayers: f.regMaxPlayers || null, regDocs: f.regDocs, minAge: f.minAge || null, maxAge: f.maxAge || null }), onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="lg" title="Player registration rules" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f} onClick={() => save.mutate()}>Save rules</Button></>}>
      {!f ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ErrorText error={save.error} />
          <Field label="Window opens"><Input type="date" value={f.regOpensAt} onChange={(e) => setF({ ...f, regOpensAt: e.target.value })} /></Field>
          <Field label="Window closes"><Input type="date" value={f.regClosesAt} onChange={(e) => setF({ ...f, regClosesAt: e.target.value })} /></Field>
          <Field label="Registration fee (₹)" hint="0 = free. Collected online; shows in Finance."><Input type="number" min={0} value={f.regFee} onChange={(e) => setF({ ...f, regFee: e.target.value })} /></Field>
          <Field label="Maximum registrations"><Input type="number" min={1} value={f.regMaxPlayers} onChange={(e) => setF({ ...f, regMaxPlayers: e.target.value })} /></Field>
          <Field label="Minimum age"><Input type="number" value={f.minAge} onChange={(e) => setF({ ...f, minAge: e.target.value })} /></Field>
          <Field label="Maximum age"><Input type="number" value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <p className="label">Documents players must upload</p>
            <div className="grid gap-1.5 sm:grid-cols-2">{Object.entries(f.docTypes as Record<string, string>).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.regDocs.includes(k)} onChange={(e) => setF({ ...f, regDocs: e.target.checked ? [...f.regDocs, k] : f.regDocs.filter((x: string) => x !== k) })} />{v}</label>
            ))}</div>
            <p className="mt-2 text-xs text-ink-500">Ask for an NOC when players are contracted to a board, state association or employer. Overseas players typically need one from their home board.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

const STATUSES = ['APPLIED', 'SHORTLISTED', 'SOLD', 'UNSOLD', 'REJECTED'] as const;

export default function Players() {
  const { leagueId, isStaff } = useLeague();
  const qc = useQueryClient();
  const regs = useQuery({ queryKey: ['registrations', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/registrations`) });
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const [tab, setTab] = useState<'ALL' | (typeof STATUSES)[number]>('ALL');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [kyc, setKyc] = useState<any>(null);
  const [rules, setRules] = useState(false);
  const update = useMutation({ mutationFn: ({ id, ...b }: any) => patch(`/leagues/${leagueId}/registrations/${id}`, b), onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['registrations', leagueId] }); qc.invalidateQueries({ queryKey: ['teams', leagueId] }); } });

  const fee = useMutation({ mutationFn: ({ id, status }: any) => patch(`/leagues/${leagueId}/squads/registrations/${id}/fee`, { status }), onSuccess: (r: any) => { setEdit((e: any) => e && { ...e, feeStatus: r.feeStatus }); qc.invalidateQueries({ queryKey: ['registrations', leagueId] }); } });
  const rows = useMemo(() => (regs.data ?? []).filter((r) => (tab === 'ALL' || r.status === tab) && (!q || r.player.user.name.toLowerCase().includes(q.toLowerCase()) || r.player.playingRole?.toLowerCase().includes(q.toLowerCase()))), [regs.data, tab, q]);
  const count = (s: string) => regs.data?.filter((r) => r.status === s).length ?? 0;

  return (
    <>
      <PageHeader title="Players" subtitle="Registrations, KYC, fees, shortlisting, categories, base prices and squad allocation."
        actions={isStaff && <Button variant="secondary" onClick={() => setRules(true)}><Settings2 className="h-4 w-4" />Registration rules</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ALL', label: `All (${regs.data?.length ?? 0})` }, ...STATUSES.map((s) => ({ value: s, label: `${s[0]}${s.slice(1).toLowerCase()} (${count(s)})` }))]} />
      <Card padded={false}>
        <div className="border-b border-ink-100 p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Search name or role" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        {regs.isLoading ? <Spinner /> : (
          <Table head={['Player', 'Role', 'KYC', 'Fee', 'Category', 'Base price', 'Status', 'Team', '']}
            empty={!rows.length && <Empty icon={<UsersRound className="h-5 w-5" />} title="No players here" text="Players register from their SportsIQ player portal. Share your league with them." />}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/50">
                <td className="td"><div className="flex items-center gap-3"><Avatar name={r.player.user.name} size={32} /><div><p className="font-medium text-ink-900">{r.player.user.name}</p><p className="text-xs text-ink-500">{[r.player.city, `${r.player.matches}M · ${r.player.runs}R · ${r.player.wickets}W`].filter(Boolean).join(' · ')}</p></div></div></td>
                <td className="td">{r.player.playingRole ?? '—'}{r.isOverseas && <Badge color="blue" className="ml-1">overseas</Badge>}</td>
                <td className="td">{isStaff ? <button onClick={() => setKyc(r.id)}><Badge color={KYC_COLOR[r.kycStatus]}>{r.kycStatus.toLowerCase()}{r._count?.documents ? ` · ${r._count.documents}` : ''}</Badge></button> : <Badge color={KYC_COLOR[r.kycStatus]}>{r.kycStatus.toLowerCase()}</Badge>}</td>
                <td className="td">{r.feeStatus ? <Badge color={r.feeStatus === 'PENDING' ? 'amber' : r.feeStatus === 'PAID' ? 'green' : 'gray'}>{r.feeStatus.toLowerCase()}</Badge> : <span className="text-xs text-ink-400">—</span>}</td>
                <td className="td">{r.category ?? '—'}</td>
                <td className="td">{inr(r.basePrice)}</td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td">{r.team ? `${r.team.name}${r.soldPrice ? ` · ${inr(r.soldPrice)}` : ''}` : '—'}</td>
                <td className="td text-right">{isStaff && <Button size="sm" variant="secondary" onClick={() => setEdit({ id: r.id, name: r.player.user.name, status: r.status, category: r.category ?? '', basePrice: r.basePrice ?? '', soldPrice: r.soldPrice ?? '', teamId: r.teamId ?? '', isOverseas: r.isOverseas, previousTeamId: r.previousTeamId ?? '', feeStatus: r.feeStatus })}>Manage</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`Manage ${edit.name}`} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => update.mutate({ ...edit, name: undefined, feeStatus: undefined, basePrice: edit.basePrice || null, soldPrice: edit.soldPrice || null, teamId: edit.teamId || null, previousTeamId: edit.previousTeamId || null, category: edit.category || null })}>Save</Button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={[...STATUSES]} /></Field>
            <Field label="Category"><Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="—" options={['Icon', 'A', 'B', 'C', 'Emerging', 'Overseas']} /></Field>
            <Field label="Base price (₹)"><Input type="number" value={edit.basePrice} onChange={(e) => setEdit({ ...edit, basePrice: e.target.value })} /></Field>
            <Field label="Sold price (₹)"><Input type="number" value={edit.soldPrice} onChange={(e) => setEdit({ ...edit, soldPrice: e.target.value })} /></Field>
            <Field label="Team" className="col-span-2"><Select value={edit.teamId} onChange={(e) => setEdit({ ...edit, teamId: e.target.value })} placeholder="Not assigned" options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))} /></Field>
            <Field label="Last season's team" hint="Makes the player eligible for retention / right-to-match"><Select value={edit.previousTeamId} onChange={(e) => setEdit({ ...edit, previousTeamId: e.target.value })} placeholder="None" options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))} /></Field>
            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isOverseas} onChange={(e) => setEdit({ ...edit, isOverseas: e.target.checked })} />Overseas player</label>
          </div>
          <ErrorText error={update.error || fee.error} />
          {edit.feeStatus && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-200 p-3 text-sm">
              <span>Registration fee: <b>{edit.feeStatus.toLowerCase()}</b></span>
              {edit.feeStatus === 'PENDING' && <span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => fee.mutate({ id: edit.id, status: 'PAID' })}>Mark paid (offline)</Button><Button size="sm" variant="ghost" onClick={() => fee.mutate({ id: edit.id, status: 'WAIVED' })}>Waive</Button></span>}
            </div>
          )}
        </Modal>
      )}
      {kyc && <KycReview regId={kyc} onClose={() => { setKyc(null); qc.invalidateQueries({ queryKey: ['registrations', leagueId] }); }} />}
      {rules && <RegistrationRules onClose={() => setRules(false)} />}
    </>
  );
}
