import { prisma } from './prisma.js';
import { leagueManagers, notify } from './notify.js';
import { DOC_TYPES, expiryAlertDue } from './compliance.js';

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

export function startJobs() {
  const run = () => runExpiryChecks().catch((e) => console.error('[jobs] expiry check failed', e));
  setTimeout(run, 15_000);
  setInterval(run, 6 * 3600_000);
}
