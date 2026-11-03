import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileSpreadsheet, FileText, FileDown, Search } from 'lucide-react';
import { get } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { download } from '../../lib/download';
import { Button, Card, Empty, ErrorText, Field, Input, PageHeader, Spinner, cx } from '../../components/ui';

const GROUPS = ['Finance', 'Commercial', 'Cricket', 'Operations'];
const fmt = (c: any, v: any) => {
  if (v === null || v === undefined || v === '') return '';
  if (c.type === 'money' && typeof v === 'number') return `${v < 0 ? '-' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
  if (c.type === 'number' && typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-IN') : String(v);
  if (c.type === 'percent') return `${v}%`;
  if (c.type === 'date') return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (c.type === 'datetime') return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return String(v);
};

export default function Reports() {
  const { leagueId } = useLeague();
  const list = useQuery({ queryKey: ['reports', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/reports`) });
  const [key, setKey] = useState('pnl');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  const rep = useQuery({ queryKey: ['report', leagueId, key, qs], queryFn: () => get(`/leagues/${leagueId}/reports/${key}?${qs}`) });
  const filtered = useMemo(() => (list.data ?? []).filter((r) => !q || `${r.title} ${r.description}`.toLowerCase().includes(q.toLowerCase())), [list.data, q]);
  const totals = useMemo(() => rep.data?.columns.some((c: any) => c.total) ? Object.fromEntries(rep.data.columns.map((c: any) => [c.key, c.total ? rep.data.rows.reduce((s: number, r: any) => s + (Number(r[c.key]) || 0), 0) : null])) : null, [rep.data]);
  const dl = async (format: string) => {
    setBusy(format); setErr(null);
    try { await download(`/leagues/${leagueId}/reports/${key}?format=${format}&${qs}`, `${key}.${format}`); } catch (e) { setErr(e); } finally { setBusy(null); }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle={`${list.data?.length ?? ''} ready-made reports across finance, commercial, cricket and operations — view on screen or download as Excel, PDF or CSV.`} />
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card padded={false}>
          <div className="border-b border-ink-100 p-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Find a report" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-2">
            {GROUPS.map((g) => {
              const items = filtered.filter((r) => r.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="mb-3">
                  <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">{g}</p>
                  {items.map((r) => (
                    <button key={r.key} onClick={() => setKey(r.key)} className={cx('w-full rounded-lg px-3 py-2 text-left text-sm transition', key === r.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-700 hover:bg-ink-50')}>{r.title}</button>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{rep.data?.title ?? '…'}</h2>
                <p className="text-sm text-ink-500">{rep.data?.description}</p>
              </div>
              {rep.data?.usesPeriod && <><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              <Button loading={busy === 'xlsx'} onClick={() => dl('xlsx')}><FileSpreadsheet className="h-4 w-4" />Excel (.xlsx)</Button>
              <Button variant="secondary" loading={busy === 'pdf'} onClick={() => dl('pdf')}><FileText className="h-4 w-4" />PDF</Button>
              <Button variant="secondary" loading={busy === 'csv'} onClick={() => dl('csv')}><FileDown className="h-4 w-4" />CSV</Button>
              <Button variant="ghost" onClick={() => window.print()}>Print</Button>
            </div>
            <div className="mt-2"><ErrorText error={err} /></div>
          </Card>
          {rep.data?.summary && (
            <div className="grid gap-3 sm:grid-cols-4">{rep.data.summary.map((s: any) => <div key={s.label} className="card p-4"><p className="text-xs font-semibold uppercase text-ink-500">{s.label}</p><p className="mt-1 text-xl font-bold">{s.type === 'money' ? fmt({ type: 'money' }, s.value) : s.value}</p></div>)}</div>
          )}
          <Card padded={false}>
            {rep.isLoading ? <Spinner /> : !rep.data?.rows.length ? <Empty icon={<BarChart3 className="h-5 w-5" />} title="No data yet" text="This report fills up automatically as you use SportsIQ." /> : (
              <div className="max-h-[65vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-ink-50"><tr>{rep.data.columns.map((c: any) => <th key={c.key} className={cx('th', c.type && c.type !== 'text' && 'text-right')}>{c.label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {rep.data.rows.map((r: any, i: number) => (
                      <tr key={i} className={cx(r._bold && 'bg-ink-50 font-semibold')}>{rep.data.columns.map((c: any) => <td key={c.key} className={cx('td max-w-xs truncate', c.type && c.type !== 'text' && 'text-right tabular-nums')} title={String(r[c.key] ?? '')}>{fmt(c, r[c.key])}</td>)}</tr>
                    ))}
                    {totals && <tr className="bg-ink-100 font-bold">{rep.data.columns.map((c: any, i: number) => <td key={c.key} className={cx('td', c.type && c.type !== 'text' && 'text-right')}>{c.total ? fmt(c, totals[c.key]) : i === 0 ? 'TOTAL' : ''}</td>)}</tr>}
                  </tbody>
                </table>
              </div>
            )}
            {rep.data?.notes?.length > 0 && <div className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">{rep.data.notes.map((n: string) => <p key={n}>{n}</p>)}</div>}
          </Card>
        </div>
      </div>
    </>
  );
}
