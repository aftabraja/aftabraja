import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, History } from 'lucide-react';
import { get, post } from '../lib/api';
import { inrShort } from '../lib/format';
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Spinner, Table, cx } from './ui';

/** Season history, season-on-season comparison and "start next season" */
export function SeasonsCard({ leagueId, league, isAdmin }: { leagueId: string; league: any; isAdmin: boolean }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['seasons', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/seasons`) });
  const nextYear = String((league.startDate ? new Date(league.startDate).getFullYear() : new Date().getFullYear()) + 1);
  const [f, setF] = useState<any>(null);
  const start = useMutation({
    mutationFn: () => post(`/leagues/${leagueId}/next-season`, { season: f.season, startDate: f.startDate || null, endDate: f.endDate || null, carryPlayers: f.carryPlayers }),
    onSuccess: (r: any) => { qc.invalidateQueries(); nav(`/leagues/${r.league.id}`); },
  });
  const rows = q.data ?? [];
  const delta = (k: string, i: number) => { if (i === 0 || (!rows[i].matchesPlayed && !rows[i].income)) return null; const a = rows[i - 1][k], b = rows[i][k]; if (a == null || b == null || !a) return null; const p = Math.round(((b - a) / Math.abs(a)) * 100); return <span className={cx('ml-1 text-[11px]', p >= 0 ? 'text-emerald-600' : 'text-red-600')}>{p >= 0 ? '+' : ''}{p}%</span>; };
  return (
    <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4" />Seasons</span>} action={isAdmin && <Button size="sm" onClick={() => setF({ season: nextYear, startDate: '', endDate: '', carryPlayers: true })}><CalendarPlus className="h-3.5 w-3.5" />Start next season</Button>}>
      {q.isLoading ? <Spinner /> : (
        <Table head={['Season', 'Players', 'Matches', 'Tickets', 'Sponsorship won', 'Income', 'Expense', 'Profit', 'Fan NPS']}>
          {rows.map((r, i) => (
            <tr key={r.id} className={cx(r.id === leagueId && 'bg-brand-50/50')}>
              <td className="td font-semibold"><button onClick={() => nav(`/leagues/${r.id}`)} className="hover:text-brand-700">{r.season}</button>{r.id === leagueId && <Badge color="blue" className="ml-2">current</Badge>}</td>
              <td className="td">{r.players}{delta('players', i)}</td>
              <td className="td">{r.matchesPlayed}</td>
              <td className="td">{r.ticketsSold}{delta('ticketsSold', i)}</td>
              <td className="td">{inrShort(r.sponsorshipWon)}{delta('sponsorshipWon', i)}</td>
              <td className="td">{inrShort(r.income)}{delta('income', i)}</td>
              <td className="td">{inrShort(r.expense)}</td>
              <td className={cx('td font-semibold', r.profit < 0 ? 'text-red-600' : 'text-emerald-700')}>{inrShort(r.profit)}</td>
              <td className="td">{r.fanNps ?? '—'}</td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!f} onClose={() => setF(null)} title="Start the next season" footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button disabled={!f?.season} loading={start.isPending} onClick={() => start.mutate()}>Create season {f?.season}</Button></>}>
        {f && <div className="space-y-3">
          <ErrorText error={start.error} />
          <p className="text-sm text-ink-500">A new season is created alongside this one. This season stays as it is, with all its records and reports.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Season name"><Input value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} /></Field>
            <Field label="Starts"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Ends"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          </div>
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            <p className="font-semibold">Carried over</p>
            <p className="mt-1 text-ink-600">League identity and logo · teams, owners and support staff · management team and permissions · venues · auction, squad and registration rules · approval chain and clause library · sponsorship inventory · budget · accreditation setup · season ticket categories.</p>
            <p className="mt-2 font-semibold">Starts fresh</p>
            <p className="mt-1 text-ink-600">Fixtures and scores · finances · contracts · sponsor deals · tickets sold · surveys · playbook progress (identity steps stay done).</p>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.carryPlayers} onChange={(e) => setF({ ...f, carryPlayers: e.target.checked })} /><span>Carry over last season's squad players (shortlisted, linked to their old team so they can be retained or matched with RTM). They are notified and asked to re-verify their documents.</span></label>
        </div>}
      </Modal>
    </Card>
  );
}

/** Small season switcher for the league dashboard header */
export function SeasonSwitcher({ league }: { league: any }) {
  const nav = useNavigate();
  if (!league?.seasons?.length || league.seasons.length < 2) return league?.season ? <Badge color="blue">Season {league.season}</Badge> : null;
  return (
    <select aria-label="Season" className="input h-8 w-auto py-0 text-xs font-semibold" value={league.id} onChange={(e) => nav(`/leagues/${e.target.value}`)}>
      {league.seasons.map((s: any) => <option key={s.id} value={s.id}>Season {s.season ?? '—'}</option>)}
    </select>
  );
}
