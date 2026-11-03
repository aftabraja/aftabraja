import { prisma } from '../lib/prisma.js';
import { financeSummary, type Period } from '../lib/finance.js';
import { standings } from '../lib/standings.js';
import { buildInnings } from '../lib/cricket.js';
import { ALL_STEPS, PLAYBOOK } from '../data/playbook.js';

export type ColType = 'text' | 'number' | 'money' | 'date' | 'datetime' | 'percent';
export interface Column { key: string; label: string; type?: ColType; total?: boolean; width?: number }
export interface ReportResult { columns: Column[]; rows: Record<string, unknown>[]; notes?: string[]; summary?: { label: string; value: string | number; type?: ColType }[] }
export interface ReportDef { key: string; title: string; group: string; description: string; usesPeriod?: boolean; run: (leagueId: string, p: Period) => Promise<ReportResult> }

const teamName = async (leagueId: string) => {
  const teams = await prisma.team.findMany({ where: { leagueId }, select: { id: true, name: true } });
  return (id?: string | null) => teams.find((t) => t.id === id)?.name ?? '';
};
const inRange = (d: Date | null | undefined, p: Period) => !d || ((!p.from || d >= p.from) && (!p.to || d <= p.to));

export const REPORTS: ReportDef[] = [
  // ======================= FINANCE =======================
  {
    key: 'pnl', title: 'Profit & Loss Statement', group: 'Finance', usesPeriod: true,
    description: 'Income by source, expenses by category, net profit and margin.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const rows = [
        { section: 'INCOME', head: '', amount: null, _bold: true },
        ...f.pnl.incomeBySource.map((x) => ({ section: '', head: x.source, amount: x.amount })),
        { section: '', head: 'Total income', amount: f.pnl.income, _bold: true },
        { section: 'EXPENSES', head: '', amount: null, _bold: true },
        ...f.pnl.expenseByCategory.map((x) => ({ section: '', head: x.category, amount: x.amount })),
        { section: '', head: 'Total expenses', amount: f.pnl.expense, _bold: true },
        { section: f.pnl.profit >= 0 ? 'NET PROFIT' : 'NET LOSS', head: `Margin ${f.pnl.margin}%`, amount: f.pnl.profit, _bold: true },
      ];
      return {
        columns: [{ key: 'section', label: 'Section', width: 18 }, { key: 'head', label: 'Head', width: 40 }, { key: 'amount', label: 'Amount (₹)', type: 'money', width: 18 }],
        rows,
        summary: [{ label: 'Income', value: f.pnl.income, type: 'money' }, { label: 'Expenses', value: f.pnl.expense, type: 'money' }, { label: 'Net', value: f.pnl.profit, type: 'money' }, { label: 'Margin', value: `${f.pnl.margin}%` }],
        notes: ['Amounts are taxable values (excluding GST).', 'Only approved expenses are included.', f.pnl.pendingApprovalCount ? `${f.pnl.pendingApprovalCount} expenses (₹${f.pnl.pendingApproval.toLocaleString('en-IN')}) are awaiting approval and not included.` : ''].filter(Boolean),
      };
    },
  },
  {
    key: 'budget-vs-actual', title: 'Budget vs Actual', group: 'Finance', usesPeriod: true,
    description: 'Planned budget, actual spend, committed (pending approval) and variance per category.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      return {
        columns: [{ key: 'category', label: 'Category', width: 28 }, { key: 'planned', label: 'Planned', type: 'money', total: true }, { key: 'actual', label: 'Actual', type: 'money', total: true }, { key: 'committed', label: 'Pending approval', type: 'money', total: true }, { key: 'variance', label: 'Variance', type: 'money', total: true }, { key: 'utilisation', label: 'Utilisation %', type: 'percent' }],
        rows: f.budget,
      };
    },
  },
  {
    key: 'expense-register', title: 'Expense Register', group: 'Finance', usesPeriod: true,
    description: 'Every expense with vendor, invoice, GST, TDS, payment mode and approval status.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      return {
        columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'category', label: 'Category', width: 22 }, { key: 'description', label: 'Description', width: 32 }, { key: 'payee', label: 'Vendor / payee', width: 24 }, { key: 'invoiceNo', label: 'Invoice no.' }, { key: 'amount', label: 'Amount', type: 'money', total: true }, { key: 'gstAmount', label: 'GST', type: 'money', total: true }, { key: 'tdsAmount', label: 'TDS', type: 'money', total: true }, { key: 'payable', label: 'Net payable', type: 'money', total: true }, { key: 'paymentMode', label: 'Mode' }, { key: 'status', label: 'Payment' }, { key: 'approval', label: 'Approval' }],
        rows: f.expenses.map((e) => ({ ...e, payee: e.vendor?.companyName ?? e.payee ?? '', payable: e.amount + e.gstAmount - e.tdsAmount, approval: e.approval.replace('_', ' ') })),
      };
    },
  },
  {
    key: 'expense-by-category', title: 'Expenses by Category', group: 'Finance', usesPeriod: true,
    description: 'Spend per category with share of total.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const total = f.pnl.expense || 1;
      return { columns: [{ key: 'category', label: 'Category', width: 30 }, { key: 'count', label: 'Entries', type: 'number', total: true }, { key: 'amount', label: 'Amount', type: 'money', total: true }, { key: 'share', label: 'Share %', type: 'percent' }],
        rows: f.pnl.expenseByCategory.map((x) => ({ ...x, count: f.expenses.filter((e) => e.category === x.category && e.approval === 'APPROVED').length, share: Math.round((x.amount / total) * 1000) / 10 })) };
    },
  },
  {
    key: 'expense-by-vendor', title: 'Expenses by Vendor', group: 'Finance', usesPeriod: true,
    description: 'Total paid and outstanding per vendor or payee.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const m = new Map<string, { vendor: string; entries: number; amount: number; paid: number; outstanding: number }>();
      f.expenses.filter((e) => e.approval === 'APPROVED').forEach((e) => {
        const k = e.vendor?.companyName ?? e.payee ?? 'Unspecified';
        const r = m.get(k) ?? { vendor: k, entries: 0, amount: 0, paid: 0, outstanding: 0 };
        const gross = e.amount + e.gstAmount - e.tdsAmount;
        r.entries++; r.amount += e.amount; if (e.status === 'PAID') r.paid += gross; else r.outstanding += gross;
        m.set(k, r);
      });
      return { columns: [{ key: 'vendor', label: 'Vendor / payee', width: 32 }, { key: 'entries', label: 'Entries', type: 'number', total: true }, { key: 'amount', label: 'Taxable amount', type: 'money', total: true }, { key: 'paid', label: 'Paid', type: 'money', total: true }, { key: 'outstanding', label: 'Outstanding', type: 'money', total: true }], rows: [...m.values()].sort((a, b) => b.amount - a.amount) };
    },
  },
  {
    key: 'income-register', title: 'Income Register', group: 'Finance', usesPeriod: true,
    description: 'All income entries plus ticket sales made through SportsIQ.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const tickets = f.ticketOrders.map((o) => ({ date: o.createdAt, source: 'Ticketing (SportsIQ sales)', description: `${o.qty} × ${o.category.name} — ${o.code}`, party: o.buyerName, invoiceNo: o.code, amount: o.amount, gstAmount: 0, status: 'PAID', paymentMode: 'Online / box office' }));
      return {
        columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'source', label: 'Source', width: 24 }, { key: 'description', label: 'Description', width: 34 }, { key: 'party', label: 'Party', width: 22 }, { key: 'invoiceNo', label: 'Invoice / ref' }, { key: 'amount', label: 'Amount', type: 'money', total: true }, { key: 'gstAmount', label: 'GST', type: 'money', total: true }, { key: 'status', label: 'Status' }, { key: 'paymentMode', label: 'Mode' }],
        rows: [...f.incomes, ...tickets].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
      };
    },
  },
  {
    key: 'receivables', title: 'Receivables (Money to collect)', group: 'Finance',
    description: 'Unpaid income with due dates and ageing, plus sold sponsorships not yet invoiced.',
    run: async (id) => {
      const incomes = await prisma.income.findMany({ where: { leagueId: id, status: { not: 'PAID' } }, orderBy: { dueDate: 'asc' } });
      const sold = await prisma.sponsorshipOpportunity.findMany({ where: { leagueId: id, status: 'SOLD' } });
      const invoiced = await prisma.income.findMany({ where: { leagueId: id, source: 'Sponsorship' }, select: { description: true } });
      const now = Date.now();
      const rows: Record<string, unknown>[] = incomes.map((i) => ({ party: i.party ?? '', source: i.source, description: i.description, invoiceNo: i.invoiceNo, due: i.dueDate, amount: i.amount + i.gstAmount, ageDays: i.dueDate ? Math.max(0, Math.floor((now - i.dueDate.getTime()) / 864e5)) : null, status: i.status }));
      sold.filter((o) => !invoiced.some((x) => x.description.includes(o.title))).forEach((o) => rows.push({ party: '', source: 'Sponsorship (sold, not invoiced)', description: o.title, invoiceNo: '', due: null, amount: o.price * o.slots, ageDays: null, status: 'NOT INVOICED' }));
      return { columns: [{ key: 'party', label: 'Party', width: 24 }, { key: 'source', label: 'Source', width: 26 }, { key: 'description', label: 'Description', width: 30 }, { key: 'invoiceNo', label: 'Invoice' }, { key: 'due', label: 'Due', type: 'date' }, { key: 'ageDays', label: 'Days overdue', type: 'number' }, { key: 'amount', label: 'Amount incl. GST', type: 'money', total: true }, { key: 'status', label: 'Status' }], rows };
    },
  },
  {
    key: 'payables', title: 'Payables (Money to pay)', group: 'Finance',
    description: 'Unpaid approved expenses with net payable after GST and TDS.',
    run: async (id) => {
      const ex = await prisma.expense.findMany({ where: { leagueId: id, status: { not: 'PAID' }, approval: 'APPROVED' }, orderBy: { date: 'asc' }, include: { vendor: true } });
      return { columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'payee', label: 'Vendor / payee', width: 28 }, { key: 'category', label: 'Category', width: 22 }, { key: 'description', label: 'Description', width: 30 }, { key: 'invoiceNo', label: 'Invoice' }, { key: 'payable', label: 'Net payable', type: 'money', total: true }, { key: 'status', label: 'Status' }],
        rows: ex.map((e) => ({ ...e, payee: e.vendor?.companyName ?? e.payee ?? '', payable: e.amount + e.gstAmount - e.tdsAmount })) };
    },
  },
  {
    key: 'gst-summary', title: 'GST Summary', group: 'Finance', usesPeriod: true,
    description: 'Output GST on income, input GST on expenses and net position by month.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const m = new Map<string, { month: string; outputGst: number; inputGst: number; net: number }>();
      const bump = (d: Date, k: 'outputGst' | 'inputGst', v: number) => { const key = d.toISOString().slice(0, 7); const r = m.get(key) ?? { month: key, outputGst: 0, inputGst: 0, net: 0 }; r[k] += v; r.net = r.outputGst - r.inputGst; m.set(key, r); };
      f.incomes.forEach((i) => bump(i.date, 'outputGst', i.gstAmount));
      f.expenses.filter((e) => e.approval === 'APPROVED').forEach((e) => bump(e.date, 'inputGst', e.gstAmount));
      return { columns: [{ key: 'month', label: 'Month' }, { key: 'outputGst', label: 'Output GST', type: 'money', total: true }, { key: 'inputGst', label: 'Input GST', type: 'money', total: true }, { key: 'net', label: 'Net GST', type: 'money', total: true }],
        rows: [...m.values()].sort((a, b) => a.month.localeCompare(b.month)), notes: ['Indicative summary for your accountant. Verify against GST returns and invoices.'] };
    },
  },
  {
    key: 'tds-summary', title: 'TDS Deducted', group: 'Finance', usesPeriod: true,
    description: 'TDS deducted on vendor and professional payments.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      return { columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'payee', label: 'Payee', width: 28 }, { key: 'category', label: 'Category', width: 22 }, { key: 'amount', label: 'Amount', type: 'money', total: true }, { key: 'tdsAmount', label: 'TDS', type: 'money', total: true }],
        rows: f.expenses.filter((e) => e.tdsAmount > 0 && e.approval === 'APPROVED').map((e) => ({ ...e, payee: e.vendor?.companyName ?? e.payee ?? '' })) };
    },
  },
  {
    key: 'monthly-cashflow', title: 'Monthly Cash Flow', group: 'Finance', usesPeriod: true,
    description: 'Income, expenses and net per month with running balance.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      let bal = 0;
      return { columns: [{ key: 'month', label: 'Month' }, { key: 'income', label: 'Income', type: 'money', total: true }, { key: 'expense', label: 'Expenses', type: 'money', total: true }, { key: 'net', label: 'Net', type: 'money', total: true }, { key: 'running', label: 'Running balance', type: 'money' }],
        rows: f.monthly.map((m) => ({ ...m, running: (bal += m.net) })) };
    },
  },
  {
    key: 'pending-approvals', title: 'Expenses Pending Approval', group: 'Finance',
    description: 'Expenses entered by staff above the approval limit, waiting for the owner.',
    run: async (id) => {
      const ex = await prisma.expense.findMany({ where: { leagueId: id, approval: 'PENDING_APPROVAL' }, orderBy: { date: 'asc' }, include: { vendor: true } });
      return { columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'category', label: 'Category', width: 22 }, { key: 'description', label: 'Description', width: 34 }, { key: 'payee', label: 'Payee', width: 24 }, { key: 'amount', label: 'Amount', type: 'money', total: true }], rows: ex.map((e) => ({ ...e, payee: e.vendor?.companyName ?? e.payee ?? '' })) };
    },
  },

  // ======================= COMMERCIAL =======================
  {
    key: 'sponsorship-inventory', title: 'Sponsorship Inventory & Sales', group: 'Commercial',
    description: 'Every sponsorship asset, price, slots, deliverables and status.',
    run: async (id) => {
      const o = await prisma.sponsorshipOpportunity.findMany({ where: { leagueId: id }, orderBy: { price: 'desc' } });
      return { columns: [{ key: 'title', label: 'Opportunity', width: 28 }, { key: 'tier', label: 'Tier' }, { key: 'price', label: 'Price', type: 'money' }, { key: 'slots', label: 'Slots', type: 'number', total: true }, { key: 'value', label: 'Total value', type: 'money', total: true }, { key: 'status', label: 'Status' }, { key: 'deliverables', label: 'Deliverables', width: 50 }],
        rows: o.map((x) => ({ ...x, value: x.price * x.slots, status: x.status.replace('_', ' '), deliverables: x.deliverables.join('; ') })) };
    },
  },
  {
    key: 'ticket-sales', title: 'Ticket Sales Summary', group: 'Commercial',
    description: 'Capacity, sold, occupancy, revenue and gate entries per ticket category.',
    run: async (id) => {
      const cats = await prisma.ticketCategory.findMany({ where: { leagueId: id }, include: { orders: { where: { status: 'PAID' } }, match: { select: { number: true } } } });
      return { columns: [{ key: 'name', label: 'Category', width: 24 }, { key: 'validFor', label: 'Valid for' }, { key: 'price', label: 'Price', type: 'money' }, { key: 'quantity', label: 'Capacity', type: 'number', total: true }, { key: 'sold', label: 'Sold', type: 'number', total: true }, { key: 'occupancy', label: 'Occupancy %', type: 'percent' }, { key: 'revenue', label: 'Revenue', type: 'money', total: true }, { key: 'entered', label: 'Entered', type: 'number', total: true }],
        rows: cats.map((c) => ({ ...c, validFor: c.match ? `Match ${c.match.number}` : 'Season', occupancy: c.quantity ? Math.round((c.sold / c.quantity) * 1000) / 10 : 0, revenue: c.orders.reduce((s, o) => s + o.amount, 0), entered: c.orders.reduce((s, o) => s + o.checkedIn, 0) })) };
    },
  },
  {
    key: 'ticket-orders', title: 'Ticket Orders', group: 'Commercial', usesPeriod: true,
    description: 'Every ticket order with buyer, quantity, amount and entry status.',
    run: async (id, p) => {
      const o = await prisma.ticketOrder.findMany({ where: { category: { leagueId: id } }, orderBy: { createdAt: 'desc' }, include: { category: { select: { name: true } } } });
      return { columns: [{ key: 'createdAt', label: 'Date', type: 'datetime' }, { key: 'code', label: 'Ticket code' }, { key: 'buyerName', label: 'Buyer', width: 22 }, { key: 'email', label: 'Email', width: 26 }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty', type: 'number', total: true }, { key: 'amount', label: 'Amount', type: 'money', total: true }, { key: 'checkedIn', label: 'Entered', type: 'number', total: true }, { key: 'status', label: 'Status' }],
        rows: o.filter((x) => inRange(x.createdAt, p)).map((x) => ({ ...x, category: x.category.name })) };
    },
  },

  // ======================= CRICKET =======================
  {
    key: 'fixtures-results', title: 'Fixtures & Results', group: 'Cricket',
    description: 'Every match with date, venue, teams, scores and result.',
    run: async (id) => {
      const ms = await prisma.match.findMany({ where: { leagueId: id }, orderBy: [{ startsAt: 'asc' }, { number: 'asc' }], include: { homeTeam: true, awayTeam: true, venue: true, balls: true } });
      return { columns: [{ key: 'number', label: 'No.', type: 'number' }, { key: 'startsAt', label: 'Date & time', type: 'datetime' }, { key: 'stage', label: 'Stage' }, { key: 'home', label: 'Home', width: 22 }, { key: 'away', label: 'Away', width: 22 }, { key: 'venue', label: 'Venue', width: 22 }, { key: 'score1', label: '1st innings' }, { key: 'score2', label: '2nd innings' }, { key: 'result', label: 'Result', width: 34 }],
        rows: ms.map((m) => { const i1 = buildInnings(m.balls, 1), i2 = buildInnings(m.balls, 2); return { ...m, home: m.homeTeam?.name ?? m.homeLabel, away: m.awayTeam?.name ?? m.awayLabel, venue: m.venue?.name ?? '', score1: i1.legalBalls ? `${i1.runs}/${i1.wickets} (${i1.overs})` : '', score2: i2.legalBalls ? `${i2.runs}/${i2.wickets} (${i2.overs})` : '', result: m.resultText ?? m.status.toLowerCase() }; }) };
    },
  },
  {
    key: 'points-table', title: 'Points Table', group: 'Cricket',
    description: 'Standings with played, won, lost, NRR and points.',
    run: async (id) => {
      const { rows } = await standings(id);
      return { columns: [{ key: 'pos', label: '#', type: 'number' }, { key: 'name', label: 'Team', width: 26 }, { key: 'played', label: 'P', type: 'number' }, { key: 'won', label: 'W', type: 'number' }, { key: 'lost', label: 'L', type: 'number' }, { key: 'tnr', label: 'T/NR', type: 'number' }, { key: 'nrr', label: 'NRR', type: 'number' }, { key: 'points', label: 'Pts', type: 'number' }],
        rows: rows.map((r, i) => ({ ...r, pos: i + 1, tnr: r.drawn + r.nr })) };
    },
  },
  {
    key: 'batting-stats', title: 'Batting Statistics', group: 'Cricket',
    description: 'Runs, average, strike rate, 4s, 6s, 50s and best score for every batter.',
    run: async (id) => {
      const tn = await teamName(id);
      const ms = await prisma.match.findMany({ where: { leagueId: id, status: { in: ['LIVE', 'COMPLETED'] } }, include: { balls: true } });
      const m = new Map<string, { player: string; team: string; inns: number; notOut: number; runs: number; balls: number; fours: number; sixes: number; fifties: number; best: number }>();
      for (const match of ms) for (const i of [1, 2]) {
        const inn = buildInnings(match.balls, i);
        for (const b of inn.batting) {
          const k = `${b.name}|${inn.battingTeamId}`;
          const r = m.get(k) ?? { player: b.name, team: tn(inn.battingTeamId), inns: 0, notOut: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, best: 0 };
          r.inns++; if (!b.out) r.notOut++; r.runs += b.runs; r.balls += b.balls; r.fours += b.fours; r.sixes += b.sixes; if (b.runs >= 50) r.fifties++; r.best = Math.max(r.best, b.runs);
          m.set(k, r);
        }
      }
      const rows = [...m.values()].map((r) => ({ ...r, avg: r.inns - r.notOut ? Math.round((r.runs / (r.inns - r.notOut)) * 100) / 100 : r.runs, sr: r.balls ? Math.round((r.runs / r.balls) * 10000) / 100 : 0 })).sort((a, b) => b.runs - a.runs);
      return { columns: [{ key: 'player', label: 'Player', width: 24 }, { key: 'team', label: 'Team', width: 22 }, { key: 'inns', label: 'Inns', type: 'number' }, { key: 'notOut', label: 'NO', type: 'number' }, { key: 'runs', label: 'Runs', type: 'number' }, { key: 'balls', label: 'Balls', type: 'number' }, { key: 'avg', label: 'Avg', type: 'number' }, { key: 'sr', label: 'SR', type: 'number' }, { key: 'fours', label: '4s', type: 'number' }, { key: 'sixes', label: '6s', type: 'number' }, { key: 'fifties', label: '50s', type: 'number' }, { key: 'best', label: 'HS', type: 'number' }], rows };
    },
  },
  {
    key: 'bowling-stats', title: 'Bowling Statistics', group: 'Cricket',
    description: 'Overs, wickets, economy, average, strike rate and best figures.',
    run: async (id) => {
      const ms = await prisma.match.findMany({ where: { leagueId: id, status: { in: ['LIVE', 'COMPLETED'] } }, include: { balls: true } });
      const tn = await teamName(id);
      const m = new Map<string, { player: string; team: string; balls: number; runs: number; wickets: number; maidens: number; bestW: number; bestR: number }>();
      for (const match of ms) for (const i of [1, 2]) {
        const inn = buildInnings(match.balls, i);
        const bowlingTeam = inn.battingTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
        for (const b of inn.bowling) {
          const k = `${b.name}|${bowlingTeam}`;
          const r = m.get(k) ?? { player: b.name, team: tn(bowlingTeam), balls: 0, runs: 0, wickets: 0, maidens: 0, bestW: -1, bestR: 0 };
          r.balls += b.balls; r.runs += b.runs; r.wickets += b.wickets; r.maidens += b.maidens;
          if (b.wickets > r.bestW || (b.wickets === r.bestW && b.runs < r.bestR)) { r.bestW = b.wickets; r.bestR = b.runs; }
          m.set(k, r);
        }
      }
      const rows = [...m.values()].map((r) => ({ ...r, overs: `${Math.floor(r.balls / 6)}.${r.balls % 6}`, econ: r.balls ? Math.round((r.runs / (r.balls / 6)) * 100) / 100 : 0, avg: r.wickets ? Math.round((r.runs / r.wickets) * 100) / 100 : null, best: `${r.bestW}/${r.bestR}` })).sort((a, b) => b.wickets - a.wickets || a.econ - b.econ);
      return { columns: [{ key: 'player', label: 'Player', width: 24 }, { key: 'team', label: 'Team', width: 22 }, { key: 'overs', label: 'Overs' }, { key: 'maidens', label: 'M', type: 'number' }, { key: 'runs', label: 'Runs', type: 'number' }, { key: 'wickets', label: 'Wkts', type: 'number' }, { key: 'econ', label: 'Econ', type: 'number' }, { key: 'avg', label: 'Avg', type: 'number' }, { key: 'best', label: 'Best' }], rows };
    },
  },
  {
    key: 'auction-results', title: 'Auction Results', group: 'Cricket',
    description: 'Every sold and unsold player with category, base and sold price.',
    run: async (id) => {
      const regs = await prisma.playerRegistration.findMany({ where: { leagueId: id, status: { in: ['SOLD', 'UNSOLD'] } }, include: { team: true, player: { include: { user: true } } }, orderBy: { soldPrice: 'desc' } });
      return { columns: [{ key: 'player', label: 'Player', width: 24 }, { key: 'role', label: 'Role' }, { key: 'category', label: 'Category' }, { key: 'basePrice', label: 'Base price', type: 'money' }, { key: 'soldPrice', label: 'Sold for', type: 'money', total: true }, { key: 'team', label: 'Team', width: 22 }, { key: 'status', label: 'Status' }],
        rows: regs.map((g) => ({ player: g.player.user.name, role: g.player.playingRole, category: g.category, basePrice: g.basePrice, soldPrice: g.soldPrice, team: g.team?.name ?? '', status: g.status })) };
    },
  },
  {
    key: 'team-squads', title: 'Team Squads & Purse', group: 'Cricket',
    description: 'Squad list per team with price paid and remaining purse.',
    run: async (id) => {
      const league = await prisma.league.findUniqueOrThrow({ where: { id }, include: { teams: { include: { players: { include: { player: { include: { user: true } } } } } } } });
      const rows: Record<string, unknown>[] = [];
      for (const t of league.teams) {
        const purse = t.purse ?? league.teamPurse ?? 0;
        const spent = t.players.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
        t.players.forEach((p) => rows.push({ team: t.name, player: p.player.user.name, role: p.player.playingRole, price: p.soldPrice, purse: '', remaining: '' }));
        rows.push({ team: t.name, player: `${t.players.length} players`, role: 'TEAM TOTAL', price: spent, purse, remaining: purse - spent, _bold: true });
      }
      return { columns: [{ key: 'team', label: 'Team', width: 24 }, { key: 'player', label: 'Player', width: 26 }, { key: 'role', label: 'Role' }, { key: 'price', label: 'Price', type: 'money' }, { key: 'purse', label: 'Purse', type: 'money' }, { key: 'remaining', label: 'Remaining', type: 'money' }], rows };
    },
  },
  {
    key: 'player-registrations', title: 'Player Registrations', group: 'Cricket',
    description: 'All registered players with contact, role, record and status.',
    run: async (id, p) => {
      const regs = await prisma.playerRegistration.findMany({ where: { leagueId: id }, include: { team: true, player: { include: { user: true } } }, orderBy: { createdAt: 'asc' } });
      return { columns: [{ key: 'createdAt', label: 'Registered', type: 'date' }, { key: 'name', label: 'Player', width: 24 }, { key: 'email', label: 'Email', width: 26 }, { key: 'phone', label: 'Phone' }, { key: 'city', label: 'City' }, { key: 'role', label: 'Role' }, { key: 'matches', label: 'M', type: 'number' }, { key: 'runs', label: 'Runs', type: 'number' }, { key: 'wickets', label: 'Wkts', type: 'number' }, { key: 'status', label: 'Status' }, { key: 'team', label: 'Team' }],
        rows: regs.filter((g) => inRange(g.createdAt, p)).map((g) => ({ createdAt: g.createdAt, name: g.player.user.name, email: g.player.user.email, phone: g.player.user.phone, city: g.player.city, role: g.player.playingRole, matches: g.player.matches, runs: g.player.runs, wickets: g.player.wickets, status: g.status, team: g.team?.name ?? '' })) };
    },
  },
  {
    key: 'trial-results', title: 'Trial Results', group: 'Cricket',
    description: 'Attendance and scout scores for every trial batch.',
    run: async (id) => {
      const trials = await prisma.trialEvent.findMany({ where: { leagueId: id }, include: { entries: true } });
      const regs = await prisma.playerRegistration.findMany({ where: { leagueId: id }, include: { player: { include: { user: true } } } });
      const rows = trials.flatMap((t) => t.entries.map((e) => { const g = regs.find((x) => x.id === e.regId); return { trial: t.title, player: g?.player.user.name ?? '', role: g?.player.playingRole, checkedIn: e.checkedInAt ? 'Yes' : 'No', batting: e.batting, bowling: e.bowling, fielding: e.fielding, fitness: e.fitness, total: e.total, status: g?.status, comments: e.comments }; })).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
      return { columns: [{ key: 'trial', label: 'Trial', width: 24 }, { key: 'player', label: 'Player', width: 22 }, { key: 'role', label: 'Role' }, { key: 'checkedIn', label: 'Attended' }, { key: 'batting', label: 'Bat', type: 'number' }, { key: 'bowling', label: 'Bowl', type: 'number' }, { key: 'fielding', label: 'Field', type: 'number' }, { key: 'fitness', label: 'Fit', type: 'number' }, { key: 'total', label: 'Total /40', type: 'number' }, { key: 'status', label: 'Status' }, { key: 'comments', label: 'Comments', width: 30 }], rows };
    },
  },

  // ======================= OPERATIONS =======================
  {
    key: 'playbook-progress', title: 'Execution Playbook Progress', group: 'Operations',
    description: 'Status of all 66 steps by phase, owner and criticality.',
    run: async (id) => {
      const prog = await prisma.leagueStepProgress.findMany({ where: { leagueId: id } });
      const rows = PLAYBOOK.flatMap((p, i) => p.steps.map((s) => { const r = prog.find((x) => x.stepKey === s.key); return { phase: `${i + 1}. ${p.title}`, step: s.title, owner: s.owner, critical: s.critical ? 'Yes' : '', status: (r?.status ?? 'NOT_STARTED').replace('_', ' '), notes: r?.notes ?? '', updated: r?.updatedAt ?? null }; }));
      const done = prog.filter((x) => x.status === 'DONE' || x.status === 'SKIPPED').length;
      return { columns: [{ key: 'phase', label: 'Phase', width: 30 }, { key: 'step', label: 'Step', width: 34 }, { key: 'owner', label: 'Owner', width: 18 }, { key: 'critical', label: 'Critical' }, { key: 'status', label: 'Status' }, { key: 'updated', label: 'Updated', type: 'date' }, { key: 'notes', label: 'Notes', width: 30 }], rows, summary: [{ label: 'Complete', value: `${Math.round((done / ALL_STEPS.length) * 100)}%` }, { label: 'Steps done', value: `${done}/${ALL_STEPS.length}` }] };
    },
  },
  {
    key: 'teams-owners', title: 'Teams & Owners', group: 'Operations',
    description: 'Every team with owners, share %, contact, franchise fee and purse.',
    run: async (id) => {
      const teams = await prisma.team.findMany({ where: { leagueId: id }, include: { owners: { include: { user: true } } }, orderBy: { name: 'asc' } });
      return { columns: [{ key: 'team', label: 'Team', width: 24 }, { key: 'city', label: 'City' }, { key: 'owner', label: 'Owner', width: 22 }, { key: 'share', label: 'Share %', type: 'percent' }, { key: 'email', label: 'Email', width: 26 }, { key: 'phone', label: 'Phone' }, { key: 'franchiseFee', label: 'Franchise fee', type: 'money' }, { key: 'purse', label: 'Purse', type: 'money' }],
        rows: teams.flatMap((t) => (t.owners.length ? t.owners : [null]).map((o) => ({ team: t.name, city: t.city, owner: o?.user.name ?? '— available —', share: o?.sharePct ?? null, email: o?.user.email ?? '', phone: o?.user.phone ?? '', franchiseFee: t.franchiseFee, purse: t.purse }))) };
    },
  },
  {
    key: 'management-team', title: 'Management Team', group: 'Operations',
    description: 'League staff by department with contacts.',
    run: async (id) => {
      const ms = await prisma.leagueMember.findMany({ where: { leagueId: id }, include: { user: true }, orderBy: { department: 'asc' } });
      return { columns: [{ key: 'name', label: 'Name', width: 24 }, { key: 'department', label: 'Department', width: 20 }, { key: 'title', label: 'Title', width: 22 }, { key: 'email', label: 'Email', width: 26 }, { key: 'phone', label: 'Phone' }], rows: ms.map((m) => ({ name: m.user.name, department: m.department, title: m.title, email: m.user.email, phone: m.user.phone })) };
    },
  },
  {
    key: 'accreditation-register', title: 'Accreditation Register', group: 'Operations',
    description: 'All accreditations with category, zones, validity and status.',
    run: async (id) => {
      const a = await prisma.accreditation.findMany({ where: { leagueId: id }, include: { category: true }, orderBy: { cardNo: 'asc' } });
      return { columns: [{ key: 'cardNo', label: 'Card no.', type: 'number' }, { key: 'version', label: 'Ver', type: 'number' }, { key: 'name', label: 'Name', width: 24 }, { key: 'organisation', label: 'Organisation', width: 22 }, { key: 'designation', label: 'Designation' }, { key: 'category', label: 'Category' }, { key: 'zones', label: 'Zones' }, { key: 'idCheck', label: 'ID check' }, { key: 'validFrom', label: 'From', type: 'date' }, { key: 'validTo', label: 'To', type: 'date' }, { key: 'status', label: 'Status' }],
        rows: a.map((x) => ({ ...x, category: x.category.name, zones: x.zones.join(' '), idCheck: x.idType ? `${x.idType} ••${x.idLast4 ?? ''} ${x.idVerified ? '✓' : '✗'}` : '' })) };
    },
  },
  {
    key: 'accreditation-scans', title: 'Accreditation Gate Scans', group: 'Operations', usesPeriod: true,
    description: 'Every gate scan with zone, decision and reason.',
    run: async (id, p) => {
      const s = await prisma.accredScan.findMany({ where: { accreditation: { leagueId: id } }, orderBy: { createdAt: 'desc' }, include: { accreditation: { include: { category: true } } } });
      return { columns: [{ key: 'createdAt', label: 'Time', type: 'datetime' }, { key: 'name', label: 'Holder', width: 24 }, { key: 'cardNo', label: 'Card', type: 'number' }, { key: 'category', label: 'Category' }, { key: 'zone', label: 'Zone' }, { key: 'decision', label: 'Decision' }, { key: 'reason', label: 'Reason', width: 34 }],
        rows: s.filter((x) => inRange(x.createdAt, p)).map((x) => ({ ...x, name: x.accreditation.name, cardNo: x.accreditation.cardNo, category: x.accreditation.category.name, decision: x.allowed ? 'ALLOWED' : 'DENIED' })) };
    },
  },
  {
    key: 'rooming-list', title: 'Rooming List', group: 'Operations',
    description: 'Hotel, room, type, group and occupants.',
    run: async (id) => {
      const rooms = await prisma.roomAllocation.findMany({ where: { hotel: { leagueId: id } }, include: { hotel: true }, orderBy: [{ hotelId: 'asc' }, { roomNo: 'asc' }] });
      return { columns: [{ key: 'hotel', label: 'Hotel', width: 26 }, { key: 'roomNo', label: 'Room' }, { key: 'roomType', label: 'Type' }, { key: 'group', label: 'Team / group', width: 22 }, { key: 'occupants', label: 'Occupants', width: 40 }, { key: 'pax', label: 'Pax', type: 'number', total: true }, { key: 'checkIn', label: 'Check-in', type: 'date' }, { key: 'checkOut', label: 'Check-out', type: 'date' }],
        rows: rooms.map((r) => ({ ...r, hotel: r.hotel.name, occupants: r.occupants.join(', '), pax: r.occupants.length, checkIn: r.checkIn ?? r.hotel.checkIn, checkOut: r.checkOut ?? r.hotel.checkOut })) };
    },
  },
  {
    key: 'travel-manifest', title: 'Travel Manifest', group: 'Operations',
    description: 'All flights, trains and road transfers with travellers, PNR and cost.',
    run: async (id) => {
      const t = await prisma.travelBooking.findMany({ where: { leagueId: id }, orderBy: { departAt: 'asc' } });
      const tn = await teamName(id);
      return { columns: [{ key: 'departAt', label: 'Departs', type: 'datetime' }, { key: 'mode', label: 'Mode' }, { key: 'route', label: 'Route', width: 26 }, { key: 'group', label: 'Team / group', width: 22 }, { key: 'carrier', label: 'Carrier' }, { key: 'reference', label: 'PNR / ref' }, { key: 'pax', label: 'Pax', type: 'number', total: true }, { key: 'cost', label: 'Cost', type: 'money', total: true }, { key: 'status', label: 'Status' }, { key: 'travellers', label: 'Travellers', width: 40 }],
        rows: t.map((x) => ({ ...x, route: `${x.fromPlace} → ${x.toPlace}`, group: tn(x.teamId) || x.group || '', pax: x.travellers.length, travellers: x.travellers.join(', ') })) };
    },
  },
  {
    key: 'vendor-spend', title: 'Vendors Engaged', group: 'Operations', usesPeriod: true,
    description: 'Marketplace vendors the league has paid, with categories and totals.',
    run: async (id, p) => {
      const f = await financeSummary(id, p);
      const m = new Map<string, { vendor: string; categories: Set<string>; amount: number }>();
      f.expenses.filter((e) => e.vendor && e.approval === 'APPROVED').forEach((e) => { const r = m.get(e.vendor!.id) ?? { vendor: e.vendor!.companyName, categories: new Set<string>(), amount: 0 }; r.categories.add(e.category); r.amount += e.amount; m.set(e.vendor!.id, r); });
      return { columns: [{ key: 'vendor', label: 'Vendor', width: 30 }, { key: 'categories', label: 'Used for', width: 40 }, { key: 'amount', label: 'Total', type: 'money', total: true }], rows: [...m.values()].map((r) => ({ ...r, categories: [...r.categories].join(', ') })) };
    },
  },
];

export const reportByKey = (k: string) => REPORTS.find((r) => r.key === k);
