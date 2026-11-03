/** Squad composition rules shared by auction, retention, RTM and draft. Pure functions — unit tested. */
export interface SquadRules { maxSquad: number; maxOverseas: number | null; roleMins: Record<string, number> }
export interface SquadState { squad: number; overseas: number; roles: (string | null)[] }
export interface Candidate { role: string | null; isOverseas: boolean }

/** Roles still required to meet the minimums */
export function roleNeeds(roles: (string | null)[], mins: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [role, min] of Object.entries(mins)) {
    const have = roles.filter((r) => r === role).length;
    if (min - have > 0) out[role] = min - have;
  }
  return out;
}

/** Why this team cannot add this player, or null if it can */
export function squadBlocker(team: SquadState & { name?: string }, p: Candidate, rules: SquadRules): string | null {
  const who = team.name ?? 'This team';
  if (team.squad >= rules.maxSquad) return `${who} already has a full squad (${rules.maxSquad})`;
  if (p.isOverseas && rules.maxOverseas != null && team.overseas >= rules.maxOverseas) return `${who} already has the maximum ${rules.maxOverseas} overseas players`;
  const needs = roleNeeds(team.roles, rules.roleMins);
  const unmet = Object.values(needs).reduce((a, b) => a + b, 0);
  const fills = !!(p.role && needs[p.role]);
  const slotsAfter = rules.maxSquad - team.squad - 1;
  if (!fills && unmet > slotsAfter) {
    const list = Object.entries(needs).map(([r, n]) => `${n} ${r}${n > 1 ? 's' : ''}`).join(', ');
    return `${who} must keep its remaining slots for ${list}`;
  }
  return null;
}

/** Which team picks at a given overall pick number (0-based) */
export function draftTurn(order: string[], pick: number, snake: boolean) {
  if (!order.length) return null;
  const round = Math.floor(pick / order.length);
  const idx = pick % order.length;
  const teamId = snake && round % 2 === 1 ? order[order.length - 1 - idx] : order[idx];
  return { teamId, round: round + 1, pickInRound: idx + 1 };
}

/** Is the player's registration window open right now? */
export function registrationWindow(l: { regOpensAt: Date | null; regClosesAt: Date | null; status: string }, now = new Date()) {
  if (!['PLANNING', 'REGISTRATION_OPEN'].includes(l.status)) return { open: false, reason: 'Registrations are closed for this league' };
  if (l.regOpensAt && now < l.regOpensAt) return { open: false, reason: `Registrations open on ${l.regOpensAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` };
  if (l.regClosesAt && now > l.regClosesAt) return { open: false, reason: 'The registration window has closed' };
  return { open: true, reason: null };
}

/** Age in completed years on a date */
export function ageOn(dob: Date, on: Date) {
  let a = on.getFullYear() - dob.getFullYear();
  if (on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate())) a--;
  return a;
}

export const PLAYER_DOCS: Record<string, string> = {
  ID_PROOF: 'Government photo ID (Aadhaar / passport)', AGE_PROOF: 'Age proof (birth certificate / passport)', NOC: 'No-objection certificate (board / association / employer)',
  ADDRESS_PROOF: 'Address proof', PHOTO: 'Passport-size photo', MEDICAL: 'Medical fitness certificate',
};
export const STAFF_ROLES = ['Head Coach', 'Assistant Coach', 'Batting Coach', 'Bowling Coach', 'Fielding Coach', 'Team Manager', 'Physio', 'Strength & Conditioning', 'Analyst', 'Logistics', 'Media Manager', 'Doctor'];
