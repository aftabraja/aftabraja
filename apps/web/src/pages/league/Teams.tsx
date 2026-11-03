import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Shield, Trash2, UserPlus, Sparkles } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { fileToDataUrl, inrShort } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Spinner } from '../../components/ui';
import { CredentialsModal } from '../../components/Credentials';
import { AiLogoStudio } from '../../components/AiLogoStudio';

export default function Teams() {
  const { leagueId, isStaff, isAdmin, league } = useLeague();
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const [edit, setEdit] = useState<any | null>(null);
  const [ownerFor, setOwnerFor] = useState<any | null>(null);
  const [creds, setCreds] = useState<any>(null);
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
    </>
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
