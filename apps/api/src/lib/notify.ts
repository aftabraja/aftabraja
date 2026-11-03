import { prisma } from './prisma.js';

export async function notify(
  userIds: string[] | string,
  title: string,
  opts: { body?: string; link?: string; type?: 'info' | 'success' | 'warning' | 'alert' | 'mention' } = {},
) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, title, body: opts.body, link: opts.link, type: opts.type ?? 'info' })),
  });
}

export async function audit(userId: string | undefined, action: string, entity: string, entityId?: string, meta?: object) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, meta: meta as object | undefined } });
}

/** Everyone who manages a league (owner + staff). */
export async function leagueManagers(leagueId: string) {
  const l = await prisma.league.findUnique({ where: { id: leagueId }, include: { members: true } });
  if (!l) return [];
  return [l.ownerId, ...l.members.map((m) => m.userId)];
}
