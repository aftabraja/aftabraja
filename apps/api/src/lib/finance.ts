import { prisma } from './prisma.js';

export interface Period { from?: Date; to?: Date }
const inPeriod = (p: Period) => ({ ...(p.from || p.to ? { date: { ...(p.from && { gte: p.from }), ...(p.to && { lte: p.to }) } } : {}) });

/**
 * Single source of truth for league money: used by the Finance page and every financial report.
 * - Expense/Income `amount` is the taxable value; GST is stored separately.
 * - Only APPROVED expenses count as actuals; pending approvals are reported separately.
 * - Ticket sales made through SportsIQ are included automatically (no double entry needed).
 */
export async function financeSummary(leagueId: string, period: Period = {}) {
  const [expensesAll, incomes, budgets, ticketOrders] = await Promise.all([
    prisma.expense.findMany({ where: { leagueId, ...inPeriod(period) }, orderBy: { date: 'desc' }, include: { vendor: { select: { id: true, companyName: true } } } }),
    prisma.income.findMany({ where: { leagueId, ...inPeriod(period) }, orderBy: { date: 'desc' } }),
    prisma.budgetLine.findMany({ where: { leagueId } }),
    prisma.ticketOrder.findMany({ where: { status: 'PAID', category: { leagueId }, ...(period.from || period.to ? { createdAt: { ...(period.from && { gte: period.from }), ...(period.to && { lte: period.to }) } } : {}) }, include: { category: { select: { name: true } } } }),
  ]);
  const expenses = expensesAll.filter((e) => e.approval === 'APPROVED');
  const pendingApproval = expensesAll.filter((e) => e.approval === 'PENDING_APPROVAL');
  const ticketRevenue = ticketOrders.reduce((s, o) => s + o.amount, 0);

  const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const group = <T>(xs: T[], k: (x: T) => string, v: (x: T) => number) => {
    const m = new Map<string, number>();
    xs.forEach((x) => m.set(k(x), (m.get(k(x)) ?? 0) + v(x)));
    return [...m].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);
  };

  const incomeBySource = group(incomes, (i) => i.source, (i) => i.amount);
  if (ticketRevenue) incomeBySource.push({ key: 'Ticketing (SportsIQ sales)', amount: ticketRevenue });
  incomeBySource.sort((a, b) => b.amount - a.amount);
  const expenseByCategory = group(expenses, (e) => e.category, (e) => e.amount);
  const totalIncome = sum(incomes, (i) => i.amount) + ticketRevenue;
  const totalExpense = sum(expenses, (e) => e.amount);

  const cats = new Set([...budgets.map((b) => b.category), ...expenseByCategory.map((x) => x.key)]);
  const budget = [...cats].map((category) => {
    const planned = budgets.find((b) => b.category === category)?.planned ?? 0;
    const actual = expenseByCategory.find((x) => x.key === category)?.amount ?? 0;
    const committed = sum(pendingApproval.filter((e) => e.category === category), (e) => e.amount);
    return { category, planned, actual, committed, variance: planned - actual, utilisation: planned ? Math.round((actual / planned) * 1000) / 10 : null, overBudget: planned > 0 && actual > planned };
  }).sort((a, b) => b.actual - a.actual);

  // Monthly cash view
  const months = new Map<string, { month: string; income: number; expense: number }>();
  const mk = (d: Date) => d.toISOString().slice(0, 7);
  const bump = (d: Date, k: 'income' | 'expense', v: number) => { const m = mk(d); const r = months.get(m) ?? { month: m, income: 0, expense: 0 }; r[k] += v; months.set(m, r); };
  incomes.forEach((i) => bump(i.date, 'income', i.amount));
  ticketOrders.forEach((o) => bump(o.createdAt, 'income', o.amount));
  expenses.forEach((e) => bump(e.date, 'expense', e.amount));
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, net: m.income - m.expense }));

  const gstOutput = sum(incomes, (i) => i.gstAmount);
  const gstInput = sum(expenses, (e) => e.gstAmount);

  return {
    expenses: expensesAll, incomes, ticketOrders, budgetLines: budgets, budget, monthly,
    pnl: {
      income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense,
      margin: totalIncome ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0,
      incomeBySource: incomeBySource.map(({ key, amount }) => ({ source: key, amount })),
      expenseByCategory: expenseByCategory.map(({ key, amount }) => ({ category: key, amount })),
      receivablesPending: sum(incomes.filter((i) => i.status !== 'PAID'), (i) => i.amount + i.gstAmount),
      payablesPending: sum(expenses.filter((e) => e.status !== 'PAID'), (e) => e.amount + e.gstAmount - e.tdsAmount),
      pendingApproval: sum(pendingApproval, (e) => e.amount),
      pendingApprovalCount: pendingApproval.length,
      plannedBudget: sum(budgets, (b) => b.planned),
      ticketRevenue,
      gst: { output: gstOutput, input: gstInput, net: gstOutput - gstInput },
      tdsDeducted: sum(expenses, (e) => e.tdsAmount),
    },
  };
}
