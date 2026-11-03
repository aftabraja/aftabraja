import { prisma } from './prisma.js';
import { leagueManagers, notify } from './notify.js';
import { DOC_TYPES, expiryAlertDue } from './compliance.js';
import { deadlineAlert } from './matchday.js';
import { ALL_STEPS } from '../data/playbook.js';

const label = { D30: 'expires within 30 days', D7: 'expires within 7 days', EXPIRED: 'has expired' } as const;

/** Expiry alerts for vendor compliance documents and contracts. Safe to run repeatedly. */
export async function runExpiryChecks(now = new Date()) {
  let sent = 0;
  const horizon = new Date(now.getTime() + 31 * 864e5);
  const docs = await prisma.vendorDocument.findMany({ where: { expiresOn: { lte: horizon } } });
  const admins = (await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })).map((a) => a.id);
  for (const d of docs) {
    const due = expiryAlertDue(d.expiresOn, d.alertLevel, now);
    if (!due) continue;
    const v = await prisma.vendorProfile.findUnique({ where: { id: d.vendorId } });
    if (!v) continue;
    await notify(v.userId, `${DOC_TYPES[d.type] ?? d.type} ${label[due]}`, { body: `Expiry: ${d.expiresOn!.toLocaleDateString('en-IN')}. Upload the renewed document to stay compliant.`, link: '/vendor?tab=compliance', type: due === 'EXPIRED' ? 'alert' : 'warning' });
    if (due === 'EXPIRED') await notify(admins, `${v.companyName}: ${DOC_TYPES[d.type] ?? d.type} expired`, { link: '/admin/vendors', type: 'warning' });
    await prisma.vendorDocument.update({ where: { id: d.id }, data: { alertLevel: due } });
    sent++;
  }
  const contracts = await prisma.contract.findMany({ where: { expiresOn: { lte: horizon }, status: { in: ['SIGNED', 'SENT', 'APPROVED'] } } });
  for (const c of contracts) {
    const due = expiryAlertDue(c.expiresOn, c.alertLevel, now);
    if (!due) continue;
    await notify(await leagueManagers(c.leagueId), `Contract ${label[due]}: ${c.title}`, { body: `Expiry: ${c.expiresOn!.toLocaleDateString('en-IN')}`, link: `/leagues/${c.leagueId}/contracts/${c.id}`, type: due === 'EXPIRED' ? 'alert' : 'warning' });
    await prisma.contract.update({ where: { id: c.id }, data: { alertLevel: due } });
    sent++;
  }
  return { sent };
}

/** Playbook milestones due soon / overdue, and match-day checks overdue before upcoming matches */
export async function runDeadlineChecks(now = new Date()) {
  let sent = 0;
  const steps = await prisma.leagueStepProgress.findMany({ where: { dueDate: { not: null, lte: new Date(now.getTime() + 2 * 864e5) }, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } } });
  for (const s of steps) {
    const level = deadlineAlert(s.dueDate, false, s.alertLevel, now);
    if (!level) continue;
    const title = ALL_STEPS.find((x) => x.key === s.stepKey)?.title ?? s.stepKey;
    const to = s.assigneeId ? [s.assigneeId] : await leagueManagers(s.leagueId);
    await notify(to, level === 'OVERDUE' ? `Milestone overdue: ${title}` : `Milestone due soon: ${title}`, { body: `Due ${s.dueDate!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, link: `/leagues/${s.leagueId}/playbook#${s.stepKey}`, type: level === 'OVERDUE' ? 'alert' : 'warning' });
    await prisma.leagueStepProgress.update({ where: { id: s.id }, data: { alertLevel: level } });
    sent++;
  }
  // One digest per match with overdue checks (matches in the next 8 days)
  const items = await prisma.matchChecklistItem.findMany({
    where: { done: false, alerted: false, dueAt: { lt: now }, match: { status: 'SCHEDULED', startsAt: { gte: new Date(now.getTime() - 864e5), lte: new Date(now.getTime() + 8 * 864e5) } } },
    include: { match: { select: { id: true, leagueId: true, number: true } } },
  });
  const byMatch = new Map<string, typeof items>();
  items.forEach((i) => byMatch.set(i.matchId, [...(byMatch.get(i.matchId) ?? []), i]));
  for (const [, list] of byMatch) {
    const m = list[0].match;
    const crit = list.filter((i) => i.critical).length;
    await notify(await leagueManagers(m.leagueId), `Match ${m.number}: ${list.length} match-day check${list.length > 1 ? 's' : ''} overdue${crit ? ` (${crit} critical)` : ''}`, { body: list.slice(0, 3).map((i) => i.title).join('; '), link: `/leagues/${m.leagueId}/matchday?match=${m.id}`, type: crit ? 'alert' : 'warning' });
    await prisma.matchChecklistItem.updateMany({ where: { id: { in: list.map((i) => i.id) } }, data: { alerted: true } });
    sent++;
  }
  return { sent };
}

export async function runAllJobs(now = new Date()) {
  const a = await runExpiryChecks(now);
  const b = await runDeadlineChecks(now);
  return { sent: a.sent + b.sent, expiry: a.sent, deadlines: b.sent };
}

export function startJobs() {
  const run = () => runAllJobs().catch((e) => console.error('[jobs] scheduled checks failed', e));
  setTimeout(run, 15_000);
  setInterval(run, 3 * 3600_000);
}
