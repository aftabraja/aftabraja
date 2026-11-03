import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react';
import { del, get, patch, post, put } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { date, inr, inrShort } from '../../lib/format';
import { Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, StatusBadge, Table, Tabs, cx } from '../../components/ui';

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
}

export default function Finance() {
  const { leagueId, league } = useLeague();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pnl' | 'budget' | 'expenses' | 'income'>('pnl');
  const [modal, setModal] = useState<'expense' | 'income' | 'budget' | null>(null);
  const fin = useQuery({ queryKey: ['finance', leagueId], queryFn: () => get(`/leagues/${leagueId}/finance`) });
  const meta = useQuery({ queryKey: ['finance-meta'], queryFn: () => get(`/leagues/${leagueId}/finance/meta`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['finance', leagueId] }); qc.invalidateQueries({ queryKey: ['dashboard', leagueId] }); };
  const delExp = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/finance/expenses/${id}`), onSuccess: refresh });
  const delInc = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/finance/incomes/${id}`), onSuccess: refresh });
  const payExp = useMutation({ mutationFn: (id: string) => patch(`/leagues/${leagueId}/finance/expenses/${id}`, { status: 'PAID' }), onSuccess: refresh });
  const payInc = useMutation({ mutationFn: (id: string) => patch(`/leagues/${leagueId}/finance/incomes/${id}`, { status: 'PAID' }), onSuccess: refresh });

  if (fin.isLoading) return <Spinner />;
  const { pnl, budget, expenses, incomes } = fin.data;
  const over = budget.filter((b: any) => b.overBudget);

  return (
    <>
      <PageHeader title="Finance & P&L" subtitle="Budget vs actual, every expense by category, all income, and a live profit & loss."
        actions={<>
          <Button variant="secondary" onClick={() => downloadCsv(`${league?.shortCode ?? 'league'}-pnl.csv`, [['Type', 'Category/Source', 'Description', 'Amount', 'Status', 'Date'], ...incomes.map((i: any) => ['Income', i.source, i.description, i.amount, i.status, date(i.date)]), ...expenses.map((e: any) => ['Expense', e.category, e.description, e.amount, e.status, date(e.date)])])}><Download className="h-4 w-4" />Export CSV</Button>
          <Button variant="secondary" onClick={() => setModal('income')}><Plus className="h-4 w-4" />Income</Button>
          <Button onClick={() => setModal('expense')}><Plus className="h-4 w-4" />Expense</Button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total income" value={inrShort(pnl.income)} sub={`${inrShort(pnl.receivablesPending)} receivable`} />
        <Stat label="Total expense" value={inrShort(pnl.expense)} sub={`${inrShort(pnl.payablesPending)} payable`} />
        <Stat label="Net profit / loss" value={inrShort(pnl.profit)} tone={pnl.profit >= 0 ? 'green' : 'red'} sub={`${pnl.margin}% margin`} />
        <Stat label="Budget used" value={`${pnl.plannedBudget ? Math.round((pnl.expense / pnl.plannedBudget) * 100) : 0}%`} sub={`of ${inrShort(pnl.plannedBudget)} planned`} />
      </div>
      {over.length > 0 && <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />Over budget: {over.map((b: any) => b.category).join(', ')}</div>}

      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'pnl', label: 'Profit & Loss' }, { value: 'budget', label: 'Budget vs Actual' }, { value: 'expenses', label: `Expenses (${expenses.length})` }, { value: 'income', label: `Income (${incomes.length})` }]} /></div>

      {tab === 'pnl' && (
        <Card title={`Profit & Loss statement — ${league?.name}`}>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="label">Income</p>
              {pnl.incomeBySource.map((x: any) => <Row key={x.source} label={x.source} value={x.amount} />)}
              <Row label="Total income" value={pnl.income} bold />
            </div>
            <div>
              <p className="label">Expenses</p>
              {pnl.expenseByCategory.sort((a: any, b: any) => b.amount - a.amount).map((x: any) => <Row key={x.category} label={x.category} value={x.amount} />)}
              <Row label="Total expenses" value={pnl.expense} bold />
            </div>
          </div>
          <div className={cx('mt-6 flex items-center justify-between rounded-xl px-5 py-4', pnl.profit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
            <span className="font-semibold">Net {pnl.profit >= 0 ? 'profit' : 'loss'}</span><span className="text-2xl font-extrabold">{inr(pnl.profit)}</span>
          </div>
        </Card>
      )}

      {tab === 'budget' && (
        <Card padded={false} title="Budget vs actual" action={<Button size="sm" variant="secondary" onClick={() => setModal('budget')}>Edit budget</Button>}>
          <Table head={['Category', 'Planned', 'Actual', 'Variance', 'Utilisation']} empty={!budget.length && <Empty title="No budget yet" text="Set a planned amount for each category." action={<Button onClick={() => setModal('budget')}>Plan budget</Button>} />}>
            {budget.map((b: any) => (
              <tr key={b.category}>
                <td className="td font-medium text-ink-900">{b.category}</td>
                <td className="td">{inr(b.planned)}</td>
                <td className="td">{inr(b.actual)}</td>
                <td className={cx('td font-semibold', b.variance < 0 ? 'text-red-600' : 'text-emerald-600')}>{inr(b.variance)}</td>
                <td className="td w-48"><Progress value={b.planned ? (b.actual / b.planned) * 100 : b.actual ? 100 : 0} tone={b.overBudget ? 'red' : 'brand'} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card padded={false}>
          <Table head={['Date', 'Category', 'Description', 'Vendor / payee', 'Amount', 'Status', '']} empty={!expenses.length && <Empty title="No expenses recorded" />}>
            {expenses.map((e: any) => (
              <tr key={e.id}>
                <td className="td">{date(e.date)}</td><td className="td">{e.category}</td><td className="td text-ink-900">{e.description}</td>
                <td className="td">{e.vendor?.companyName ?? e.payee ?? '—'}</td><td className="td font-semibold text-ink-900">{inr(e.amount)}</td>
                <td className="td"><StatusBadge status={e.status} /></td>
                <td className="td text-right"><div className="flex justify-end gap-1">{e.status !== 'PAID' && <Button size="sm" variant="secondary" onClick={() => payExp.mutate(e.id)}>Mark paid</Button>}<button onClick={() => confirm('Delete expense?') && delExp.mutate(e.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'income' && (
        <Card padded={false}>
          <Table head={['Date', 'Source', 'Description', 'Amount', 'Status', '']} empty={!incomes.length && <Empty title="No income recorded" />}>
            {incomes.map((i: any) => (
              <tr key={i.id}>
                <td className="td">{date(i.date)}</td><td className="td">{i.source}</td><td className="td text-ink-900">{i.description}</td>
                <td className="td font-semibold text-emerald-700">{inr(i.amount)}</td><td className="td"><StatusBadge status={i.status} /></td>
                <td className="td text-right"><div className="flex justify-end gap-1">{i.status !== 'PAID' && <Button size="sm" variant="secondary" onClick={() => payInc.mutate(i.id)}>Mark received</Button>}<button onClick={() => confirm('Delete income?') && delInc.mutate(i.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {modal === 'expense' && <EntryModal kind="expense" leagueId={leagueId} options={meta.data?.expenseCategories ?? []} onClose={() => { setModal(null); refresh(); }} />}
      {modal === 'income' && <EntryModal kind="income" leagueId={leagueId} options={meta.data?.incomeSources ?? []} onClose={() => { setModal(null); refresh(); }} />}
      {modal === 'budget' && <BudgetModal leagueId={leagueId} categories={meta.data?.expenseCategories ?? []} current={budget} onClose={() => { setModal(null); refresh(); }} />}
    </>
  );
}

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className={cx('flex justify-between border-b border-ink-100 py-2 text-sm', bold && 'border-b-0 pt-3 font-bold text-ink-900')}><span>{label}</span><span>{inr(value)}</span></div>
);

function EntryModal({ kind, leagueId, options, onClose }: { kind: 'expense' | 'income'; leagueId: string; options: string[]; onClose: () => void }) {
  const [f, setF] = useState({ cat: options[0] ?? '', description: '', amount: '', date: new Date().toISOString().slice(0, 10), status: 'PENDING', payee: '' });
  const save = useMutation({
    mutationFn: () => kind === 'expense'
      ? post(`/leagues/${leagueId}/finance/expenses`, { category: f.cat, description: f.description, amount: f.amount, date: f.date, status: f.status, payee: f.payee || null })
      : post(`/leagues/${leagueId}/finance/incomes`, { source: f.cat, description: f.description, amount: f.amount, date: f.date, status: f.status }),
    onSuccess: onClose,
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={kind === 'expense' ? 'Record expense' : 'Record income'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><ErrorText error={save.error} /></div>
        <Field label={kind === 'expense' ? 'Category' : 'Source'} className="col-span-2"><Select value={f.cat} onChange={set('cat')} options={options} /></Field>
        <Field label="Description" className="col-span-2"><Input value={f.description} onChange={set('description')} /></Field>
        <Field label="Amount (₹)"><Input type="number" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set('status')} options={['PENDING', 'PARTIAL', 'PAID']} /></Field>
        {kind === 'expense' && <Field label="Payee"><Input value={f.payee} onChange={set('payee')} /></Field>}
      </div>
    </Modal>
  );
}

function BudgetModal({ leagueId, categories, current, onClose }: { leagueId: string; categories: string[]; current: any[]; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(categories.map((c) => [c, String(current.find((b) => b.category === c)?.planned || '')])));
  const save = useMutation({ mutationFn: () => put(`/leagues/${leagueId}/finance/budget`, Object.entries(vals).filter(([, v]) => v !== '').map(([category, planned]) => ({ category, planned: Number(planned) }))), onSuccess: onClose });
  const total = Object.values(vals).reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <Modal open onClose={onClose} size="lg" title="Plan budget" footer={<><span className="mr-auto self-center text-sm font-semibold">Total: {inr(total)}</span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save budget</Button></>}>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {categories.map((c) => <Field key={c} label={c}><Input type="number" min={0} value={vals[c]} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} placeholder="0" /></Field>)}
      </div>
    </Modal>
  );
}
