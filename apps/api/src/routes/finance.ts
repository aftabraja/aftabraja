import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';

const r = Router({ mergeParams: true });
r.use(requireAuth);

export const EXPENSE_CATEGORIES = [
  'Venue & Grounds', 'Broadcast & Production', 'Jerseys & Kits', 'Equipment', 'Match Officials', 'Player Fees',
  'Travel', 'Accommodation', 'Food & Hospitality', 'Marketing & PR', 'Branding & Fabrication', 'Ceremonies & Events',
  'Prize Money & Trophies', 'Security & Medical', 'Staff & Manpower', 'Legal & Compliance', 'Insurance', 'Technology', 'Miscellaneous',
];
export const INCOME_SOURCES = ['Franchise Fee', 'Sponsorship', 'Broadcast Rights', 'Ticketing', 'Merchandise', 'Player Registration Fee', 'Hospitality', 'Other'];

r.get('/meta', (_req, res) => res.json({ expenseCategories: EXPENSE_CATEGORIES, incomeSources: INCOME_SOURCES }));

r.get('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const [expenses, incomes, budgets] = await Promise.all([
    prisma.expense.findMany({ where: { leagueId }, orderBy: { date: 'desc' }, include: { vendor: { select: { id: true, companyName: true } } } }),
    prisma.income.findMany({ where: { leagueId }, orderBy: { date: 'desc' } }),
    prisma.budgetLine.findMany({ where: { leagueId } }),
  ]);
  const byCat = new Map<string, number>();
  expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
  const bySource = new Map<string, number>();
  incomes.forEach((i) => bySource.set(i.source, (bySource.get(i.source) ?? 0) + i.amount));
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const cats = new Set([...budgets.map((b) => b.category), ...byCat.keys()]);
  res.json({
    expenses, incomes,
    budget: [...cats].map((category) => {
      const planned = budgets.find((b) => b.category === category)?.planned ?? 0;
      const actual = byCat.get(category) ?? 0;
      return { category, planned, actual, variance: planned - actual, overBudget: planned > 0 && actual > planned };
    }).sort((a, b) => b.actual - a.actual),
    pnl: {
      income: totalIncome,
      expense: totalExpense,
      profit: totalIncome - totalExpense,
      margin: totalIncome ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0,
      incomeBySource: [...bySource].map(([source, amount]) => ({ source, amount })),
      expenseByCategory: [...byCat].map(([category, amount]) => ({ category, amount })),
      receivablesPending: incomes.filter((i) => i.status !== 'PAID').reduce((s, i) => s + i.amount, 0),
      payablesPending: expenses.filter((e) => e.status !== 'PAID').reduce((s, e) => s + e.amount, 0),
      plannedBudget: budgets.reduce((s, b) => s + b.planned, 0),
    },
  });
}));

r.put('/budget', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const lines = z.array(z.object({ category: z.string(), planned: z.coerce.number().int().min(0) })).parse(req.body);
  await prisma.$transaction(lines.map((l) => prisma.budgetLine.upsert({
    where: { leagueId_category: { leagueId, category: l.category } }, update: { planned: l.planned }, create: { leagueId, ...l },
  })));
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'budget' } }, update: {}, create: { leagueId, stepKey: 'budget', status: 'IN_PROGRESS' } });
  res.json({ ok: true });
}));

const expenseSchema = z.object({
  category: z.string(), description: z.string().min(2), amount: z.coerce.number().int().min(0), date: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']).optional(), vendorId: z.string().optional().nullable(), payee: z.string().optional().nullable(),
});

r.post('/expenses', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const e = await prisma.expense.create({ data: { ...expenseSchema.parse(req.body), leagueId } });
  // Budget overshoot alert
  const [line, agg] = await Promise.all([
    prisma.budgetLine.findUnique({ where: { leagueId_category: { leagueId, category: e.category } } }),
    prisma.expense.aggregate({ where: { leagueId, category: e.category }, _sum: { amount: true } }),
  ]);
  if (line && line.planned > 0 && (agg._sum.amount ?? 0) > line.planned) {
    await notify(await leagueManagers(leagueId), `Budget overshoot: ${e.category}`, { body: `Spent ₹${(agg._sum.amount ?? 0).toLocaleString('en-IN')} vs planned ₹${line.planned.toLocaleString('en-IN')}`, link: `/leagues/${leagueId}/finance`, type: 'alert' });
  }
  await audit(me(req).id, 'create', 'Expense', e.id, { amount: e.amount });
  res.status(201).json(e);
}));

r.patch('/expenses/:eid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.expense.update({ where: { id: req.params.eid, leagueId: req.params.leagueId }, data: expenseSchema.partial().parse(req.body) }));
}));

r.delete('/expenses/:eid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.expense.delete({ where: { id: req.params.eid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

const incomeSchema = z.object({
  source: z.string(), description: z.string().min(2), amount: z.coerce.number().int().min(0), date: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']).optional(),
});

r.post('/incomes', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.status(201).json(await prisma.income.create({ data: { ...incomeSchema.parse(req.body), leagueId: req.params.leagueId } }));
}));

r.patch('/incomes/:iid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.income.update({ where: { id: req.params.iid, leagueId: req.params.leagueId }, data: incomeSchema.partial().parse(req.body) }));
}));

r.delete('/incomes/:iid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.income.delete({ where: { id: req.params.iid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

export default r;
