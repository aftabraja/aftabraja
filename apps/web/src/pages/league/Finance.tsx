import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Check, Paperclip, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { del, get, patch, post, put } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { date, dateInput, fileToDataUrl, inr, inrShort } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, StatusBadge, Table, Tabs, Textarea, cx } from '../../components/ui';

type Tab = 'pnl' | 'budget' | 'expenses' | 'income' | 'approvals' | 'monthly';

export default function Finance() {
  const { leagueId, isAdmin } = useLeague();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pnl');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState<{ kind: 'expense' | 'income'; entry?: any } | 'budget' | 'settings' | null>(null);
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  const fin = useQuery({ queryKey: ['finance', leagueId, qs], queryFn: () => get(`/leagues/${leagueId}/finance?${qs}`) });
  const meta = useQuery({ queryKey: ['finance-meta'], queryFn: () => get(`/leagues/${leagueId}/finance/meta`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['finance', leagueId] }); qc.invalidateQueries({ queryKey: ['dashboard', leagueId] }); };
  const delExp = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/finance/expenses/${id}`), onSuccess: refresh });
  const delInc = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/finance/incomes/${id}`), onSuccess: refresh });
  const payExp = useMutation({ mutationFn: (id: string) => patch(`/leagues/${leagueId}/finance/expenses/${id}`, { status: 'PAID', paidOn: new Date().toISOString() }), onSuccess: refresh });
  const payInc = useMutation({ mutationFn: (id: string) => patch(`/leagues/${leagueId}/finance/incomes/${id}`, { status: 'PAID', receivedOn: new Date().toISOString() }), onSuccess: refresh });
  const approve = useMutation({ mutationFn: ({ id, decision }: any) => post(`/leagues/${leagueId}/finance/expenses/${id}/approval`, { decision }), onSuccess: refresh });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [st, setSt] = useState('');

  const expenses = useMemo(() => (fin.data?.expenses ?? []).filter((e: any) => (!cat || e.category === cat) && (!st || e.status === st) && (!q || `${e.description} ${e.payee ?? ''} ${e.vendor?.companyName ?? ''} ${e.invoiceNo ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [fin.data, cat, st, q]);
  if (fin.isLoading) return <Spinner />;
  const { pnl, budget, incomes, monthly } = fin.data;
  const over = budget.filter((b: any) => b.overBudget);
  const pending = fin.data.expenses.filter((e: any) => e.approval === 'PENDING_APPROVAL');

  return (
    <>
      <PageHeader title="Finance & P&L" subtitle="Budgets, expenses, income, GST/TDS, approvals and a live P&L."
        actions={<>
          <Link to={`/leagues/${leagueId}/reports`}><Button variant="secondary"><BarChart3 className="h-4 w-4" />Reports & downloads</Button></Link>
          {isAdmin && <Button variant="ghost" onClick={() => setModal('settings')} aria-label="Finance settings"><Settings2 className="h-4 w-4" /></Button>}
          <Button variant="secondary" onClick={() => setModal({ kind: 'income' })}><Plus className="h-4 w-4" />Income</Button>
          <Button onClick={() => setModal({ kind: 'expense' })}><Plus className="h-4 w-4" />Expense</Button>
        </>} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {(from || to) && <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); }}><X className="h-4 w-4" />Clear</Button>}
          <p className="ml-auto text-xs text-ink-500">Amounts are taxable values; GST and TDS are tracked separately. Ticket sales made on SportsIQ are included automatically.</p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total income" value={inrShort(pnl.income)} sub={`${inrShort(pnl.receivablesPending)} still to collect`} />
        <Stat label="Total expense" value={inrShort(pnl.expense)} sub={`${inrShort(pnl.payablesPending)} still to pay`} />
        <Stat label="Net profit / loss" value={inrShort(pnl.profit)} tone={pnl.profit >= 0 ? 'green' : 'red'} sub={`${pnl.margin}% margin`} />
        <Stat label="Budget used" value={`${pnl.plannedBudget ? Math.round((pnl.expense / pnl.plannedBudget) * 100) : 0}%`} sub={`of ${inrShort(pnl.plannedBudget)} planned`} />
        <Stat label="Net GST" value={inrShort(pnl.gst.net)} sub={`Output ${inrShort(pnl.gst.output)} · Input ${inrShort(pnl.gst.input)}`} />
      </div>
      {over.length > 0 && <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />Over budget: {over.map((b: any) => b.category).join(', ')}</div>}
      {pending.length > 0 && <button onClick={() => setTab('approvals')} className="mt-4 flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />{pending.length} expense{pending.length > 1 ? 's' : ''} ({inr(pnl.pendingApproval)}) waiting for approval — not counted in actuals yet.</button>}

      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={[
        { value: 'pnl', label: 'Profit & Loss' }, { value: 'budget', label: 'Budget vs Actual' }, { value: 'expenses', label: `Expenses (${fin.data.expenses.length})` },
        { value: 'income', label: `Income (${incomes.length})` }, { value: 'monthly', label: 'Monthly' }, ...(pending.length ? [{ value: 'approvals' as const, label: `Approvals (${pending.length})` }] : []),
      ]} /></div>

      {tab === 'pnl' && (
        <Card title="Profit & Loss statement">
          <div className="grid gap-8 md:grid-cols-2">
            <div><p className="label">Income</p>{pnl.incomeBySource.map((x: any) => <Row key={x.source} label={x.source} value={x.amount} total={pnl.income} />)}<Row label="Total income" value={pnl.income} bold /></div>
            <div><p className="label">Expenses</p>{pnl.expenseByCategory.map((x: any) => <Row key={x.category} label={x.category} value={x.amount} total={pnl.expense} />)}<Row label="Total expenses" value={pnl.expense} bold /></div>
          </div>
          <div className={cx('mt-6 flex items-center justify-between rounded-xl px-5 py-4', pnl.profit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
            <span className="font-semibold">Net {pnl.profit >= 0 ? 'profit' : 'loss'} · {pnl.margin}% margin</span><span className="text-2xl font-extrabold">{inr(pnl.profit)}</span>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">GST payable (net)</p><p className="font-semibold">{inr(pnl.gst.net)}</p></div>
            <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">TDS deducted</p><p className="font-semibold">{inr(pnl.tdsDeducted)}</p></div>
            <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">Ticket sales on SportsIQ</p><p className="font-semibold">{inr(pnl.ticketRevenue)}</p></div>
          </div>
        </Card>
      )}

      {tab === 'budget' && (
        <Card padded={false} title="Budget vs actual" action={<Button size="sm" variant="secondary" onClick={() => setModal('budget')}>Edit budget</Button>}>
          <Table head={['Category', 'Planned', 'Actual', 'Pending approval', 'Variance', 'Utilisation']} empty={!budget.length && <Empty title="No budget yet" action={<Button onClick={() => setModal('budget')}>Plan budget</Button>} />}>
            {budget.map((b: any) => (
              <tr key={b.category}>
                <td className="td font-medium text-ink-900">{b.category}</td><td className="td">{inr(b.planned)}</td><td className="td">{inr(b.actual)}</td><td className="td text-amber-700">{b.committed ? inr(b.committed) : '—'}</td>
                <td className={cx('td font-semibold', b.variance < 0 ? 'text-red-600' : 'text-emerald-600')}>{inr(b.variance)}</td>
                <td className="td w-48"><div className="flex items-center gap-2"><Progress value={b.planned ? (b.actual / b.planned) * 100 : b.actual ? 100 : 0} tone={b.overBudget ? 'red' : 'brand'} /><span className="w-12 text-right text-xs">{b.utilisation != null ? `${b.utilisation}%` : '—'}</span></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card padded={false}>
          <div className="flex flex-wrap gap-2 border-b border-ink-100 p-4">
            <div className="relative w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Description, vendor, invoice" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{meta.data?.expenseCategories.map((c: string) => <option key={c}>{c}</option>)}</select>
            <select className="input w-auto" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Any payment status</option><option>PENDING</option><option>PARTIAL</option><option>PAID</option></select>
            <span className="ml-auto self-center text-sm text-ink-500">{expenses.length} entries · {inr(expenses.reduce((s: number, e: any) => s + e.amount, 0))}</span>
          </div>
          <Table head={['Date', 'Category', 'Description', 'Vendor / payee', 'Invoice', 'Amount', 'GST', 'TDS', 'Payment', 'Approval', '']} empty={!expenses.length && <Empty title="No expenses" />}>
            {expenses.map((e: any) => (
              <tr key={e.id}>
                <td className="td">{date(e.date)}</td><td className="td">{e.category}</td>
                <td className="td text-ink-900"><span className="flex items-center gap-1">{e.description}{e.receiptUrl && <a href={e.receiptUrl} download={`receipt-${e.invoiceNo ?? e.id}`} title="Receipt" className="text-brand-700"><Paperclip className="h-3.5 w-3.5" /></a>}</span></td>
                <td className="td">{e.vendor?.companyName ?? e.payee ?? '—'}</td><td className="td text-xs">{e.invoiceNo ?? '—'}</td>
                <td className="td font-semibold text-ink-900">{inr(e.amount)}</td><td className="td">{e.gstAmount ? inr(e.gstAmount) : '—'}</td><td className="td">{e.tdsAmount ? inr(e.tdsAmount) : '—'}</td>
                <td className="td"><StatusBadge status={e.status} /></td>
                <td className="td">{e.approval === 'APPROVED' ? <Badge color="green">approved</Badge> : e.approval === 'REJECTED' ? <Badge color="red">rejected</Badge> : <Badge color="amber">pending</Badge>}</td>
                <td className="td text-right"><div className="flex justify-end gap-1">
                  {e.status !== 'PAID' && e.approval === 'APPROVED' && <Button size="sm" variant="secondary" onClick={() => payExp.mutate(e.id)}>Mark paid</Button>}
                  <button onClick={() => setModal({ kind: 'expense', entry: e })} className="p-1.5 text-ink-400 hover:text-ink-900" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => confirm('Delete expense?') && delExp.mutate(e.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'income' && (
        <Card padded={false}>
          <Table head={['Date', 'Source', 'Description', 'Party', 'Invoice', 'Amount', 'GST', 'Due', 'Status', '']} empty={!incomes.length && <Empty title="No income recorded" />}>
            {incomes.map((i: any) => (
              <tr key={i.id}>
                <td className="td">{date(i.date)}</td><td className="td">{i.source}</td><td className="td text-ink-900">{i.description}</td><td className="td">{i.party ?? '—'}</td><td className="td text-xs">{i.invoiceNo ?? '—'}</td>
                <td className="td font-semibold text-emerald-700">{inr(i.amount)}</td><td className="td">{i.gstAmount ? inr(i.gstAmount) : '—'}</td>
                <td className={cx('td', i.status !== 'PAID' && i.dueDate && new Date(i.dueDate) < new Date() && 'font-semibold text-red-600')}>{date(i.dueDate)}</td>
                <td className="td"><StatusBadge status={i.status} /></td>
                <td className="td text-right"><div className="flex justify-end gap-1">{i.status !== 'PAID' && <Button size="sm" variant="secondary" onClick={() => payInc.mutate(i.id)}>Mark received</Button>}<button onClick={() => setModal({ kind: 'income', entry: i })} className="p-1.5 text-ink-400 hover:text-ink-900" aria-label="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => confirm('Delete income?') && delInc.mutate(i.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'monthly' && (
        <Card title="Monthly income vs expenses">
          {!monthly.length ? <Empty title="No transactions yet" /> : (
            <div className="space-y-4">
              {monthly.map((m: any) => {
                const max = Math.max(...monthly.map((x: any) => Math.max(x.income, x.expense)), 1);
                return (
                  <div key={m.month} className="grid grid-cols-[80px_1fr_120px] items-center gap-4 text-sm">
                    <span className="font-semibold">{new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><div className="h-3 rounded bg-emerald-500" style={{ width: `${(m.income / max) * 100}%` }} /><span className="text-xs text-ink-500">{inrShort(m.income)}</span></div>
                      <div className="flex items-center gap-2"><div className="h-3 rounded bg-red-400" style={{ width: `${(m.expense / max) * 100}%` }} /><span className="text-xs text-ink-500">{inrShort(m.expense)}</span></div>
                    </div>
                    <span className={cx('text-right font-bold', m.net >= 0 ? 'text-emerald-700' : 'text-red-600')}>{inr(m.net)}</span>
                  </div>
                );
              })}
              <p className="text-xs text-ink-500"><span className="mr-1 inline-block h-2 w-3 rounded bg-emerald-500" />Income <span className="ml-3 mr-1 inline-block h-2 w-3 rounded bg-red-400" />Expenses</p>
            </div>
          )}
        </Card>
      )}

      {tab === 'approvals' && (
        <Card padded={false} title="Expenses waiting for approval">
          <Table head={['Date', 'Category', 'Description', 'Payee', 'Amount', '']}>
            {pending.map((e: any) => (
              <tr key={e.id}>
                <td className="td">{date(e.date)}</td><td className="td">{e.category}</td><td className="td text-ink-900">{e.description}</td><td className="td">{e.vendor?.companyName ?? e.payee ?? '—'}</td><td className="td font-semibold">{inr(e.amount)}</td>
                <td className="td text-right">{fin.data.canApprove ? <div className="flex justify-end gap-2"><Button size="sm" variant="success" onClick={() => approve.mutate({ id: e.id, decision: 'APPROVED' })}><Check className="h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="secondary" onClick={() => approve.mutate({ id: e.id, decision: 'REJECTED' })}>Reject</Button></div> : <span className="text-xs text-ink-500">Owner approval needed</span>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {modal && typeof modal === 'object' && <EntryModal kind={modal.kind} entry={modal.entry} leagueId={leagueId} meta={meta.data} vendors={fin.data.vendors} onClose={() => { setModal(null); refresh(); }} />}
      {modal === 'budget' && <BudgetModal leagueId={leagueId} categories={meta.data?.expenseCategories ?? []} current={budget} onClose={() => { setModal(null); refresh(); }} />}
      {modal === 'settings' && <SettingsModal leagueId={leagueId} limit={fin.data.approvalLimit} onClose={() => { setModal(null); refresh(); }} />}
    </>
  );
}

const Row = ({ label, value, bold, total }: { label: string; value: number; bold?: boolean; total?: number }) => (
  <div className={cx('flex justify-between gap-3 border-b border-ink-100 py-2 text-sm', bold && 'border-b-0 pt-3 font-bold text-ink-900')}>
    <span>{label}{total ? <span className="ml-2 text-xs text-ink-400">{Math.round((value / (total || 1)) * 100)}%</span> : null}</span><span>{inr(value)}</span>
  </div>
);

function EntryModal({ kind, entry, leagueId, meta, vendors, onClose }: { kind: 'expense' | 'income'; entry?: any; leagueId: string; meta: any; vendors: any[]; onClose: () => void }) {
  const e = entry ?? {};
  const [f, setF] = useState<any>({
    cat: e.category ?? e.source ?? (kind === 'expense' ? meta?.expenseCategories[0] : meta?.incomeSources[0]) ?? '', description: e.description ?? '', amount: e.amount ?? '', gstAmount: e.gstAmount || '', tdsAmount: e.tdsAmount || '',
    date: dateInput(e.date ?? new Date().toISOString()), status: e.status ?? 'PENDING', vendorId: e.vendorId ?? '', payee: e.payee ?? '', party: e.party ?? '', invoiceNo: e.invoiceNo ?? '', paymentMode: e.paymentMode ?? '',
    dueDate: dateInput(e.dueDate), receiptUrl: e.receiptUrl ?? '', notes: e.notes ?? '',
  });
  const gstRate = (r: number) => setF({ ...f, gstAmount: Math.round((Number(f.amount) || 0) * r / 100) });
  const save = useMutation({
    mutationFn: () => {
      const common = { description: f.description, amount: f.amount, gstAmount: f.gstAmount || 0, date: f.date, status: f.status, invoiceNo: f.invoiceNo || null, paymentMode: f.paymentMode || null, notes: f.notes || null };
      const body = kind === 'expense'
        ? { ...common, category: f.cat, vendorId: f.vendorId || null, payee: f.payee || null, tdsAmount: f.tdsAmount || 0, receiptUrl: f.receiptUrl || null }
        : { ...common, source: f.cat, party: f.party || null, dueDate: f.dueDate || null };
      const base = `/leagues/${leagueId}/finance/${kind === 'expense' ? 'expenses' : 'incomes'}`;
      return entry ? patch(`${base}/${entry.id}`, body) : post(base, body);
    },
    onSuccess: onClose,
  });
  const set = (k: string) => (ev: any) => setF({ ...f, [k]: ev.target.value });
  const total = (Number(f.amount) || 0) + (Number(f.gstAmount) || 0) - (kind === 'expense' ? Number(f.tdsAmount) || 0 : 0);
  return (
    <Modal open onClose={onClose} size="lg" title={`${entry ? 'Edit' : 'Record'} ${kind}`} footer={<><span className="mr-auto self-center text-sm">{kind === 'expense' ? 'Net payable' : 'Invoice total'}: <b>{inr(total)}</b></span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><ErrorText error={save.error} /></div>
        <Field label={kind === 'expense' ? 'Category' : 'Source'}><Select value={f.cat} onChange={set('cat')} options={(kind === 'expense' ? meta?.expenseCategories : meta?.incomeSources) ?? []} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={set('description')} /></Field>
        {kind === 'expense' ? <>
          <Field label="Marketplace vendor"><Select value={f.vendorId} onChange={set('vendorId')} placeholder="— not on SportsIQ —" options={vendors.map((v) => ({ value: v.id, label: v.companyName }))} /></Field>
          <Field label="Or payee name"><Input value={f.payee} onChange={set('payee')} /></Field>
        </> : <>
          <Field label="Party (who pays)"><Input value={f.party} onChange={set('party')} /></Field>
          <Field label="Due date"><Input type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        </>}
        <Field label="Invoice no."><Input value={f.invoiceNo} onChange={set('invoiceNo')} /></Field>
        <Field label="Amount, excl. GST (₹)"><Input type="number" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="GST (₹)" hint={<span className="flex gap-2">{[5, 12, 18, 28].map((r) => <button key={r} type="button" className="text-brand-700 hover:underline" onClick={() => gstRate(r)}>{r}%</button>)}</span>}><Input type="number" value={f.gstAmount} onChange={set('gstAmount')} /></Field>
        {kind === 'expense' ? <Field label="TDS deducted (₹)"><Input type="number" value={f.tdsAmount} onChange={set('tdsAmount')} /></Field> : <div />}
        <Field label="Date"><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Payment status"><Select value={f.status} onChange={set('status')} options={['PENDING', 'PARTIAL', 'PAID']} /></Field>
        <Field label="Payment mode"><Select value={f.paymentMode} onChange={set('paymentMode')} placeholder="—" options={meta?.paymentModes ?? []} /></Field>
        {kind === 'expense' && (
          <div className="sm:col-span-3">
            <p className="label">Bill / receipt</p>
            <div className="flex items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-semibold hover:bg-ink-50"><Paperclip className="h-4 w-4" />{f.receiptUrl ? 'Replace' : 'Attach'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={async (ev) => { const x = ev.target.files?.[0]; if (x) { if (x.size > 3e6) return alert('Please attach a file under 3 MB'); setF({ ...f, receiptUrl: await fileToDataUrl(x) }); } }} /></label>
              {f.receiptUrl && <span className="text-sm text-emerald-700">Receipt attached</span>}
            </div>
          </div>
        )}
        <Field label="Notes" className="sm:col-span-3"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
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
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{categories.map((c) => <Field key={c} label={c}><Input type="number" min={0} value={vals[c]} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} placeholder="0" /></Field>)}</div>
      <p className="mt-4 text-xs text-ink-500">Tip: keep 8–10% as contingency under Miscellaneous.</p>
    </Modal>
  );
}

function SettingsModal({ leagueId, limit, onClose }: { leagueId: string; limit: number | null; onClose: () => void }) {
  const [v, setV] = useState(limit ?? '');
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/finance/settings`, { expenseApprovalLimit: v === '' ? null : Number(v) }), onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="sm" title="Finance controls" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <Field label="Approval limit for staff expenses (₹)" hint="Expenses entered by your management team above this amount need your approval before they count. Leave empty for no approval."><Input type="number" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 25000" /></Field>
    </Modal>
  );
}
