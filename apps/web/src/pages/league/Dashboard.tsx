import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpenCheck, CalendarDays, CircleDollarSign, Megaphone, Shield, UsersRound } from 'lucide-react';
import { get } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { date, inrShort } from '../../lib/format';
import { SeasonSwitcher } from '../../components/Seasons';
import { Avatar, Badge, Button, Card, PageHeader, Progress, Spinner, Stat, StatusBadge } from '../../components/ui';
import { useVendorPanel } from '../../components/VendorPanel';

export default function LeagueDashboard() {
  const { leagueId, league, isStaff } = useLeague();
  const { openVendors } = useVendorPanel();
  const d = useQuery({ queryKey: ['dashboard', leagueId], queryFn: () => get(`/leagues/${leagueId}/dashboard`) });
  const pb = useQuery({ queryKey: ['playbook', leagueId], queryFn: () => get(`/leagues/${leagueId}/playbook`) });
  if (!league || d.isLoading) return <Spinner />;
  const x = d.data;
  const daysToGo = league.startDate ? Math.ceil((new Date(league.startDate).getTime() - Date.now()) / 864e5) : null;
  const nextAction = x.progress.nextStep?.actions?.find((a: any) => a.type === 'vendor');

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={league.name} src={league.logoUrl} size={44} />{league.name}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2">{[league.sport, league.format, league.category, league.city].filter(Boolean).join(' · ')} <StatusBadge status={league.status} /><SeasonSwitcher league={league} /></span>}
        actions={<Link to={`/leagues/${leagueId}/playbook`}><Button><BookOpenCheck className="h-4 w-4" />Open playbook</Button></Link>}
      />

      <Card className="mb-6 overflow-hidden" padded={false}>
        <div className="grid gap-6 bg-gradient-to-r from-brand-700 to-brand-900 p-6 text-white md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">League readiness</p>
            <div className="mt-2 flex items-end gap-3"><span className="text-5xl font-extrabold">{x.progress.percent}%</span><span className="mb-2 text-sm text-white/75">{x.progress.done} of {x.progress.total} steps · {x.progress.criticalDone}/{x.progress.criticalTotal} critical</span></div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-400" style={{ width: `${x.progress.percent}%` }} /></div>
          </div>
          <div className="flex flex-col justify-center gap-2 md:min-w-[260px]">
            {daysToGo !== null && <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-amber-300" />{daysToGo > 0 ? `${daysToGo} days to first ball` : `Started ${date(league.startDate)}`}</p>}
            {x.progress.nextStep && (
              <div className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Next step</p>
                <p className="font-semibold">{x.progress.nextStep.title}</p>
                <div className="mt-2 flex gap-2">
                  <Link to={`/leagues/${leagueId}/playbook#${x.progress.nextStep.key}`}><Button size="sm" variant="secondary">Go to step</Button></Link>
                  {nextAction && isStaff && <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => openVendors(nextAction.category, leagueId)}>Find vendors</Button>}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Teams" value={`${x.teamsWithOwners}/${x.teams}`} sub="franchises sold" icon={<Shield className="h-4 w-4" />} />
        <Stat label="Player registrations" value={Object.values(x.players as Record<string, number>).reduce((a, b) => a + b, 0)} sub={`${x.players.SHORTLISTED ?? 0} shortlisted · ${x.players.SOLD ?? 0} sold`} icon={<UsersRound className="h-4 w-4" />} />
        <Stat label="Sponsorship" value={inrShort(x.sponsorship.soldValue)} sub={`of ${inrShort(x.sponsorship.inventoryValue)} inventory · ${x.sponsorship.sold}/${x.sponsorship.total} sold`} icon={<Megaphone className="h-4 w-4" />} />
        {x.finance && <Stat label="Net P&L" value={inrShort(x.finance.income - x.finance.expense)} tone={x.finance.income - x.finance.expense >= 0 ? 'green' : 'red'} sub={`${inrShort(x.finance.income)} in · ${inrShort(x.finance.expense)} out`} icon={<CircleDollarSign className="h-4 w-4" />} />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Phase progress" action={<Link to={`/leagues/${leagueId}/playbook`} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">Playbook<ArrowRight className="h-3 w-3" /></Link>}>
          <div className="space-y-4">
            {pb.data?.phases.map((p: any, i: number) => (
              <div key={p.key}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium"><span className="mr-2 text-xs text-ink-400">{String(i + 1).padStart(2, '0')}</span>{p.title}</span>
                  <span className="text-xs font-semibold text-ink-500">{p.done}/{p.steps.length}</span>
                </div>
                <Progress value={(p.done / p.steps.length) * 100} tone={p.done === p.steps.length ? 'green' : 'brand'} />
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          {x.finance && <Card title="Budget utilisation">
            <div className="flex items-end justify-between"><span className="text-2xl font-bold">{inrShort(x.finance.expense)}</span><span className="text-sm text-ink-500">of {inrShort(x.finance.budget)} planned</span></div>
            <Progress className="mt-3" value={x.finance.budget ? (x.finance.expense / x.finance.budget) * 100 : 0} tone={x.finance.expense > x.finance.budget ? 'red' : 'brand'} />
            {isStaff && <Link to={`/leagues/${leagueId}/finance`} className="mt-4 inline-block text-xs font-semibold text-brand-700 hover:underline">Open finance →</Link>}
          </Card>}
          <Card title="Critical steps pending">
            <ul className="space-y-2">
              {pb.data?.phases.flatMap((p: any) => p.steps).filter((s: any) => s.critical && s.status !== 'DONE' && s.status !== 'SKIPPED').slice(0, 6).map((s: any) => (
                <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/leagues/${leagueId}/playbook#${s.key}`} className="truncate hover:text-brand-700">{s.title}</Link>
                  <Badge color={s.status === 'IN_PROGRESS' ? 'amber' : 'gray'}>{s.owner}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
