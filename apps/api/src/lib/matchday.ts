/** Match-day operations checklist, modelled on tournament venue-operations run sheets. Offsets are hours relative to the scheduled start. */
export interface ChecklistTemplate { phase: string; title: string; department: string; offsetH: number; critical?: boolean }

export const MATCH_CHECKLIST: ChecklistTemplate[] = [
  { phase: 'T-7', title: 'Venue booking and ground hire confirmed in writing', department: 'Operations', offsetH: -168, critical: true },
  { phase: 'T-7', title: 'Match officials appointed (umpires, referee, scorers)', department: 'Cricket Operations', offsetH: -168, critical: true },
  { phase: 'T-7', title: 'Broadcast / streaming crew and slot confirmed', department: 'Production', offsetH: -168 },
  { phase: 'T-7', title: 'Police / local authority permissions in place', department: 'Operations', offsetH: -168 },
  { phase: 'T-2', title: 'Team travel and hotel rooms confirmed', department: 'Logistics', offsetH: -48 },
  { phase: 'T-2', title: 'Accreditation cards printed for all personnel', department: 'Operations', offsetH: -48 },
  { phase: 'T-2', title: 'Sponsor branding (boundary boards, backdrops) delivered', department: 'Commercial', offsetH: -48 },
  { phase: 'T-1', title: 'Pitch and outfield inspected; covers available', department: 'Cricket Operations', offsetH: -24, critical: true },
  { phase: 'T-1', title: 'Match balls, stumps and bails checked', department: 'Cricket Operations', offsetH: -24 },
  { phase: 'T-1', title: 'Security briefing held; entry gates and zones staffed', department: 'Operations', offsetH: -24 },
  { phase: 'T-1', title: 'Weather forecast reviewed; contingency plan shared', department: 'Operations', offsetH: -24 },
  { phase: 'MATCH_DAY', title: 'Ambulance and medical team on site', department: 'Operations', offsetH: -3, critical: true },
  { phase: 'MATCH_DAY', title: 'Fire safety and emergency exits checked', department: 'Operations', offsetH: -3, critical: true },
  { phase: 'MATCH_DAY', title: 'Scorers, scoreboard and SportsIQ live scoring tested', department: 'Cricket Operations', offsetH: -2 },
  { phase: 'MATCH_DAY', title: 'Team sheets (playing XI) received from both teams', department: 'Cricket Operations', offsetH: -1, critical: true },
  { phase: 'MATCH_DAY', title: 'Anti-corruption / player area access enforced', department: 'Operations', offsetH: -2 },
  { phase: 'MATCH_DAY', title: 'Broadcast feed and commentary check', department: 'Production', offsetH: -1 },
  { phase: 'MATCH_DAY', title: 'Food, water and hospitality ready', department: 'Logistics', offsetH: -2 },
  { phase: 'POST', title: 'Match report and scorecard signed by officials', department: 'Cricket Operations', offsetH: 4 },
  { phase: 'POST', title: 'Ground handed back; damage and cleaning checked', department: 'Operations', offsetH: 6 },
  { phase: 'POST', title: 'Sponsor deliverables and media posts logged', department: 'Marketing', offsetH: 24 },
  { phase: 'POST', title: 'Match-day expenses entered in Finance', department: 'Finance', offsetH: 48 },
];

export const PHASES = ['T-7', 'T-2', 'T-1', 'MATCH_DAY', 'POST'];

export function checklistFor(startsAt: Date | null) {
  return MATCH_CHECKLIST.map((t, i) => ({ phase: t.phase, title: t.title, department: t.department, critical: !!t.critical, sort: i, dueAt: startsAt ? new Date(startsAt.getTime() + t.offsetH * 36e5) : null }));
}

/** Two matches clash on the same broadcaster if their on-air windows overlap */
export interface Slot { id: string; broadcaster: string | null; onAirAt: Date | null; offAirAt: Date | null; startsAt: Date | null }
export function broadcastClashes(matches: Slot[], defaultHours = 4) {
  const win = (m: Slot) => {
    const start = m.onAirAt ?? (m.startsAt ? new Date(m.startsAt.getTime() - 30 * 6e4) : null);
    const end = m.offAirAt ?? (start ? new Date(start.getTime() + defaultHours * 36e5) : null);
    return start && end ? [start.getTime(), end.getTime()] : null;
  };
  const out: [string, string][] = [];
  const list = matches.filter((m) => m.broadcaster && win(m));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.broadcaster!.toLowerCase() !== b.broadcaster!.toLowerCase()) continue;
    const [as, ae] = win(a)!, [bs, be] = win(b)!;
    if (as < be && bs < ae) out.push([a.id, b.id]);
  }
  return out;
}

/** Deadline alert due for a milestone/checklist item */
export function deadlineAlert(due: Date | null, done: boolean, last: string | null, now = new Date()): 'DUE_SOON' | 'OVERDUE' | null {
  if (!due || done) return null;
  const h = (due.getTime() - now.getTime()) / 36e5;
  const level = h < 0 ? 'OVERDUE' : h <= 48 ? 'DUE_SOON' : null;
  if (!level || level === last || (last === 'OVERDUE')) return null;
  return level;
}
