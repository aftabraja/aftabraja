import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake, IndianRupee, Search, Store, Trophy, Users } from 'lucide-react';
import { get, patch } from '../../lib/api';
import { ago, date, inr, inrShort, ROLE_LABEL } from '../../lib/format';
import { Avatar, Badge, Button, Card, Input, PageHeader, Progress, Select, Spinner, Stat, StatusBadge, Table, Tabs } from '../../components/ui';

export function AdminOverview() {
  const o = useQuery({ queryKey: ['admin-overview'], queryFn: () => get('/admin/overview') });
  if (o.isLoading) return <Spinner />;
  const d = o.data;
  const totalUsers = Object.values(d.usersByRole as Record<string, number>).reduce((a, b) => a + b, 0);
  const totalLeagues = Object.values(d.leaguesByStatus as Record<string, number>).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Platform Overview" subtitle="Super Admin — complete visibility across every league, user, vendor and transaction." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Leagues" value={totalLeagues} icon={<Trophy className="h-4 w-4" />} sub={Object.entries(d.leaguesByStatus).map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`).join(' · ')} />
        <Stat label="Users" value={totalUsers} icon={<Users className="h-4 w-4" />} sub={`${d.players} players · ${d.sponsors} sponsors`} />
        <Stat label="Vendors" value={d.vendors} icon={<Store className="h-4 w-4" />} sub={`${d.services} services listed`} />
        <Stat label="Subscription MRR" value={inr(d.mrr)} icon={<IndianRupee className="h-4 w-4" />} sub={`${inr(d.potentialMrr)} incl. trials`} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Sponsorship inventory" value={inrShort(d.opportunities.value)} sub={`${d.opportunities.count} opportunities`} icon={<Handshake className="h-4 w-4" />} />
        <Stat label="League income tracked" value={inrShort(d.gmv.incomes)} />
        <Stat label="League expenses tracked" value={inrShort(d.gmv.expenses)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Users by role">
          <div className="space-y-3">
            {Object.entries(d.usersByRole as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
              <div key={r}><div className="mb-1 flex justify-between text-sm"><span>{ROLE_LABEL[r]}</span><span className="font-semibold">{n}</span></div><Progress value={(n / totalUsers) * 100} /></div>
            ))}
          </div>
        </Card>
        <Card title="Recent sign-ups" padded={false}>
          <ul className="divide-y divide-ink-100">
            {d.recentUsers.map((u: any) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3"><Avatar name={u.name} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-ink-500">{u.email}</p></div><Badge>{ROLE_LABEL[u.role]}</Badge><span className="w-16 text-right text-xs text-ink-400">{ago(u.createdAt)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export function AdminLeagues() {
  const l = useQuery({ queryKey: ['admin-leagues'], queryFn: () => get<any[]>('/admin/leagues') });
  return (
    <>
      <PageHeader title="All Leagues" subtitle="Open any league to see its full data exactly as the owner does." />
      <Card padded={false}>
        {l.isLoading ? <Spinner /> : (
          <Table head={['League', 'Owner', 'Status', 'Start', 'Teams', 'Players', 'Sponsor opps', 'Readiness', '']}>
            {l.data!.map((x) => (
              <tr key={x.id}>
                <td className="td"><div className="flex items-center gap-3"><Avatar name={x.name} src={x.logoUrl} size={32} /><div><p className="font-medium text-ink-900">{x.name}</p><p className="text-xs text-ink-500">{[x.sport, x.format, x.city].filter(Boolean).join(' · ')}</p></div></div></td>
                <td className="td"><p>{x.owner.name}</p><p className="text-xs text-ink-500">{x.owner.email}</p></td>
                <td className="td"><StatusBadge status={x.status} /></td>
                <td className="td">{date(x.startDate)}</td>
                <td className="td">{x._count.teams}</td><td className="td">{x._count.registrations}</td><td className="td">{x._count.opportunities}</td>
                <td className="td w-40"><div className="flex items-center gap-2"><Progress value={x.progress.percent} /><span className="text-xs font-semibold">{x.progress.percent}%</span></div></td>
                <td className="td text-right"><Link to={`/leagues/${x.id}`}><Button size="sm" variant="secondary">Open</Button></Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ ...(role && { role }), ...(q && { q }) }).toString();
  const u = useQuery({ queryKey: ['admin-users', params], queryFn: () => get<any[]>(`/admin/users?${params}`) });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: any) => patch(`/admin/users/${id}`, { isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  const activate = useMutation({ mutationFn: (id: string) => patch(`/admin/users/${id}/subscription`, { status: 'ACTIVE', months: 12 }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  return (
    <>
      <PageHeader title="Users & Subscriptions" />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-ink-100 p-4 sm:grid-cols-[1fr_220px]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} placeholder="All roles" options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
        </div>
        {u.isLoading ? <Spinner /> : (
          <Table head={['User', 'Role', 'Company', 'Plan', 'Subscription', 'Joined', 'Status', '']}>
            {u.data!.map((x) => {
              const s = x.subscriptions[0];
              return (
                <tr key={x.id}>
                  <td className="td"><p className="font-medium text-ink-900">{x.name}</p><p className="text-xs text-ink-500">{x.email}</p></td>
                  <td className="td"><Badge>{ROLE_LABEL[x.role]}</Badge></td>
                  <td className="td">{x.vendorProfile?.companyName ?? x.sponsorProfile?.companyName ?? '—'}</td>
                  <td className="td">{s ? (s.amount ? inr(s.amount) : 'Free') : '—'}</td>
                  <td className="td">{s ? <span className="flex items-center gap-2"><StatusBadge status={s.status} /><span className="text-xs text-ink-500">till {date(s.validTill)}</span></span> : '—'}</td>
                  <td className="td">{date(x.createdAt)}</td>
                  <td className="td">{x.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Disabled</Badge>}</td>
                  <td className="td text-right"><div className="flex justify-end gap-1">
                    {s && s.status !== 'ACTIVE' && <Button size="sm" variant="secondary" onClick={() => activate.mutate(x.id)}>Activate plan</Button>}
                    {x.role !== 'SUPER_ADMIN' && <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: x.id, isActive: !x.isActive })}>{x.isActive ? 'Disable' : 'Enable'}</Button>}
                  </div></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}

export function AdminVendors() {
  const qc = useQueryClient();
  const v = useQuery({ queryKey: ['admin-vendors'], queryFn: () => get<any[]>('/admin/vendors') });
  const verify = useMutation({ mutationFn: ({ id, verified }: any) => patch(`/admin/vendors/${id}`, { verified }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-vendors'] }) });
  return (
    <>
      <PageHeader title="Vendors" subtitle="Every vendor, their services, prices and verification status." />
      <Card padded={false}>
        {v.isLoading ? <Spinner /> : (
          <Table head={['Vendor', 'City', 'Services', 'Rating', 'Joined', 'Verified', '']}>
            {v.data!.map((x) => (
              <tr key={x.id}>
                <td className="td"><p className="font-medium text-ink-900">{x.companyName}</p><p className="text-xs text-ink-500">{x.user.email}</p></td>
                <td className="td">{x.city ?? '—'}</td>
                <td className="td max-w-md whitespace-normal"><div className="flex flex-wrap gap-1">{x.services.map((s: any) => <Badge key={s.id}>{s.title} · {s.priceMin ? inrShort(s.priceMin) : 'POR'}</Badge>)}</div></td>
                <td className="td">{x.rating ? x.rating.toFixed(1) : '—'}</td>
                <td className="td">{date(x.createdAt)}</td>
                <td className="td">{x.verified ? <Badge color="green">Verified</Badge> : <Badge color="amber">Pending</Badge>}</td>
                <td className="td text-right"><Button size="sm" variant="secondary" onClick={() => verify.mutate({ id: x.id, verified: !x.verified })}>{x.verified ? 'Unverify' : 'Verify'}</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

export function AdminSponsors() {
  const [tab, setTab] = useState<'sponsors' | 'opps'>('sponsors');
  const s = useQuery({ queryKey: ['admin-sponsors'], queryFn: () => get<any[]>('/admin/sponsors') });
  const o = useQuery({ queryKey: ['admin-opps'], queryFn: () => get<any[]>('/admin/opportunities') });
  return (
    <>
      <PageHeader title="Sponsors & Inventory" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'sponsors', label: 'Sponsors' }, { value: 'opps', label: 'Sponsorship opportunities' }]} />
      <Card padded={false}>
        {tab === 'sponsors' ? (
          <Table head={['Company', 'Industry', 'City', 'Budget', 'Contact', 'Joined']}>
            {s.data?.map((x) => <tr key={x.id}><td className="td font-medium text-ink-900">{x.companyName}</td><td className="td">{x.industry ?? '—'}</td><td className="td">{x.city ?? '—'}</td><td className="td">{inrShort(x.budgetMin)} – {inrShort(x.budgetMax)}</td><td className="td">{x.user.email}</td><td className="td">{date(x.createdAt)}</td></tr>)}
          </Table>
        ) : (
          <Table head={['Opportunity', 'League', 'Tier', 'Price', 'Status']}>
            {o.data?.map((x) => <tr key={x.id}><td className="td font-medium text-ink-900">{x.title}</td><td className="td"><Link className="text-brand-700 hover:underline" to={`/leagues/${x.league.id}/sponsorships`}>{x.league.name}</Link></td><td className="td"><Badge color="violet">{x.tier}</Badge></td><td className="td">{inr(x.price)}</td><td className="td"><StatusBadge status={x.status} /></td></tr>)}
          </Table>
        )}
      </Card>
    </>
  );
}

export function AdminTransactions() {
  const [tab, setTab] = useState<'expenses' | 'incomes'>('expenses');
  const t = useQuery({ queryKey: ['admin-tx'], queryFn: () => get('/admin/transactions') });
  if (t.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader title="Transactions" subtitle="All expenses and income recorded across every league." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'expenses', label: `Expenses (${t.data.expenses.length})` }, { value: 'incomes', label: `Income (${t.data.incomes.length})` }]} />
      <Card padded={false}>
        {tab === 'expenses' ? (
          <Table head={['Date', 'League', 'Category', 'Description', 'Vendor', 'Amount', 'Status']}>
            {t.data.expenses.map((e: any) => <tr key={e.id}><td className="td">{date(e.date)}</td><td className="td">{e.league.name}</td><td className="td">{e.category}</td><td className="td">{e.description}</td><td className="td">{e.vendor?.companyName ?? e.payee ?? '—'}</td><td className="td font-semibold">{inr(e.amount)}</td><td className="td"><StatusBadge status={e.status} /></td></tr>)}
          </Table>
        ) : (
          <Table head={['Date', 'League', 'Source', 'Description', 'Amount', 'Status']}>
            {t.data.incomes.map((i: any) => <tr key={i.id}><td className="td">{date(i.date)}</td><td className="td">{i.league.name}</td><td className="td">{i.source}</td><td className="td">{i.description}</td><td className="td font-semibold text-emerald-700">{inr(i.amount)}</td><td className="td"><StatusBadge status={i.status} /></td></tr>)}
          </Table>
        )}
      </Card>
    </>
  );
}

export function AdminAudit() {
  const a = useQuery({ queryKey: ['admin-audit'], queryFn: () => get<any[]>('/admin/audit') });
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every critical action on the platform." />
      <Card padded={false}>
        {a.isLoading ? <Spinner /> : (
          <Table head={['When', 'User', 'Action', 'Entity', 'ID']}>
            {a.data!.map((x) => <tr key={x.id}><td className="td">{ago(x.createdAt)}</td><td className="td">{x.user?.name ?? 'System'}</td><td className="td"><Badge>{x.action}</Badge></td><td className="td">{x.entity}</td><td className="td font-mono text-xs">{x.entityId ?? '—'}</td></tr>)}
          </Table>
        )}
      </Card>
    </>
  );
}
