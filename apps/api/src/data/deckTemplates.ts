/**
 * Deck Studio sample decks. Slides are generated from live league data, then fully editable.
 */
export type SlideLayout = 'cover' | 'bullets' | 'stats' | 'table' | 'closing';
export interface Slide { layout: SlideLayout; title: string; subtitle?: string; bullets?: string[]; stats?: { label: string; value: string }[]; rows?: string[][] }

export const DECK_TYPES = [
  { key: 'sponsorship', title: 'Sponsorship Deck', description: 'League story, audience, schedule and full sponsorship inventory with pricing.' },
  { key: 'franchise', title: 'Team Sales Deck', description: 'Pitch franchises to prospective team owners.' },
  { key: 'concept', title: 'League Concept Pitch', description: 'Vision, format and plan for approvals and partners.' },
  { key: 'broadcast', title: 'Broadcast Pitch Deck', description: 'Pitch media rights to broadcasters and OTT platforms.' },
  { key: 'investor', title: 'Investor Deck', description: 'Long-term IP vision and economics.' },
] as const;

interface LeagueData {
  name: string; shortCode?: string | null; sport: string; format?: string | null; category?: string | null; city?: string | null; description?: string | null;
  startDate?: Date | null; endDate?: Date | null; numTeams: number; teamPurse?: number | null;
  teams: { name: string; franchiseFee?: number | null; owners: unknown[] }[];
  opportunities: { title: string; tier: string; price: number; deliverables: string[]; status: string }[];
  registrations: number;
}

const d = (x?: Date | null) => (x ? x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA');
const inr = (n?: number | null) => (n == null ? 'TBA' : '₹' + n.toLocaleString('en-IN'));

export function buildDeck(type: string, l: LeagueData, audience?: string): Slide[] {
  const window = `${d(l.startDate)} – ${d(l.endDate)}`;
  const facts: { label: string; value: string }[] = [
    { label: 'Teams', value: String(l.numTeams || l.teams.length) },
    { label: 'Format', value: l.format ?? l.sport },
    { label: 'Host city', value: l.city ?? 'TBA' },
    { label: 'Registered players', value: String(l.registrations) },
  ];
  const cover: Slide = { layout: 'cover', title: l.name, subtitle: audience ? `Prepared for ${audience}` : `${[l.sport, l.format, l.category].filter(Boolean).join(' · ')} | ${window}` };
  const about: Slide = { layout: 'bullets', title: `About ${l.shortCode ?? l.name}`, bullets: [l.description ?? 'A professionally run league built for players, fans and partners.', `${l.category ?? 'Open'} ${l.sport} league in ${l.city ?? 'your city'}`, `Season window: ${window}`, 'Every match produced, streamed and promoted across social channels'] };
  const glance: Slide = { layout: 'stats', title: 'The league at a glance', stats: facts };
  const closing: Slide = { layout: 'closing', title: "Let's build this together", subtitle: `Contact the ${l.name} team via SportsIQ` };

  switch (type) {
    case 'sponsorship':
      return [
        cover, about, glance,
        { layout: 'bullets', title: 'Why partner with us', bullets: ['Engaged, young, urban audience on-ground and online', 'Brand visibility on jerseys, LED, broadcast and social', 'Hospitality and on-ground activation opportunities', 'Transparent deliverables tracking and post-season report'] },
        { layout: 'table', title: 'Sponsorship opportunities', rows: [['Package', 'Tier', 'Investment'], ...(l.opportunities.length ? l.opportunities.map((o) => [o.title, o.tier, inr(o.price)]) : [['Title Sponsor', 'Title', 'On request'], ['Powered By', 'Powered By', 'On request']])] },
        ...l.opportunities.slice(0, 3).map((o): Slide => ({ layout: 'bullets', title: `${o.title} — ${inr(o.price)}`, bullets: o.deliverables.length ? o.deliverables : ['Deliverables to be agreed'] })),
        { layout: 'bullets', title: 'Season timeline', bullets: ['Sponsor onboarding & artwork', 'Jersey and kit launch', 'Player auction (live streamed)', `League matches: ${window}`, 'Final, closing ceremony & sponsor report'] },
        closing,
      ];
    case 'franchise':
      return [
        cover, about, glance,
        { layout: 'bullets', title: 'Why own a team', bullets: ['Brand visibility for your business across the season', 'Team-level sponsorship and hospitality opportunities', 'Community, networking and corporate engagement', 'Access to the SportsIQ team owner portal'] },
        { layout: 'table', title: 'Franchises available', rows: [['Team', 'Franchise fee', 'Status'], ...l.teams.map((t) => [t.name, inr(t.franchiseFee), t.owners.length ? 'Sold' : 'Available'])] },
        { layout: 'bullets', title: 'What owners get', bullets: [`Auction purse: ${inr(l.teamPurse)}`, 'Team branding on jerseys and broadcast', 'Allocated practice slots and team hotel', 'Live dashboard of squad, schedule and performance'] },
        closing,
      ];
    case 'broadcast':
      return [
        cover, glance,
        { layout: 'bullets', title: 'Content on offer', bullets: [`${l.numTeams || l.teams.length}-team league with full season of matches`, 'Live match feed, highlights and short-form clips', 'Auction, launch and ceremony shows', 'Player features and behind-the-scenes'] },
        { layout: 'bullets', title: 'Partnership models', bullets: ['Exclusive live rights', 'Non-exclusive digital / OTT', 'Highlights & clips licensing', 'Revenue share on advertising'] },
        closing,
      ];
    case 'investor':
      return [
        cover, about, glance,
        { layout: 'bullets', title: 'The opportunity', bullets: ['Growing demand for organised local and corporate leagues', 'Multiple revenue lines: franchises, sponsorship, media, ticketing, merchandise', 'Repeatable season-on-season IP', 'Expansion to new cities and formats'] },
        { layout: 'bullets', title: 'Revenue streams', bullets: ['Franchise fees', 'Sponsorship', 'Broadcast & digital rights', 'Ticketing & hospitality', 'Merchandise'] },
        closing,
      ];
    default:
      return [
        cover, about, glance,
        { layout: 'bullets', title: 'Format', bullets: [`${l.format ?? ''} ${l.sport}`.trim(), `${l.numTeams || l.teams.length} teams`, 'Group stage, playoffs and final', 'Player auction with team purses'] },
        { layout: 'bullets', title: 'Roadmap', bullets: ['Concept & approvals', 'Vendor and venue lock-in', 'Franchise sale & sponsorship', 'Trials & auction', 'League season & closing ceremony'] },
        closing,
      ];
  }
}
