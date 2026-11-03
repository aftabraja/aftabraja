/**
 * SportsIQ League Execution Playbook
 * ----------------------------------
 * The guided, step-by-step process every league follows from idea to closing
 * ceremony. Modelled on how international tournament operations teams run
 * events (event lifecycle: Plan -> Build -> Sell -> Deliver -> Close).
 *
 * The playbook is versioned in code so every league gets the same proven
 * process; per-league progress is stored in the database (LeagueStepProgress).
 *
 * Action types:
 *  - page:   opens a SportsIQ module (route)
 *  - vendor: opens the split-screen vendor search filtered to a category slug
 *  - ai:     opens an AI helper (e.g. AI logo studio)
 *  - upload: upload a document/asset against this step
 */

export type StepAction =
  | { type: 'page'; label: string; route: string }
  | { type: 'vendor'; label: string; category: string }
  | { type: 'ai'; label: string; tool: 'logo' | 'deck' | 'press-release' | 'schedule' }
  | { type: 'upload'; label: string };

export interface PlaybookStep {
  key: string;
  title: string;
  description: string;
  tip?: string;
  owner: string; // responsible function
  critical?: boolean; // league cannot go live without it
  actions: StepAction[];
}

export interface PlaybookPhase {
  key: string;
  title: string;
  summary: string;
  steps: PlaybookStep[];
}

export const PLAYBOOK: PlaybookPhase[] = [
  {
    key: 'foundation',
    title: 'League Foundation & Identity',
    summary: 'Define what the league is, who owns it and how it looks.',
    steps: [
      {
        key: 'league-profile',
        title: 'Create league profile',
        description: 'League name, sport, format (T10/T20/ODI/Indoor/Corporate), category (open, corporate, celebrity, state-level, school/university), host city and target season window.',
        tip: 'Pick a name you can trademark and a short code (e.g. CLT10) for jerseys, hashtags and tickets.',
        owner: 'League Owner',
        critical: true,
        actions: [{ type: 'page', label: 'Edit league details', route: 'settings' }],
      },
      {
        key: 'league-logo',
        title: 'League logo',
        description: 'Upload your league logo. No logo yet? Generate concepts with SportsIQ AI or hire a logo designer from the vendor marketplace.',
        owner: 'Branding',
        critical: true,
        actions: [
          { type: 'upload', label: 'Upload logo' },
          { type: 'ai', label: 'Design with AI', tool: 'logo' },
          { type: 'vendor', label: 'Find logo designers', category: 'logo-design' },
        ],
      },
      {
        key: 'brand-identity',
        title: 'Brand identity kit',
        description: 'Colour palette, typography, logo variants (mono, horizontal, icon) and usage guidelines used across jerseys, broadcast graphics and social media.',
        owner: 'Branding',
        actions: [
          { type: 'upload', label: 'Upload brand guidelines' },
          { type: 'vendor', label: 'Find branding agencies', category: 'branding-agency' },
        ],
      },
      {
        key: 'legal-entity',
        title: 'Legal entity, PAN & GST',
        description: 'Register the organising entity (Pvt Ltd / LLP / Society / Trust), obtain PAN, GST registration and open a dedicated league bank account.',
        tip: 'Never run league money through a personal account — sponsors and franchise owners will ask for GST invoices.',
        owner: 'Legal & Finance',
        critical: true,
        actions: [
          { type: 'vendor', label: 'Find chartered accountants', category: 'chartered-accountant' },
          { type: 'vendor', label: 'Find corporate lawyers', category: 'sports-lawyer' },
          { type: 'upload', label: 'Upload registration documents' },
        ],
      },
      {
        key: 'trademark',
        title: 'Trademark & IP protection',
        description: 'File trademark for league name and logo (and team names if league-owned). Define IP ownership of content and broadcast footage.',
        owner: 'Legal',
        actions: [{ type: 'vendor', label: 'Find IP / trademark lawyers', category: 'ip-trademark-lawyer' }],
      },
      {
        key: 'sanction',
        title: 'Governing body sanction / NOC',
        description: 'Obtain approval or NOC from the relevant association (state cricket association / national federation) where required, especially if registered players participate.',
        tip: 'Players contracted to state associations often need an NOC to play private leagues — plan this before the auction.',
        owner: 'League Owner',
        actions: [{ type: 'upload', label: 'Upload sanction / NOC letter' }],
      },
      {
        key: 'playing-conditions',
        title: 'Tournament rules & playing conditions',
        description: 'Format, points system, tie-breakers (NRR), over-rate rules, impact-player/substitute rules, rain rules (DLS), squad size, overseas/local player limits, code of conduct and disciplinary process.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [{ type: 'upload', label: 'Upload playing conditions' }],
      },
    ],
  },
  {
    key: 'strategy',
    title: 'Strategy, Budget & Calendar',
    summary: 'Lock the commercial model, budget and season window.',
    steps: [
      {
        key: 'season-window',
        title: 'Season window & key milestones',
        description: 'Fix league dates avoiding clashes with international/domestic calendar, festivals, exams and monsoon. Set milestone dates: franchise sale, registrations, trials, auction, launch, first match, final.',
        owner: 'League Owner',
        critical: true,
        actions: [{ type: 'page', label: 'Set dates', route: 'settings' }],
      },
      {
        key: 'teams-structure',
        title: 'Number of teams & franchise model',
        description: 'Decide team count, franchise fee, ownership model (single owner / co-owners), purse per team, and franchise term (1 season / multi-season).',
        owner: 'League Owner',
        critical: true,
        actions: [{ type: 'page', label: 'Configure teams', route: 'teams' }],
      },
      {
        key: 'budget',
        title: 'Budget plan',
        description: 'Category-wise budget: venue, production & broadcast, jerseys & kits, travel, accommodation, hospitality, officials, prize money, marketing, ceremonies, insurance, staff, contingency (8–10%).',
        owner: 'Finance',
        critical: true,
        actions: [{ type: 'page', label: 'Open budget planner', route: 'finance' }],
      },
      {
        key: 'revenue-model',
        title: 'Revenue model',
        description: 'Plan income streams: franchise fees, sponsorship, broadcast/OTT rights, ticketing, merchandise, player registration fees, hospitality boxes, digital/fantasy partnerships.',
        owner: 'Finance',
        actions: [{ type: 'page', label: 'Plan income', route: 'finance' }],
      },
      {
        key: 'prize-money',
        title: 'Prize money & awards structure',
        description: 'Winner, runner-up, player of the series, best batter/bowler, emerging player, fair play, match awards.',
        owner: 'League Owner',
        actions: [{ type: 'page', label: 'Add to budget', route: 'finance' }],
      },
      {
        key: 'insurance',
        title: 'Insurance',
        description: 'Public liability, player personal accident, event cancellation/weather, equipment and broadcast equipment insurance.',
        owner: 'Finance',
        actions: [{ type: 'vendor', label: 'Find insurance brokers', category: 'insurance' }],
      },
    ],
  },
  {
    key: 'venue',
    title: 'Venue & Infrastructure',
    summary: 'Secure grounds, pitches and permissions.',
    steps: [
      {
        key: 'venue-booking',
        title: 'Book stadium / grounds',
        description: 'Shortlist and book match venues with dressing rooms, seating, parking, power backup and broadcast positions. Lock dates in a signed agreement.',
        owner: 'Operations',
        critical: true,
        actions: [{ type: 'vendor', label: 'Find stadiums & grounds', category: 'stadium-ground' }],
      },
      {
        key: 'practice-facilities',
        title: 'Practice nets & training facilities',
        description: 'Allocate practice slots per team, with bowling machines and nets near team hotels.',
        owner: 'Operations',
        actions: [{ type: 'vendor', label: 'Find practice facilities', category: 'practice-facility' }],
      },
      {
        key: 'pitch-prep',
        title: 'Pitch & outfield preparation',
        description: 'Appoint curator and ground staff; plan pitch rotation, covers, super-soppers and outfield maintenance.',
        owner: 'Cricket Operations',
        actions: [{ type: 'vendor', label: 'Find curators & ground staff', category: 'curator-groundstaff' }],
      },
      {
        key: 'floodlights-power',
        title: 'Floodlights & power backup',
        description: 'Floodlight lux levels suitable for broadcast, generators and fuel plan for night matches.',
        owner: 'Operations',
        actions: [{ type: 'vendor', label: 'Find lighting & generators', category: 'lighting-power' }],
      },
      {
        key: 'permissions',
        title: 'Government permissions',
        description: 'Police permission, fire NOC, municipal approval, traffic plan, PPL/IPRS music licence for public performance, and drone permission if aerial shots are planned.',
        owner: 'Legal',
        critical: true,
        actions: [
          { type: 'upload', label: 'Upload permissions' },
          { type: 'vendor', label: 'Find liaison consultants', category: 'liaison-permissions' },
        ],
      },
    ],
  },
  {
    key: 'franchises',
    title: 'Teams & Franchise Owners',
    summary: 'Sell franchises and onboard team owners.',
    steps: [
      {
        key: 'create-teams',
        title: 'Create teams',
        description: 'Create team slots with name, city and colours. Teams can be renamed by franchise owners after purchase.',
        owner: 'League Owner',
        critical: true,
        actions: [{ type: 'page', label: 'Manage teams', route: 'teams' }],
      },
      {
        key: 'franchise-sale',
        title: 'Franchise sale & owner onboarding',
        description: 'Pitch to prospective owners with a team-sales deck, close deals and invite owners / co-owners to SportsIQ so they get their own team portal.',
        owner: 'League Owner',
        critical: true,
        actions: [
          { type: 'page', label: 'Invite team owners', route: 'teams' },
          { type: 'page', label: 'Open Deck Studio', route: 'decks' },
        ],
      },
      {
        key: 'franchise-agreements',
        title: 'Franchise agreements',
        description: 'Sign league–franchise agreements: fee & instalments, rights & obligations, branding rights, termination, revenue share.',
        owner: 'Legal',
        critical: true,
        actions: [
          { type: 'page', label: 'Use franchise agreement template', route: 'contracts' },
          { type: 'vendor', label: 'Find sports lawyers', category: 'sports-lawyer' },
          { type: 'upload', label: 'Upload signed agreements' },
        ],
      },
      {
        key: 'team-branding',
        title: 'Team logos & identity',
        description: 'Each team finalises logo, colours and anthem within league brand rules.',
        owner: 'Branding',
        actions: [
          { type: 'ai', label: 'Design team logos with AI', tool: 'logo' },
          { type: 'vendor', label: 'Find logo designers', category: 'logo-design' },
        ],
      },
      {
        key: 'support-staff',
        title: 'Team support staff',
        description: 'Head coach, assistant coaches, physio, trainer, analyst, team manager, logistics manager for each team.',
        owner: 'Team Owners',
        actions: [{ type: 'vendor', label: 'Find coaches & support staff', category: 'coaching-staff' }],
      },
    ],
  },
  {
    key: 'players',
    title: 'Player Registration, Trials & Auction',
    summary: 'Build the player pool and fill squads.',
    steps: [
      {
        key: 'player-registration',
        title: 'Open player registration',
        description: 'Players register on SportsIQ with profile, role, batting/bowling style, past performance and KYC (ID & age proof, NOC). Optional registration fee.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [{ type: 'page', label: 'View registrations', route: 'players' }],
      },
      {
        key: 'trials',
        title: 'Conduct trials',
        description: 'Schedule trial batches by city, check-in players via QR, record scout evaluations and auto-shortlist by score, role and age.',
        owner: 'Cricket Operations',
        actions: [
          { type: 'page', label: 'Open trials desk', route: 'trials' },
          { type: 'vendor', label: 'Find scouts & selectors', category: 'coaching-staff' },
        ],
      },
      {
        key: 'player-categorisation',
        title: 'Player categories & base prices',
        description: 'Group players (Icon / A / B / C / Emerging, local vs overseas) and set base prices.',
        owner: 'Cricket Operations',
        actions: [{ type: 'page', label: 'Set categories', route: 'players' }],
      },
      {
        key: 'auction-setup',
        title: 'Auction rules & purse',
        description: 'Team purse, retention/RTM rules, min/max squad size, role balance rules, bid increments.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [{ type: 'page', label: 'Configure auction rules', route: 'auction' }],
      },
      {
        key: 'auction-event',
        title: 'Auction event',
        description: 'Run live auction on SportsIQ with a professional auctioneer, venue and live stream. Squads lock automatically.',
        owner: 'League Owner',
        critical: true,
        actions: [
          { type: 'page', label: 'Open live auction room', route: 'auction' },
          { type: 'vendor', label: 'Find auctioneers', category: 'auctioneer' },
          { type: 'vendor', label: 'Find event venues', category: 'event-venue' },
        ],
      },
      {
        key: 'player-contracts',
        title: 'Player contracts',
        description: 'Player agreements with fee, payment schedule, image rights, code of conduct and anti-corruption clauses.',
        owner: 'Legal',
        critical: true,
        actions: [
          { type: 'page', label: 'Use player contract template', route: 'contracts' },
          { type: 'vendor', label: 'Find sports lawyers', category: 'sports-lawyer' },
          { type: 'upload', label: 'Upload player contracts' },
        ],
      },
    ],
  },
  {
    key: 'cricket-ops',
    title: 'Match Officials & Cricket Operations',
    summary: 'Integrity and quality of cricket.',
    steps: [
      {
        key: 'umpires',
        title: 'Appoint umpires',
        description: 'On-field, third and fourth umpires per match, with appointment roster and fees.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [{ type: 'vendor', label: 'Find umpires', category: 'umpires' }],
      },
      {
        key: 'referees-scorers',
        title: 'Match referees & scorers',
        description: 'Match referee for conduct and over-rates; official scorers trained on the SportsIQ scoring app.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [
          { type: 'vendor', label: 'Find match referees', category: 'match-referee' },
          { type: 'vendor', label: 'Find scorers', category: 'scorers' },
        ],
      },
      {
        key: 'anti-corruption',
        title: 'Anti-corruption & integrity',
        description: 'Integrity officer, player/official education session, mobile phone policy in PMOA, reporting channel.',
        owner: 'Cricket Operations',
        actions: [{ type: 'vendor', label: 'Find integrity officers', category: 'integrity-officer' }],
      },
      {
        key: 'equipment',
        title: 'Playing equipment',
        description: 'Match balls (approved brand), stumps (incl. LED/camera stumps), bails, sight screens, boundary ropes, covers, drinks carts.',
        owner: 'Operations',
        actions: [{ type: 'vendor', label: 'Find sports equipment suppliers', category: 'sports-equipment' }],
      },
      {
        key: 'technology',
        title: 'Match technology',
        description: 'Ball-tracking, ultra-edge/snickometer, speed gun, DRS (if broadcast budget allows), big-screen replays.',
        owner: 'Production',
        actions: [{ type: 'vendor', label: 'Find match tech providers', category: 'match-technology' }],
      },
    ],
  },
  {
    key: 'fixtures',
    title: 'Fixtures & Schedule',
    summary: 'Build a fair, broadcast-friendly schedule.',
    steps: [
      {
        key: 'fixture-schedule',
        title: 'Create fixture schedule',
        description: 'Group stage, playoffs and final with venue availability, team rest days (min 1 day between games), double headers and broadcast slots.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [{ type: 'page', label: 'Auto-generate schedule', route: 'fixtures' }],
      },
      {
        key: 'publish-schedule',
        title: 'Publish schedule',
        description: 'Announce fixtures to teams, broadcasters, sponsors and fans.',
        owner: 'Marketing',
        actions: [{ type: 'page', label: 'Publish fixtures', route: 'fixtures' }],
      },
    ],
  },
  {
    key: 'commercial',
    title: 'Sponsorship, Broadcast & Ticketing',
    summary: 'Monetise the league.',
    steps: [
      {
        key: 'sponsorship-inventory',
        title: 'Create sponsorship inventory',
        description: 'Title, powered-by, associate, jersey (front/back/sleeve/chest), toss, strategic time-out, boundary/LED, on-screen graphics, digital & social, hospitality — with price and deliverables.',
        owner: 'Commercial',
        critical: true,
        actions: [{ type: 'page', label: 'Create opportunities', route: 'sponsorships' }],
      },
      {
        key: 'sponsor-deck',
        title: 'Sponsorship deck',
        description: 'League overview, audience reach, schedule, inventory and pricing.',
        owner: 'Commercial',
        actions: [
          { type: 'page', label: 'Open Deck Studio', route: 'decks' },
          { type: 'vendor', label: 'Find deck designers', category: 'presentation-design' },
        ],
      },
      {
        key: 'sponsor-sales',
        title: 'Close sponsors',
        description: 'Find sponsors on SportsIQ, message them, track pipeline Lead → Contacted → Proposal → Negotiation → Won, then paper the deal.',
        owner: 'Commercial',
        critical: true,
        actions: [
          { type: 'page', label: 'Find sponsors', route: 'sponsors' },
          { type: 'page', label: 'Sponsorship agreement template', route: 'contracts' },
        ],
      },
      {
        key: 'broadcast',
        title: 'Broadcast / OTT / live streaming',
        description: 'Sign broadcast or streaming partner; hire production house (cameras, OB van, graphics, replays, commentary).',
        owner: 'Production',
        critical: true,
        actions: [
          { type: 'vendor', label: 'Find broadcast production', category: 'broadcast-production' },
          { type: 'vendor', label: 'Find streaming platforms', category: 'ott-streaming' },
          { type: 'vendor', label: 'Find commentators', category: 'commentators' },
        ],
      },
      {
        key: 'ticketing',
        title: 'Ticketing',
        description: 'Ticket categories, pricing, promo codes, ticketing partner, box office and QR entry.',
        owner: 'Commercial',
        actions: [
          { type: 'page', label: 'Set up ticketing', route: 'tickets' },
          { type: 'vendor', label: 'Find ticketing partners', category: 'ticketing' },
        ],
      },
      {
        key: 'merchandise',
        title: 'Merchandise',
        description: 'Replica jerseys, caps, flags; online store and stadium stalls.',
        owner: 'Commercial',
        actions: [{ type: 'vendor', label: 'Find merchandise makers', category: 'merchandise' }],
      },
    ],
  },
  {
    key: 'branding-production',
    title: 'Jerseys, Kits & Branding Production',
    summary: 'Everything that is printed, fabricated or made.',
    steps: [
      {
        key: 'jersey-design',
        title: 'Jersey design',
        description: 'Home/away kits per team with mandatory league logo and sponsor logo positions as per sponsorship contracts.',
        owner: 'Branding',
        critical: true,
        actions: [
          { type: 'page', label: 'Open Jersey Studio', route: 'jerseys' },
          { type: 'vendor', label: 'Find jersey designers', category: 'jersey-design' },
        ],
      },
      {
        key: 'jersey-printing',
        title: 'Jersey & kit printing',
        description: 'Send approved design with size-wise quantities to printers, approve sample, track bulk production and delivery.',
        owner: 'Branding',
        critical: true,
        actions: [
          { type: 'page', label: 'Send approved kits to printers', route: 'jerseys' },
          { type: 'vendor', label: 'Find jersey printers', category: 'jersey-printing' },
        ],
      },
      {
        key: 'trophies',
        title: 'Trophies & medals',
        description: 'Championship trophy, runner-up trophy, individual awards and match awards, medals.',
        owner: 'Operations',
        actions: [{ type: 'vendor', label: 'Find trophy makers', category: 'trophy-medals' }],
      },
      {
        key: 'ground-branding',
        title: 'Ground branding & fabrication',
        description: 'Boundary boards, sight-screen branding, backdrops, podium, gates, toss area, dugouts.',
        owner: 'Branding',
        actions: [{ type: 'vendor', label: 'Find fabricators', category: 'fabrication-branding' }],
      },
      {
        key: 'led',
        title: 'LED boards & big screens',
        description: 'Perimeter LED, giant screens for replays and sponsor content.',
        owner: 'Production',
        actions: [{ type: 'vendor', label: 'Find LED providers', category: 'led-screens' }],
      },
    ],
  },
  {
    key: 'logistics',
    title: 'Travel, Hospitality & Logistics',
    summary: 'Move and house everyone safely.',
    steps: [
      {
        key: 'hotels',
        title: 'Hotels & room allotment',
        description: 'Team hotels, officials hotel, broadcast crew; rooming lists with check-in/check-out.',
        owner: 'Logistics',
        critical: true,
        actions: [
          { type: 'page', label: 'Hotels & rooming list', route: 'logistics' },
          { type: 'vendor', label: 'Find hotels', category: 'hotels' },
        ],
      },
      {
        key: 'travel',
        title: 'Flights & transport',
        description: 'Flights/trains for teams and officials, team buses, local cabs, airport transfers.',
        owner: 'Logistics',
        critical: true,
        actions: [
          { type: 'page', label: 'Plan travel', route: 'logistics' },
          { type: 'vendor', label: 'Find travel agents', category: 'travel-agency' },
          { type: 'vendor', label: 'Find bus & cab operators', category: 'ground-transport' },
        ],
      },
      {
        key: 'catering',
        title: 'Catering & hospitality',
        description: 'Player meals (nutritionist approved), officials, crew, VIP/hospitality boxes.',
        owner: 'Logistics',
        actions: [{ type: 'vendor', label: 'Find caterers', category: 'catering' }],
      },
      {
        key: 'security',
        title: 'Security',
        description: 'Venue security, team hotel security, bouncers, crowd management, PMOA access control.',
        owner: 'Operations',
        critical: true,
        actions: [{ type: 'vendor', label: 'Find security agencies', category: 'security' }],
      },
      {
        key: 'medical',
        title: 'Medical cover',
        description: 'Ambulance at every match, doctor, physios, tie-up with nearby hospital.',
        owner: 'Operations',
        critical: true,
        actions: [{ type: 'vendor', label: 'Find medical services', category: 'medical' }],
      },
      {
        key: 'accreditation',
        title: 'Accreditation',
        description: 'Define access zones and categories, collect applications with photo and ID verification, approve, design and print cards (CR80), issue them, and verify at zone gates. Revoke or reprint lost cards.',
        tip: 'Close applications 7–10 days before the first match so cards can be verified, printed and distributed with team welcome kits.',
        owner: 'Operations',
        critical: true,
        actions: [
          { type: 'page', label: 'Open accreditation', route: 'accreditation' },
          { type: 'vendor', label: 'Find ID card printers', category: 'printing' },
        ],
      },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing, PR & Ceremonies',
    summary: 'Build hype and fill the stands.',
    steps: [
      {
        key: 'launch-event',
        title: 'League launch & press conference',
        description: 'Launch event with trophy unveiling, jersey launch and media.',
        owner: 'Marketing',
        actions: [
          { type: 'vendor', label: 'Find event managers', category: 'event-management' },
          { type: 'vendor', label: 'Find anchors', category: 'anchors-hosts' },
        ],
      },
      {
        key: 'social-media',
        title: 'Social media & content',
        description: 'Content calendar: team reveals, player stories, match promos, sponsor shout-outs, contests.',
        owner: 'Marketing',
        actions: [
          { type: 'vendor', label: 'Find digital agencies', category: 'digital-marketing' },
          { type: 'vendor', label: 'Find photographers', category: 'photography-video' },
        ],
      },
      {
        key: 'pr',
        title: 'PR & media relations',
        description: 'Press releases, media accreditation, interviews, coverage tracking.',
        owner: 'Marketing',
        actions: [
          { type: 'ai', label: 'Draft press release', tool: 'press-release' },
          { type: 'vendor', label: 'Find PR agencies', category: 'pr-agency' },
        ],
      },
      {
        key: 'opening-ceremony',
        title: 'Opening ceremony',
        description: 'Performers, celebrity appearances, stage, sound, fireworks/pyro (with permission).',
        owner: 'Marketing',
        actions: [
          { type: 'vendor', label: 'Find artists & performers', category: 'artists-performers' },
          { type: 'vendor', label: 'Find sound & stage', category: 'sound-stage' },
        ],
      },
    ],
  },
  {
    key: 'execution',
    title: 'Tournament Execution',
    summary: 'Deliver every match flawlessly.',
    steps: [
      {
        key: 'match-day-ops',
        title: 'Match-day operations checklist',
        description: 'Ground ready, pitch & markings, stumps, rope, chairs, commentary box, AV, security, medical, water, toss-area branding — "Ready for toss" sign-off.',
        owner: 'Operations',
        critical: true,
        actions: [{ type: 'page', label: 'Open fixtures', route: 'fixtures' }],
      },
      {
        key: 'live-scoring',
        title: 'Live scoring & match centre',
        description: 'Ball-by-ball scoring, live scorecards, automatic points table and NRR, and a public match centre for fans.',
        owner: 'Cricket Operations',
        critical: true,
        actions: [
          { type: 'page', label: 'Open scoring', route: 'fixtures' },
          { type: 'vendor', label: 'Find scorers', category: 'scorers' },
        ],
      },
      {
        key: 'sponsor-deliverables',
        title: 'Sponsor deliverables tracking',
        description: 'Track every promised deliverable per sponsor (logos, LED exposure, posts, mentions) with proof.',
        owner: 'Commercial',
        actions: [{ type: 'page', label: 'Open sponsorships', route: 'sponsorships' }],
      },
      {
        key: 'expense-control',
        title: 'Daily expense control',
        description: 'Record every expense against budget categories; alerts on overshoot.',
        owner: 'Finance',
        critical: true,
        actions: [{ type: 'page', label: 'Open finance', route: 'finance' }],
      },
    ],
  },
  {
    key: 'closing',
    title: 'Final, Closing & Post-Season',
    summary: 'Finish strong and set up next season.',
    steps: [
      {
        key: 'closing-ceremony',
        title: 'Final & closing ceremony',
        description: 'Presentation ceremony, awards, trophy, fireworks, media.',
        owner: 'Marketing',
        actions: [{ type: 'vendor', label: 'Find event managers', category: 'event-management' }],
      },
      {
        key: 'settlements',
        title: 'Prize money & vendor settlements',
        description: 'Pay prize money (with TDS), officials, vendors; collect outstanding receivables.',
        owner: 'Finance',
        critical: true,
        actions: [{ type: 'page', label: 'Open finance', route: 'finance' }],
      },
      {
        key: 'sponsor-reports',
        title: 'Sponsor post-campaign reports',
        description: 'Reach, impressions, deliverables proof and renewal pitch.',
        owner: 'Commercial',
        actions: [{ type: 'page', label: 'Open sponsorships', route: 'sponsorships' }],
      },
      {
        key: 'pnl',
        title: 'Final accounts & P&L',
        description: 'Close books, P&L, audit, GST filing.',
        owner: 'Finance',
        critical: true,
        actions: [
          { type: 'page', label: 'View P&L', route: 'finance' },
          { type: 'vendor', label: 'Find auditors', category: 'chartered-accountant' },
        ],
      },
      {
        key: 'season-review',
        title: 'Season review',
        description: 'Fan NPS, team/sponsor feedback, lessons learned, plan for next season.',
        owner: 'League Owner',
        actions: [{ type: 'upload', label: 'Upload season report' }],
      },
    ],
  },
];

export const ALL_STEPS = PLAYBOOK.flatMap((p) => p.steps.map((s) => ({ ...s, phase: p.key })));
export const STEP_KEYS = new Set(ALL_STEPS.map((s) => s.key));
