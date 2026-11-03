import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';

/** Legal workflow: clause library, contract versions, approval chain, signed copies. /api/leagues/:leagueId/legal */
const r = Router({ mergeParams: true });
r.use(requireAuth);

export const CLAUSE_TAGS = ['Payment', 'Termination', 'IP', 'Indemnity', 'Confidentiality', 'Force majeure', 'Integrity', 'Image rights', 'Insurance', 'Disputes', 'Data protection', 'Other'];

/** Generic starting-point clauses. Like all templates they must be reviewed by a qualified lawyer. */
const DEFAULT_CLAUSES: { title: string; tag: string; body: string }[] = [
  { tag: 'Payment', title: 'Milestone payments', body: 'PAYMENT\nFees shall be paid in instalments as follows: [__]% on signing, [__]% on [milestone], and the balance within [__] days of completion against a valid tax invoice. Late payments carry interest at [__]% per month after written notice.' },
  { tag: 'Payment', title: 'TDS and taxes', body: 'TAXES\nAll amounts are exclusive of GST, which shall be paid in addition at the applicable rate. The paying party may deduct tax at source as required by law and shall provide TDS certificates.' },
  { tag: 'Termination', title: 'Termination for convenience', body: 'TERMINATION FOR CONVENIENCE\nEither Party may terminate this Agreement by giving [__] days\' written notice. The terminating Party shall pay for work properly performed up to the termination date.' },
  { tag: 'Termination', title: 'Termination for insolvency', body: 'TERMINATION FOR INSOLVENCY\nEither Party may terminate immediately by written notice if the other Party becomes insolvent, enters liquidation, or has a receiver appointed over its assets.' },
  { tag: 'IP', title: 'Ownership of deliverables', body: 'INTELLECTUAL PROPERTY\nOn full payment, all rights in the deliverables created specifically for the League vest in the League. Each Party retains rights in its pre-existing materials and grants the other a licence to use them only as needed to perform this Agreement.' },
  { tag: 'Indemnity', title: 'Mutual indemnity', body: 'INDEMNITY\nEach Party shall indemnify the other against losses arising from its breach of this Agreement, its negligence or wilful misconduct, or its infringement of third-party rights, subject to the limitation of liability below.' },
  { tag: 'Indemnity', title: 'Limitation of liability', body: 'LIMITATION OF LIABILITY\nExcept for indemnities and breach of confidentiality, neither Party\'s total liability shall exceed the fees paid or payable under this Agreement, and neither Party is liable for indirect or consequential losses.' },
  { tag: 'Integrity', title: 'Anti-corruption and match integrity', body: 'INTEGRITY\nThe Parties shall comply with applicable anti-bribery laws and the League\'s anti-corruption code. Any approach to influence the result or any aspect of a match must be reported to the League immediately. Breach is a material breach entitling immediate termination.' },
  { tag: 'Image rights', title: 'Use of name and image', body: 'IMAGE RIGHTS\nThe [Party] grants the League a non-exclusive licence to use its name, logo and approved images to promote the League during the term. Any personal endorsement of third-party products requires separate written consent.' },
  { tag: 'Insurance', title: 'Insurance cover', body: 'INSURANCE\nThe [Vendor] shall maintain public liability insurance of at least ₹[__] and workers\' compensation cover as required by law, and shall provide certificates on request.' },
  { tag: 'Disputes', title: 'Arbitration', body: 'DISPUTE RESOLUTION\nDisputes not resolved amicably within [__] days shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat shall be [city] and the language English.' },
  { tag: 'Data protection', title: 'Personal data', body: 'DATA PROTECTION\nEach Party shall process personal data only for the purposes of this Agreement, in accordance with the Digital Personal Data Protection Act, 2023, keep it secure, and delete it when no longer required.' },
];

async function ensureClauses(leagueId: string) {
  if (await prisma.clause.count({ where: { leagueId } })) return;
  await prisma.clause.createMany({ data: DEFAULT_CLAUSES.map((c) => ({ ...c, leagueId, isDefault: true })) });
}

// ---------- Clause library ----------
r.get('/clauses', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await ensureClauses(req.params.leagueId);
  res.json({ tags: CLAUSE_TAGS, clauses: await prisma.clause.findMany({ where: { leagueId: req.params.leagueId }, orderBy: [{ tag: 'asc' }, { title: 'asc' }] }) });
}));
const clauseSchema = z.object({ title: z.string().min(2), tag: z.enum(CLAUSE_TAGS as [string, ...string[]]), body: z.string().min(10) });
r.post('/clauses', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.status(201).json(await prisma.clause.create({ data: { ...clauseSchema.parse(req.body), leagueId: req.params.leagueId, createdBy: me(req).name } })); }));
r.patch('/clauses/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.clause.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: clauseSchema.partial().parse(req.body) })); }));
r.delete('/clauses/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.clause.deleteMany({ where: { id: req.params.id, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

// ---------- Versions ----------
r.get('/contracts/:id/versions', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.json(await prisma.contractVersion.findMany({ where: { contractId: req.params.id }, orderBy: { version: 'desc' } }));
}));

r.post('/contracts/:id/versions/:v/restore', ah(async (req, res) => {
  const u = me(req);
  await assertLeague(u, req.params.leagueId, 'staff');
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  if (!['DRAFT'].includes(c.status)) throw new HttpError(400, 'Only draft contracts can be changed');
  const v = await prisma.contractVersion.findUniqueOrThrow({ where: { contractId_version: { contractId: c.id, version: Number(req.params.v) } } });
  const next = c.version + 1;
  await prisma.contract.update({ where: { id: c.id }, data: { body: v.body, title: v.title, version: next } });
  await prisma.contractVersion.create({ data: { contractId: c.id, version: next, title: v.title, body: v.body, savedBy: u.name, note: `Restored from v${v.version}` } });
  res.json({ version: next });
}));

// ---------- Approval chain ----------
r.get('/chain', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: req.params.leagueId }, select: { legalChain: true } });
  res.json({ chain: l.legalChain, departments: ['Operations', 'Cricket Operations', 'Finance', 'Commercial', 'Marketing', 'Branding', 'Legal', 'Logistics', 'Production', 'Admin', 'League Owner'] });
}));
r.put('/chain', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'admin');
  const { chain } = z.object({ chain: z.array(z.string().min(2)).min(1).max(6) }).parse(req.body);
  if (chain.at(-1) !== 'League Owner') throw new HttpError(400, 'The League Owner must be the final approver');
  res.json(await prisma.league.update({ where: { id: req.params.leagueId }, data: { legalChain: chain }, select: { legalChain: true } }));
}));

/** Who may decide a step: members of that department; the owner decides the owner step and any step with no department members */
async function canDecide(leagueId: string, userId: string, department: string) {
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.role === 'SUPER_ADMIN') return true;
  if (department === 'League Owner') return l.ownerId === userId;
  const members = await prisma.leagueMember.findMany({ where: { leagueId, department } });
  if (!members.length) return l.ownerId === userId;
  return members.some((m) => m.userId === userId);
}

r.post('/contracts/:id/submit', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (c.status !== 'DRAFT') throw new HttpError(400, 'Only drafts can be submitted for approval');
  if (/\[[A-Z ]{3,}\]/.test(c.body)) throw new HttpError(400, 'Fill in all [PLACEHOLDERS] before submitting');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const last = await prisma.contractApproval.aggregate({ where: { contractId: c.id }, _max: { round: true } });
  const round = (last._max.round ?? 0) + 1;
  await prisma.contractApproval.createMany({ data: l.legalChain.map((department, i) => ({ contractId: c.id, step: i + 1, department, round })) });
  await prisma.contract.update({ where: { id: c.id }, data: { status: 'UNDER_LEGAL_REVIEW' } });
  await notify(await leagueManagers(leagueId), `Contract awaiting ${l.legalChain[0]} approval: ${c.title}`, { link: `/leagues/${leagueId}/contracts/${c.id}`, type: 'info' });
  await audit(u.id, 'submit-for-approval', 'Contract', c.id, { round, chain: l.legalChain });
  res.json({ ok: true });
}));

r.get('/contracts/:id/approvals', ah(async (req, res) => {
  const u = me(req);
  await assertLeague(u, req.params.leagueId, 'staff');
  const list = await prisma.contractApproval.findMany({ where: { contractId: req.params.id }, orderBy: [{ round: 'desc' }, { step: 'asc' }] });
  const round = list[0]?.round;
  const current = list.filter((a) => a.round === round);
  const next = current.find((a) => a.status === 'PENDING');
  res.json({ current, history: list.filter((a) => a.round !== round), nextStep: next ?? null, canDecide: next ? await canDecide(req.params.leagueId, u.id, next.department) : false });
}));

r.post('/contracts/:id/decide', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const { decision, note } = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().optional() }).parse(req.body);
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (c.status !== 'UNDER_LEGAL_REVIEW') throw new HttpError(400, 'This contract is not awaiting approval');
  const round = (await prisma.contractApproval.aggregate({ where: { contractId: c.id }, _max: { round: true } }))._max.round;
  const next = await prisma.contractApproval.findFirst({ where: { contractId: c.id, round: round!, status: 'PENDING' }, orderBy: { step: 'asc' } });
  if (!next) throw new HttpError(400, 'Nothing to approve');
  if (!(await canDecide(leagueId, u.id, next.department))) throw new HttpError(403, `Only ${next.department} can decide this step`);
  if (decision === 'REJECTED' && !note) throw new HttpError(400, 'Say what needs to change');
  await prisma.contractApproval.update({ where: { id: next.id }, data: { status: decision, decidedBy: u.name, note, decidedAt: new Date() } });
  const managers = await leagueManagers(leagueId);
  if (decision === 'REJECTED') {
    await prisma.contract.update({ where: { id: c.id }, data: { status: 'DRAFT' } });
    await notify(managers, `Changes requested on ${c.title}`, { body: `${next.department}: ${note}`, link: `/leagues/${leagueId}/contracts/${c.id}`, type: 'warning' });
  } else {
    const remaining = await prisma.contractApproval.findFirst({ where: { contractId: c.id, round: round!, status: 'PENDING' }, orderBy: { step: 'asc' } });
    if (remaining) await notify(managers, `Contract awaiting ${remaining.department} approval: ${c.title}`, { link: `/leagues/${leagueId}/contracts/${c.id}`, type: 'info' });
    else {
      await prisma.contract.update({ where: { id: c.id }, data: { status: 'APPROVED' } });
      await notify(managers, `Contract approved internally: ${c.title}`, { body: 'Ready to send to the counterparty.', link: `/leagues/${leagueId}/contracts/${c.id}`, type: 'success' });
    }
  }
  await audit(u.id, `contract-${decision.toLowerCase()}`, 'Contract', c.id, { step: next.department, note });
  res.json({ ok: true });
}));

/** Upload signed copies — the executed agreement is locked from editing */
r.post('/contracts/:id/signed', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = z.object({ files: z.array(z.string()).min(1), signedAt: z.coerce.date().optional(), effectiveFrom: z.coerce.date().nullable().optional(), expiresOn: z.coerce.date().nullable().optional() }).parse(req.body);
  const c = await prisma.contract.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (!['APPROVED', 'SENT', 'SIGNED'].includes(c.status)) throw new HttpError(400, 'Get internal approval before recording a signed copy');
  const s = await prisma.contract.update({ where: { id: c.id }, data: { status: 'SIGNED', signedCopies: [...c.signedCopies, ...d.files], signedAt: d.signedAt ?? new Date(), effectiveFrom: d.effectiveFrom ?? c.effectiveFrom, expiresOn: d.expiresOn ?? c.expiresOn, alertLevel: null } });
  await audit(u.id, 'signed-copy', 'Contract', c.id, { files: d.files.length });
  await notify(await leagueManagers(leagueId), `Signed: ${c.title}`, { link: `/leagues/${leagueId}/contracts/${c.id}`, type: 'success' });
  res.json(s);
}));

r.patch('/contracts/:id/dates', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ effectiveFrom: z.coerce.date().nullable().optional(), expiresOn: z.coerce.date().nullable().optional() }).parse(req.body);
  res.json(await prisma.contract.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: { ...d, alertLevel: null } }));
}));

export default r;
