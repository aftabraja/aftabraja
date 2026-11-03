import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { del, get, post } from '../../lib/api';
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
