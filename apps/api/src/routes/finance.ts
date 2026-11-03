import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { financeSummary } from '../lib/finance.js';

const r = Router({ mergeParams: true });
r.use(requireAuth);

export const EXPENSE_CATEGORIES = [
  'Venue & Grounds', 'Broadcast & Production', 'Jerseys & Kits', 'Equipment', 'Match Officials', 'Player Fees',
  'Travel', 'Accommodation', 'Food & Hospitality', 'Marketing & PR', 'Branding & Fabrication', 'Ceremonies & Events',
  'Prize Money & Trophies', 'Security & Medical', 'Staff & Manpower', 'Legal & Compliance', 'Insurance', 'Technology', 'Accreditation & Printing', 'Miscellaneous',
];
export const INCOME_SOURCES = ['Franchise Fee', 'Sponsorship', 'Broadcast Rights', 'Ticketing', 'Merchandise', 'Player Registration Fee', 'Hospitality', 'Other'];
export const PAYMENT_MODES = ['Bank transfer', 'UPI', 'Cash', 'Card', 'Cheque'];

const period = (q: Record<string, unknown>) => {
  const p = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(q);
  if (p.to) p.to = new Date(p.to.getTime() + 864e5 - 1);
  return p;
};

r.get('/meta', (_req, res) => res.json({ expenseCategories: EXPENSE_CATEGORIES, incomeSources: INCOME_SOURCES, paymentModes: PAYMENT_MODES }));

r.get('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const access = await assertLeague(me(req), leagueId, 'staff');
  const [f, league, vendors] = await Promise.all([
    financeSummary(leagueId, period(req.query)),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { expenseApprovalLimit: true } }),
    prisma.vendorProfile.findMany({ select: { id: true, companyName: true }, orderBy: { companyName: 'asc' } }),
  ]);
  res.json({ ...f, budgetLines: undefined, ticketOrders: undefined, approvalLimit: league.expenseApprovalLimit, canApprove: access === 'admin', vendors });
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

r.patch('/settings', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'admin');
  const d = z.object({ expenseApprovalLimit: z.coerce.number().int().min(0).nullable() }).parse(req.body);
  res.json(await prisma.league.update({ where: { id: req.params.leagueId }, data: d, select: { expenseApprovalLimit: true } }));
}));

const money = z.coerce.number().int().min(0);
const expenseSchema = z.object({
  category: z.string(), description: z.string().min(2), amount: money, date: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']).optional(), vendorId: z.string().optional().nullable(), payee: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(), gstAmount: money.optional(), tdsAmount: money.optional(), paymentMode: z.string().optional().nullable(),
  paidOn: z.coerce.date().optional().nullable(), receiptUrl: z.string().optional().nullable(), notes: z.string().optional().nullable(),
});

async function overshootAlert(leagueId: string, category: string) {
  const [line, agg] = await Promise.all([
    prisma.budgetLine.findUnique({ where: { leagueId_category: { leagueId, category } } }),
    prisma.expense.aggregate({ where: { leagueId, category, approval: 'APPROVED' }, _sum: { amount: true } }),
  ]);
  if (line && line.planned > 0 && (agg._sum.amount ?? 0) > line.planned) {
    await notify(await leagueManagers(leagueId), `Budget overshoot: ${category}`, { body: `Spent ₹${(agg._sum.amount ?? 0).toLocaleString('en-IN')} vs planned ₹${line.planned.toLocaleString('en-IN')}`, link: `/leagues/${leagueId}/finance`, type: 'alert' });
  }
}

r.post('/expenses', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  const access = await assertLeague(u, leagueId, 'staff');
  const d = expenseSchema.parse(req.body);
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  // Staff expenses above the owner's limit wait for approval before counting in actuals
  const needsApproval = access !== 'admin' && league.expenseApprovalLimit != null && d.amount > league.expenseApprovalLimit;
  const e = await prisma.expense.create({ data: { ...d, leagueId, createdById: u.id, approval: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED', approvedById: needsApproval ? null : u.id } });
  if (needsApproval) await notify(league.ownerId, `Expense awaiting approval: ₹${d.amount.toLocaleString('en-IN')}`, { body: `${d.category} — ${d.description} (by ${u.name})`, link: `/leagues/${leagueId}/finance`, type: 'warning' });
  else await overshootAlert(leagueId, e.category);
  await audit(u.id, 'create', 'Expense', e.id, { amount: e.amount, approval: e.approval });
  res.status(201).json(e);
}));

r.patch('/expenses/:eid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const e = await prisma.expense.update({ where: { id: req.params.eid, leagueId: req.params.leagueId }, data: expenseSchema.partial().parse(req.body) });
  await audit(me(req).id, 'update', 'Expense', e.id);
  res.json(e);
}));

r.post('/expenses/:eid/approval', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'admin');
  const { decision } = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
  const cur = await prisma.expense.findFirst({ where: { id: req.params.eid, leagueId } });
  if (!cur) throw new HttpError(404, 'Expense not found');
  const e = await prisma.expense.update({ where: { id: cur.id }, data: { approval: decision, approvedById: me(req).id } });
  if (cur.createdById) await notify(cur.createdById, `Expense ${decision.toLowerCase()}: ${cur.description}`, { link: `/leagues/${leagueId}/finance`, type: decision === 'APPROVED' ? 'success' : 'warning' });
  if (decision === 'APPROVED') await overshootAlert(leagueId, e.category);
  await audit(me(req).id, `expense-${decision.toLowerCase()}`, 'Expense', e.id);
  res.json(e);
}));

r.delete('/expenses/:eid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.expense.delete({ where: { id: req.params.eid, leagueId: req.params.leagueId } });
  await audit(me(req).id, 'delete', 'Expense', req.params.eid);
  res.json({ ok: true });
}));

const incomeSchema = z.object({
  source: z.string(), description: z.string().min(2), amount: money, date: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']).optional(), party: z.string().optional().nullable(), invoiceNo: z.string().optional().nullable(),
  gstAmount: money.optional(), paymentMode: z.string().optional().nullable(), receivedOn: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(), notes: z.string().optional().nullable(),
});

r.post('/incomes', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const i = await prisma.income.create({ data: { ...incomeSchema.parse(req.body), leagueId: req.params.leagueId } });
  await audit(me(req).id, 'create', 'Income', i.id, { amount: i.amount });
  res.status(201).json(i);
}));

r.patch('/incomes/:iid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.income.update({ where: { id: req.params.iid, leagueId: req.params.leagueId }, data: incomeSchema.partial().parse(req.body) }));
}));

r.delete('/incomes/:iid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.income.delete({ where: { id: req.params.iid, leagueId: req.params.leagueId } });
  await audit(me(req).id, 'delete', 'Income', req.params.iid);
  res.json({ ok: true });
}));

export default r;
