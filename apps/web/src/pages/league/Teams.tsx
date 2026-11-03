import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkCheck, ClipboardList, Pencil, Plus, Shield, Trash2, UserPlus, Sparkles } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { fileToDataUrl, inrShort } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table } from '../../components/ui';
import { CredentialsModal } from '../../components/Credentials';
import { AiLogoStudio } from '../../components/AiLogoStudio';

export default function Teams() {
  const { leagueId, isStaff, isAdmin, league } = useLeague();
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const [edit, setEdit] = useState<any | null>(null);
  const [ownerFor, setOwnerFor] = useState<any | null>(null);
  const [creds, setCreds] = useState<any>(null);
  const [staffFor, setStaffFor] = useState<any>(null);
  const [retainFor, setRetainFor] = useState<any>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['teams', leagueId] });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/teams/${id}`), onSuccess: refresh });
  const removeOwner = useMutation({ mutationFn: ({ teamId, userId }: any) => del(`/leagues/${leagueId}/teams/${teamId}/owners/${userId}`), onSuccess: refresh });

  return (
    <>
      <PageHeader title={league?.access === 'team' ? 'My Team' : 'Teams & Franchise Owners'} subtitle="Each owner and co-owner gets their own login to follow their team."
        actions={isStaff && <Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />Add team</Button>} />
      {teams.isLoading ? <Spinner /> : !teams.data?.length ? (
        <Card><Empty icon={<Shield className="h-5 w-5" />} title="No teams yet" text="Add the teams in your league. You can sell each one as a franchise." action={isStaff && <Button onClick={() => setEdit({})}><Plus className="h-4 w-4" />Add team</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.data.map((t) => {
            const spent = t.players.reduce((s: number, p: any) => s + (p.soldPrice ?? 0), 0);
            return (
              <div key={t.id} className="card flex flex-col">
                <div className="flex items-start gap-3 p-5">
                  <Avatar name={t.name} src={t.logoUrl} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{t.name}</p>
                    <p className="text-xs text-ink-500">{[t.shortName, t.city].filter(Boolean).join(' · ') || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.owners.length ? <Badge color="green">Franchise sold</Badge> : <Badge color="amber">Available</Badge>}
                      {t.franchiseFee && <Badge>Fee {inrShort(t.franchiseFee)}</Badge>}
                    </div>
                  </div>
                  <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={() => setEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-3 border-y border-ink-100 text-center text-xs">
                  <div className="p-3"><p className="font-bold text-ink-900">{t.players.length}</p><p className="text-ink-500">Players</p></div>
                  <div className="border-x border-ink-100 p-3"><p className="font-bold text-ink-900">{inrShort(t.purse)}</p><p className="text-ink-500">Purse</p></div>
                  <div className="p-3"><p className="font-bold text-ink-900">{inrShort((t.purse ?? 0) - spent)}</p><p className="text-ink-500">Remaining</p></div>
                </div>
                <div className="flex-1 p-5">
                  <p className="label">Owners</p>
                  {!t.owners.length && <p className="text-sm text-ink-500">No owner yet.</p>}
                  <ul className="space-y-2">
                    {t.owners.map((o: any) => (
                      <li key={o.userId} className="flex items-center gap-2 text-sm">
                        <Avatar name={o.user.name} size={28} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{o.user.name}</span><span className="block truncate text-xs text-ink-500">{o.user.email}</span></span>
                        <Badge color="blue">{o.sharePct}%</Badge>
                        {isAdmin && <button onClick={() => removeOwner.mutate({ teamId: t.id, userId: o.userId })} className="text-ink-300 hover:text-red-600" aria-label="Remove owner"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 border-t border-ink-100 p-3">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setStaffFor(t)}><ClipboardList className="h-3.5 w-3.5" />Staff{t._count?.staff ? ` (${t._count.staff})` : ''}</Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRetainFor(t)}><BookmarkCheck className="h-3.5 w-3.5" />Retentions</Button>
                </div>
                {isStaff && (
                  <div className="flex gap-2 border-t border-ink-100 p-3">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOwnerFor(t)}><UserPlus className="h-3.5 w-3.5" />{t.owners.length ? 'Add co-owner' : 'Add owner'}</Button>
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${t.name}?`) && remove.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {edit && <TeamModal team={edit} leagueId={leagueId} onClose={() => { setEdit(null); refresh(); }} />}
      {ownerFor && <OwnerModal team={ownerFor} leagueId={leagueId} onClose={() => setOwnerFor(null)} onDone={(r) => { setOwnerFor(null); setCreds(r); refresh(); }} />}
      <CredentialsModal data={creds} onClose={() => setCreds(null)} />
      {staffFor && <StaffModal team={staffFor} onClose={() => { setStaffFor(null); refresh(); }} />}
      {retainFor && <RetentionModal team={retainFor} onClose={() => { setRetainFor(null); refresh(); }} />}
    </>
  );
}

function StaffModal({ team, onClose }: { team: any; onClose: () => void }) {
  const { leagueId } = useLeague();
  const base = `/leagues/${leagueId}/squads/teams/${team.id}/staff`;
  const list = useQuery({ queryKey: ['team-staff', team.id], queryFn: () => get<any[]>(base) });
  const roles = useQuery({ queryKey: ['reg-settings', leagueId], queryFn: () => get(`/leagues/${leagueId}/squads/settings`) });
  const [f, setF] = useState({ name: '', role: 'Head Coach', email: '', phone: '' });
  const add = useMutation({ mutationFn: () => post(base, f), onSuccess: () => { setF({ name: '', role: f.role, email: '', phone: '' }); list.refetch(); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`${base}/${id}`), onSuccess: () => list.refetch() });
  return (
    <Modal open onClose={onClose} size="lg" title={`Support staff — ${team.name}`} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <ErrorText error={add.error} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <Input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={roles.data?.staffRoles ?? ['Head Coach']} />
        <Input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Button disabled={f.name.length < 2} loading={add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" />Add</Button>
      </div>
      {list.isLoading ? <Spinner /> : (
        <Table head={['Name', 'Role', 'Contact', '']} empty={!list.data?.length && <Empty icon={<ClipboardList className="h-5 w-5" />} title="No staff yet" text="Add coaches, manager, physio and analysts. They can be accredited from the Accreditation module." />}>
          {list.data?.map((s) => <tr key={s.id}><td className="td font-medium text-ink-900">{s.name}</td><td className="td">{s.role}</td><td className="td text-xs">{[s.email, s.phone].filter(Boolean).join(' · ') || '—'}</td><td className="td text-right"><button onClick={() => remove.mutate(s.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></td></tr>)}
        </Table>
      )}
    </Modal>
  );
}

function RetentionModal({ team, onClose }: { team: any; onClose: () => void }) {
  const { leagueId } = useLeague();
  const base = `/leagues/${leagueId}/squads/teams/${team.id}`;
  const q = useQuery({ queryKey: ['retention', team.id], queryFn: () => get(`${base}/retention`) });
  const [price, setPrice] = useState<Record<string, string>>({});
  const retain = useMutation({ mutationFn: (p: any) => post(`${base}/retain`, { regId: p.id, price: Number(price[p.id] ?? p.basePrice ?? 0) }), onSuccess: () => q.refetch() });
  const release = useMutation({ mutationFn: (id: string) => del(`${base}/retain/${id}`), onSuccess: () => q.refetch() });
  const d = q.data;
  const used = d?.eligible.filter((p: any) => p.retained).length ?? 0;
  return (
    <Modal open onClose={onClose} size="lg" title={`Retentions — ${team.name}`} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      {!d ? <Spinner /> : (
        <>
          <p className="mb-3 text-sm text-ink-500">{d.maxRetentions ? `Retain up to ${d.maxRetentions} players from last season before the auction (${used} used). The retention price comes out of the purse.` : 'This league does not allow retentions (set the limit in Auction rules).'}{!d.open && ' Retentions are closed — the auction has started.'}</p>
          <ErrorText error={retain.error || release.error} />
          <Table head={['Player', 'Role', 'Base', 'Retention price', '']} empty={!d.eligible.length && <Empty icon={<BookmarkCheck className="h-5 w-5" />} title="No eligible players" text="Mark a player's 'last season's team' on the Players page to make them eligible." />}>
            {d.eligible.map((p: any) => (
              <tr key={p.id}>
                <td className="td font-medium text-ink-900">{p.name}{p.isOverseas && <Badge color="blue" className="ml-1">overseas</Badge>}</td>
                <td className="td">{p.role ?? '—'}</td>
                <td className="td">{inrShort(p.basePrice)}</td>
                <td className="td">{p.retained ? inrShort(p.price) : <Input type="number" className="w-32" value={price[p.id] ?? p.basePrice ?? ''} onChange={(e) => setPrice({ ...price, [p.id]: e.target.value })} disabled={!d.open || !!p.teamId} />}</td>
                <td className="td text-right">{p.retained ? (d.open && <Button size="sm" variant="ghost" onClick={() => release.mutate(p.id)}>Release</Button>) : p.teamId ? <span className="text-xs text-ink-500">in another squad</span> : <Button size="sm" disabled={!d.open || used >= d.maxRetentions} onClick={() => retain.mutate(p)}>Retain</Button>}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Modal>
  );
}

function TeamModal({ team, leagueId, onClose }: { team: any; leagueId: string; onClose: () => void }) {
  const [f, setF] = useState({ name: team.name ?? '', shortName: team.shortName ?? '', city: team.city ?? '', color: team.color ?? '#1d4ed8', purse: team.purse ?? '', franchiseFee: team.franchiseFee ?? '', logoUrl: team.logoUrl ?? '' });
  const [ai, setAi] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, purse: f.purse || null, franchiseFee: f.franchiseFee || null, logoUrl: f.logoUrl || null };
      return team.id ? patch(`/leagues/${leagueId}/teams/${team.id}`, body) : post(`/leagues/${leagueId}/teams`, body);
    },
    onSuccess: onClose,
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={team.id ? 'Edit team' : 'Add team'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()} disabled={!f.name}>Save</Button></>}>
      <div className="space-y-4">
        <ErrorText error={save.error} />
        <div className="flex items-center gap-4">
          <Avatar name={f.name || '?'} src={f.logoUrl} size={64} />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-ink-200 px-3 text-xs font-semibold hover:bg-ink-50">Upload logo<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, logoUrl: await fileToDataUrl(x) }); }} /></label>
            <Button size="sm" variant="secondary" onClick={() => setAi(true)}><Sparkles className="h-3.5 w-3.5 text-amber-500" />AI logo</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team name" className="col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Short name"><Input value={f.shortName} onChange={set('shortName')} maxLength={5} /></Field>
          <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Auction purse (₹)"><Input type="number" value={f.purse} onChange={set('purse')} /></Field>
          <Field label="Franchise fee (₹)"><Input type="number" value={f.franchiseFee} onChange={set('franchiseFee')} /></Field>
          <Field label="Team colour"><Input type="color" value={f.color} onChange={set('color')} className="h-10 p-1" /></Field>
        </div>
      </div>
      <AiLogoStudio open={ai} onClose={() => setAi(false)} defaultName={f.name} defaultCode={f.shortName} onSelect={(u) => setF({ ...f, logoUrl: u })} />
    </Modal>
  );
}

function OwnerModal({ team, leagueId, onClose, onDone }: { team: any; leagueId: string; onClose: () => void; onDone: (r: any) => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', sharePct: team.owners.length ? 50 : 100 });
  const save = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/teams/${team.id}/owners`, f), onSuccess: onDone });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={`Add owner — ${team.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Add owner</Button></>}>
      <div className="space-y-4">
        <ErrorText error={save.error} />
        <p className="text-sm text-ink-500">We'll create a Team Owner login so they can see their team, players, schedule and notifications.</p>
        <Field label="Full name"><Input value={f.name} onChange={set('name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="Ownership share (%)"><Input type="number" min={0} max={100} value={f.sharePct} onChange={set('sharePct')} /></Field>
      </div>
    </Modal>
  );
}
