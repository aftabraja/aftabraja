import crypto from 'node:crypto';

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50);
}

export function tempPassword() {
  return 'SIQ-' + crypto.randomBytes(4).toString('hex');
}

export const PLAN_PRICES: Record<string, number> = {
  LEAGUE_OWNER: 5000,
  TEAM_OWNER: 2000,
  VENDOR: 1500,
  SPONSOR: 2500,
  TALENT_AGENT: 2500,
  PLAYER: 0,
  LEAGUE_STAFF: 0,
};
