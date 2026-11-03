import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { del, get, post, put } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table } from '../../components/ui';
import { CredentialsModal } from '../../components/Credentials';

const DEPARTMENTS = ['Operations', 'Cricket Operations', 'Finance', 'Commercial', 'Marketing', 'Branding', 'Legal', 'Logistics', 'Production', 'Admin'];

export default function Management() {
  const { leagueId, isAdmin, league } = useLeague();
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ['members', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/members`) });
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<any>(null);
  const [f, setF] = useState({ name: '', email: '', phone: '', department: 'Operations', title: '' });
  const add = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/members`, f), onSuccess: (r) => { setOpen(false); setCreds(r); setF({ ...f, name: '', email: '', phone: '', title: '' }); qc.invalidateQueries({ queryKey: ['members', leagueId] }); } });
  const remove = useMutation({ mutationFn: (uid: string) => del(`/leagues/${leagueId}/members/${uid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['members', leagueId] }) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Management Team" subtitle="People who run the league with you. Each gets their own login." actions={isAdmin && <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Add member</Button>} />
      <Card padded={false}>
        {members.isLoading ? <Spinner /> : (
          <Table head={['Member', 'Department', 'Title', 'Phone', 'Added', '']}
            empty={!members.data?.length && <Empty icon={<Users className="h-5 w-5" />} title="Only you so far" text="Add operations, finance, marketing and legal people to share the workload." />}>
            <tr className="bg-brand-50/30">
              <td className="td"><div className="flex items-center gap-3"><Avatar name={league?.owner.name ?? ''} size={32} /><div><p className="font-medium text-ink-900">{league?.owner.name}</p><p className="text-xs text-ink-500">{league?.owner.email}</p></div></div></td>
              <td className="td"><Badge color="blue">League Owner</Badge></td><td className="td">Owner</td><td className="td">—</td><td className="td">—</td><td className="td" />
            </tr>
            {members.data?.map((m) => (
              <tr key={m.id}>
                <td className="td"><div className="flex items-center gap-3"><Avatar name={m.user.name} size={32} /><div><p className="font-medium text-ink-900">{m.user.name}</p><p className="text-xs text-ink-500">{m.user.email}</p></div></div></td>
                <td className="td"><Badge>{m.department}</Badge></td>
                <td className="td">{m.title ?? '—'}</td>
                <td className="td">{m.user.phone ?? '—'}</td>
                <td className="td">{date(m.createdAt)}</td>
                <td className="td text-right">{isAdmin && <button onClick={() => confirm(`Remove ${m.user.name}?`) && remove.mutate(m.userId)} className="text-ink-300 hover:text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <PermissionsMatrix leagueId={leagueId} isAdmin={isAdmin} usedDepts={[...new Set((members.data ?? []).map((m) => m.department))]} />
      <Modal open={open} onClose={() => setOpen(false)} title="Add management member" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={add.isPending} onClick={() => add.mutate()}>Add member</Button></>}>
        <div className="space-y-4">
          <ErrorText error={add.error} />
          <Field label="Full name"><Input value={f.name} onChange={set('name')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Department"><Select value={f.department} onChange={set('department')} options={DEPARTMENTS} /></Field>
            <Field label="Title"><Input value={f.title} onChange={set('title')} placeholder="Head of Operations" /></Field>
          </div>
        </div>
      </Modal>
      <CredentialsModal data={creds} onClose={() => setCreds(null)} />
    </>
  );
}

const LEVEL_STYLE: Record<string, string> = { edit: 'bg-emerald-50 text-emerald-800 border-emerald-200', view: 'bg-sky-50 text-sky-800 border-sky-200', none: 'bg-ink-100 text-ink-400 border-ink-200' };

function PermissionsMatrix({ leagueId, isAdmin, usedDepts }: { leagueId: string; isAdmin: boolean; usedDepts: string[] }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['permissions', leagueId], queryFn: () => get(`/leagues/${leagueId}/permissions`) });
  const [m, setM] = useState<Record<string, Record<string, string>> | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => { if (q.data && !m) setM(q.data.matrix); }, [q.data, m]);
  const save = useMutation({ mutationFn: () => put(`/leagues/${leagueId}/permissions`, m), onSuccess: () => { qc.invalidateQueries({ queryKey: ['permissions', leagueId] }); qc.invalidateQueries({ queryKey: ['league', leagueId] }); } });
  if (!q.data || !m) return <Card className="mt-6"><Spinner /></Card>;
  const depts = (q.data.departments as string[]).filter((d) => all || usedDepts.includes(d));
  const dirty = JSON.stringify(m) !== JSON.stringify(q.data.matrix);
  return (
    <Card className="mt-6" padded={false} title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Department permissions</span>}
      action={<div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-600"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />All departments</label>
        {isAdmin && <><Button size="sm" variant="ghost" onClick={() => setM(q.data.defaults)}><RotateCcw className="h-3.5 w-3.5" />Defaults</Button><Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save permissions</Button></>}
      </div>}>
      <p className="px-5 pt-3 text-xs text-ink-500">What each department can see and change. You (the owner) always have full access. <b>Edit</b> = create and change · <b>View</b> = read only · <b>None</b> = hidden from their menu.</p>
      <div className="px-5"><ErrorText error={save.error} /></div>
      {!depts.length ? <p className="p-5 text-sm text-ink-500">Add management members to set their department's access, or tick “All departments”.</p> : (
        <div className="overflow-x-auto p-5 pt-3">
          <table className="w-full text-sm">
            <thead><tr><th className="sticky left-0 bg-white py-2 pr-4 text-left text-xs font-semibold uppercase text-ink-500">Module</th>{depts.map((d) => <th key={d} className="px-1 py-2 text-center text-xs font-semibold text-ink-600">{d}</th>)}</tr></thead>
            <tbody>
              {q.data.modules.map((mod: any) => (
                <tr key={mod.key} className="border-t border-ink-100">
                  <td className="sticky left-0 bg-white py-1.5 pr-4 text-ink-800">{mod.label}</td>
                  {depts.map((d) => (
                    <td key={d} className="px-1 py-1.5 text-center">
                      <select aria-label={`${d} — ${mod.label}`} disabled={!isAdmin} value={m[d]?.[mod.key] ?? 'view'} onChange={(e) => setM({ ...m, [d]: { ...m[d], [mod.key]: e.target.value } })}
                        className={`rounded-md border px-1.5 py-1 text-xs font-semibold ${LEVEL_STYLE[m[d]?.[mod.key] ?? 'view']}`}>
                        <option value="edit">Edit</option><option value="view">View</option><option value="none">None</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
