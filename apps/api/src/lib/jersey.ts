/** Jersey logo positions and rule checks shared by API and tests */
export const JERSEY_SLOTS = [
  { key: 'FRONT_CHEST', label: 'Front chest (main sponsor)', side: 'front' },
  { key: 'CHEST_LEFT', label: 'Left chest', side: 'front' },
  { key: 'CHEST_RIGHT', label: 'Right chest', side: 'front' },
  { key: 'LOWER_FRONT', label: 'Lower front', side: 'front' },
  { key: 'SLEEVE_LEFT', label: 'Left sleeve', side: 'front' },
  { key: 'SLEEVE_RIGHT', label: 'Right sleeve', side: 'front' },
  { key: 'BACK_TOP', label: 'Back, above name', side: 'back' },
  { key: 'BACK_BOTTOM', label: 'Back, lower', side: 'back' },
] as const;

export interface JerseyLike { teamId: string | null; colors: { body: string; text: string }; sponsors: { slot: string; name: string; logoUrl?: string | null }[]; roster: unknown[] }
export interface RulesLike { leagueLogoSlot: string; teamLogoSlot: string; sponsorSlots: string[] }
export interface Issue { level: 'error' | 'warning'; message: string }

const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio (1–21) */
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function checkJersey(d: JerseyLike, rules: RulesLike, leagueHasLogo: boolean): Issue[] {
  const issues: Issue[] = [];
  if (!leagueHasLogo) issues.push({ level: 'error', message: 'Upload the league logo in League Settings — it is mandatory on every kit' });
  const seen = new Set<string>();
  for (const s of d.sponsors) {
    if (s.slot === rules.leagueLogoSlot) issues.push({ level: 'error', message: `${s.name}: the ${s.slot.replace('_', ' ').toLowerCase()} position is reserved for the league logo` });
    else if (s.slot === rules.teamLogoSlot) issues.push({ level: 'error', message: `${s.name}: the ${s.slot.replace('_', ' ').toLowerCase()} position is reserved for the team logo` });
    else if (!rules.sponsorSlots.includes(s.slot)) issues.push({ level: 'error', message: `${s.name}: sponsor logos are not allowed at ${s.slot.replace('_', ' ').toLowerCase()}` });
    if (seen.has(s.slot)) issues.push({ level: 'error', message: `Two sponsors are placed at ${s.slot.replace('_', ' ').toLowerCase()}` });
    seen.add(s.slot);
    if (!s.logoUrl) issues.push({ level: 'warning', message: `${s.name}: no logo uploaded yet (text placeholder will be used)` });
  }
  if (!d.teamId) issues.push({ level: 'warning', message: 'No team selected — this will be treated as a league-wide kit' });
  const c = contrast(d.colors.body, d.colors.text);
  if (c < 3) issues.push({ level: 'error', message: `Name/number colour is hard to read on the body colour (contrast ${c.toFixed(1)}:1, needs at least 3:1)` });
  else if (c < 4.5) issues.push({ level: 'warning', message: `Name/number contrast is ${c.toFixed(1)}:1 — 4.5:1 or more reads better from the stands` });
  if (!d.roster.length) issues.push({ level: 'warning', message: 'Add the player roster (names, numbers, sizes) before sending to the printer' });
  return issues;
}

/** Default delivery milestones for a work order, by vendor category */
export function defaultMilestones(categorySlug: string) {
  const names = categorySlug === 'jersey-printing' || categorySlug === 'merchandise'
    ? ['Sample submitted', 'Sample approved', 'Bulk production', 'Dispatched', 'Delivered (proof of delivery)']
    : categorySlug === 'trophy-medals' || categorySlug === 'fabrication-branding'
      ? ['Design proof approved', 'Production', 'Delivered / installed']
      : ['Work started', 'Delivered'];
  return names.map((name) => ({ name, doneAt: null as string | null, proof: null as string | null, by: null as string | null }));
}
