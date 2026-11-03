import { prisma } from './prisma.js';
import { HttpError } from './http.js';
import type { AuthUser } from './auth.js';

export type LeagueAccess = 'admin' | 'staff' | 'team';

/** Resolve what a user can do inside a league. Super admin sees everything. */
export async function leagueAccess(user: AuthUser, leagueId: string): Promise<LeagueAccess | null> {
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } });
  if (!league) throw new HttpError(404, 'League not found');
  if (user.role === 'SUPER_ADMIN' || league.ownerId === user.id) return 'admin';
  const member = await prisma.leagueMember.findUnique({ where: { leagueId_userId: { leagueId, userId: user.id } } });
  if (member) return 'staff';
  const owner = await prisma.teamOwner.findFirst({ where: { userId: user.id, team: { leagueId } } });
  if (owner) return 'team';
  return null;
}

/** Throws unless the user has at least the given level (admin > staff > team). */
export async function assertLeague(user: AuthUser, leagueId: string, min: LeagueAccess = 'team') {
  const access = await leagueAccess(user, leagueId);
  const rank = { team: 1, staff: 2, admin: 3 } as const;
  if (!access || rank[access] < rank[min]) throw new HttpError(403, 'You do not have access to this league');
  return access;
}
