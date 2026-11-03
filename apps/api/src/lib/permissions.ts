import type { NextFunction, Request, Response } from 'express';
import { prisma } from './prisma.js';
import { HttpError } from './http.js';
import type { AuthUser } from './auth.js';
import { leagueAccess } from './access.js';

/** Per-department module access for league staff. Owners and super admins always have full access. */
export type Level = 'none' | 'view' | 'edit';
export const MODULES: { key: string; label: string }[] = [
  { key: 'players', label: 'Players, trials & KYC' }, { key: 'auction', label: 'Auction / draft' }, { key: 'matchday', label: 'Match-day ops & broadcast' },
  { key: 'logistics', label: 'Travel & hotels' }, { key: 'jerseys', label: 'Jersey studio' }, { key: 'accreditation', label: 'Accreditation' },
  { key: 'ticketing', label: 'Ticketing & promo codes' }, { key: 'procurement', label: 'Procurement & vendors' }, { key: 'sponsorship', label: 'Sponsor CRM' },
  { key: 'marketing', label: 'Marketing, PR & surveys' }, { key: 'finance', label: 'Finance & P&L' }, { key: 'reports', label: 'Reports' },
  { key: 'decks', label: 'Deck studio' }, { key: 'legal', label: 'Legal contracts' },
];
export const DEPARTMENTS = ['Operations', 'Cricket Operations', 'Finance', 'Commercial', 'Marketing', 'Branding', 'Legal', 'Logistics', 'Production', 'Admin'];

const ALL = MODULES.map((m) => m.key);
const EDITS: Record<string, string[]> = {
  Operations: ALL, Admin: ALL,
  'Cricket Operations': ['players', 'auction', 'matchday', 'accreditation', 'jerseys'],
  Finance: ['finance', 'procurement', 'reports', 'ticketing'],
  Commercial: ['sponsorship', 'decks', 'ticketing', 'marketing'],
  Marketing: ['marketing', 'decks'],
  Branding: ['jerseys', 'marketing', 'decks'],
  Legal: ['legal', 'procurement'],
  Logistics: ['logistics', 'accreditation', 'matchday', 'procurement'],
  Production: ['matchday', 'marketing'],
};
const NO_FINANCE = ['Cricket Operations', 'Marketing', 'Branding', 'Production'];

/** Built-in defaults: edit for the department's own modules, view elsewhere, finance hidden from non-business departments */
export function defaultLevel(dept: string, module: string): Level {
  const edits = EDITS[dept];
  if (edits?.includes(module)) return 'edit';
  if (module === 'finance' && (NO_FINANCE.includes(dept) || !edits)) return 'none';
  return 'view';
}

export function matrix(overrides: unknown, depts = DEPARTMENTS) {
  const o = (overrides ?? {}) as Record<string, Record<string, Level>>;
  return Object.fromEntries(depts.map((d) => [d, Object.fromEntries(ALL.map((m) => [m, o[d]?.[m] ?? defaultLevel(d, m)]))])) as Record<string, Record<string, Level>>;
}

const rank = { none: 0, view: 1, edit: 2 } as const;
export const allows = (have: Level, need: 'view' | 'edit') => rank[have] >= rank[need];

/** The current user's levels in a league (null = not a staff member, i.e. owner/admin → full, team owner → own checks) */
export async function userLevels(user: AuthUser, leagueId: string): Promise<Record<string, Level> | null> {
  const access = await leagueAccess(user, leagueId);
  if (access !== 'staff') return null;
  const [member, league] = await Promise.all([
    prisma.leagueMember.findUnique({ where: { leagueId_userId: { leagueId, userId: user.id } } }),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { deptPermissions: true } }),
  ]);
  return matrix(league.deptPermissions, [member!.department])[member!.department];
}

/** Express guard: GET needs view, writes need edit. Exempt paths are governed by their own rules (e.g. approval chains). */
export function moduleGuard(module: string, exempt: RegExp[] = []) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const leagueId = req.params.leagueId;
      if (!user || !leagueId) return next();
      const levels = await userLevels(user, leagueId);
      if (!levels) return next();
      const need = req.method === 'GET' ? 'view' : 'edit';
      if (need === 'edit' && exempt.some((x) => x.test(req.path))) return next();
      if (!allows(levels[module], need)) return next(new HttpError(403, need === 'view' ? `Your department does not have access to ${MODULES.find((m) => m.key === module)?.label}` : `Your department has view-only access to ${MODULES.find((m) => m.key === module)?.label}`));
      next();
    } catch (e) { next(e); }
  };
}
