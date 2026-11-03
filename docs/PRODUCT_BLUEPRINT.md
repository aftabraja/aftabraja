# SPORTSIQ — Product Blueprint

**SportsIQ is the operating system for sports leagues.** A league owner creates an account, and SportsIQ guides them step by step from idea to closing ceremony. Every vendor, sponsor, team owner, player and management member works inside the same platform, so nothing runs on Excel or WhatsApp.

Long-term goal: run leagues of every size, from corporate T10s to IPL-scale franchises, and then expand to other sports.

---

## 1. Roles and portals

| Role | How they join | What they see |
|---|---|---|
| **Super Admin** (platform owner) | Seeded | Everything: every league, user, vendor, service, sponsor, opportunity, transaction, agency, talent and audit log. Can verify vendors and agencies, activate subscriptions, disable users and unpublish talent. |
| **Agency / Manager** | Self-registers (₹2,500 per year) | Talent roster, availability and fees, enquiries from brands and leagues |
| **League Owner** | Self-registers (₹5,000 per league season) | Their leagues: playbook, teams, players, management, sponsorships, finance and P&L, Deck Studio, contracts, documents, settings |
| **League Management** (Ops, Finance, Marketing, Legal…) | Added by the owner (a login is created) | The same league workspace, without owner-only actions (deleting the league, removing people) |
| **Team Owner / Co-owner** | Added by the league with a share % (a login is created) | Their team, squad, purse, league dashboard, playbook (read only), notifications |
| **Player** | Self-registers (free) | Profile and stats, open leagues, registration status, selection alerts |
| **Vendor** | Self-registers | Business profile, services with prices, enquiries from leagues |
| **Sponsor** | Self-registers | League marketplace (upcoming leagues, readiness, open packages), messaging with league owners |

## 2. Modules built so far (Phase 1)

1. **Guided execution playbook**: 13 phases and 66 steps, with a league readiness progress bar. Each step links to a module, the AI logo studio, an upload, or the vendor search.
2. **Split-screen vendor search**: the left menu, the dashboard and a vendor panel sit side by side. There are 70+ categories across 12 groups, with filters for city, price and rating, and you can message a vendor directly.
3. **Teams and franchise owners**: teams, purses, franchise fees, owners and co-owners with share %.
4. **Players**: registration, shortlisting, categories (Icon/A/B/C/Emerging), base and sold prices, team allocation.
5. **Sponsorship**: inventory (Title, Powered By, Jersey, On-ground, Broadcast, Digital…) with price, slots and deliverables. Sponsors browse a marketplace and send interest, and league managers can search the sponsor directory.
6. **Finance and P&L**: a category budget, expenses and income, paid and pending tracking, overshoot alerts, P&L, CSV export.
7. **Deck Studio**: sample decks (Sponsorship, Team Sales, Concept, Broadcast, Investor) filled in from the league's data, with an editor for every slide and PDF export. There is also a button to hire a deck designer.
8. **Legal contract templates**: Franchise, Player, Sponsorship, Vendor, Venue, Broadcast, NDA and Image Release. See the legal stance below.
9. **AI Logo Studio**: crest concepts generated instantly for leagues and teams.
10. **Messaging and notifications**: 1:1 conversations, unread counts, and alerts for steps, budgets, registrations and sponsor interest.
11. **Super Admin console**: overview, leagues, users and subscriptions, vendor verification, sponsors and inventory, transactions, audit log.
12. **Landing page**: features, real product screenshots, pricing, role sign-up, FAQ, roadmap.

## 3. Legal stance (non-negotiable)

- Contract templates are labelled everywhere as **generic reference templates, not legal advice**, and tell the user to **verify with a qualified lawyer**.
- The notice appears on the contracts list, in the editor, and inside every exported document (header and footer).
- Users must tick an acknowledgement before they can download, print or copy a contract. The acknowledgement is stored with a timestamp and written to the audit log.
- Every template screen has a **Find legal vendors / Get it reviewed by a lawyer** button.
- The landing page footer states that SportsIQ is a technology platform and is not a party to agreements between users.
- SportsIQ does not e-sign, notarise, collect stamp duty or give legal opinions.

## 4. Pricing (configurable in `apps/api/src/lib/util.ts`)

| Plan | Price |
|---|---|
| League Owner | ₹5,000 per league season |
| Team Owner | ₹2,000 per season |
| Vendor | ₹1,500 per year |
| Sponsor | ₹2,500 per year |
| Player | Free |

Every paid plan starts with a 14-day trial. Until online payments are integrated, the Super Admin activates plans.

## 5. Season operations (Phase 2, built)

| Module | What it does |
|---|---|
| **Fixtures & auto-scheduler** | Single or double round-robin, minimum rest days, one match per team per day, venue rotation, IPL-style playoffs (Q1, Eliminator, Q2, Final) or semi-finals, seeded from the table, with winners and losers filled in automatically |
| **Ball-by-ball scoring** | Scorer console (runs, wides, no-balls, byes, leg-byes, 7 dismissal types, strike rotation, undo), scorecards, fall of wickets, points table with NRR (Win 2, Tie/NR 1), result calculation |
| **Live match centre** | Public league page (`/l/:slug`) with fixtures, live scores, points table and tickets. Live updates via Server-Sent Events. |
| **Live auction** | Purse per team, bid increment, timer that resets on each bid, min/max squad, a purse guard that reserves money to complete the squad, team owners bid from their own login, auctioneer desk, sold/unsold, re-auction round |
| **Trials** | Batches, open or invite-only registration, QR passes, gate check-in, scout scores (bat/bowl/field/fitness), auto-shortlist by score, role and age |
| **Travel & hotels** | Hotels, rooming lists, flights/trains/buses with PNR and cost, per-team itinerary combining travel, check-ins and matches |
| **Ticketing** | Categories (season or per match), online sales with QR e-tickets, box office and complimentary tickets, gate check-in with re-entry protection, atomic inventory |
| **Payments** | Razorpay orders with signature verification. A clearly labelled TEST mode works until keys are added. Used for subscriptions and tickets. |
| **Accreditation** | Zones, categories (letter and colour), applications with photo and government ID verification (only the last 4 digits are stored), approval rules, CR80 card design (front and back), A4 9-up or PVC card-printer printing with duplex alignment, issue, revoke, versioned reprint (old cards stop working), zone-gate QR verification, public application form for media, vendors and volunteers |

## 6. Business layer (built)

- **Expense management**: 20 categories, vendor link, invoice number, GST, TDS, payment mode, receipt upload, paid/partial/pending, and an owner approval limit for staff expenses (pending items are excluded from actuals until approved). Budget overshoot alerts.
- **P&L**: one finance engine powers the dashboard, the finance page and all reports. Ticket sales are included automatically. GST input/output and TDS are tracked.
- **Reports centre**: 31 reports across Finance (P&L, budget vs actual, expense register, by category, by vendor, income register, receivables with ageing, payables, GST, TDS, monthly cash flow, pending approvals), Commercial (sponsorship, ticket sales, ticket orders), Cricket (fixtures and results, points table, batting and bowling stats, auction results, squads and purse, registrations, trial results) and Operations (playbook progress, teams and owners, management, accreditation register and gate scans, rooming list, travel manifest, vendors engaged). Each one downloads as **Excel (.xlsx)**, **PDF** or **CSV**, with an optional date range.
- **Talent marketplace**: agencies and personal managers (`TALENT_AGENT` role) list the active cricketers and retired legends they represent, with availability for endorsements, league seasons and appearances, indicative fees and brand restrictions. Brands send endorsement enquiries and leagues sign legends. Each enquiry opens a chat with the agent. Publishing requires the agent to declare written authorisation, and the SuperAdmin verifies agencies and players and can unpublish profiles. Demo data uses fictional players only.

## 7. Roadmap

| Next | Scope |
|---|---|
| Notifications | Email, SMS and WhatsApp delivery for existing in-app alerts |
| Storage | S3-compatible object storage for logos, receipts, photos and documents |
| Integrations | E-sign providers, Tally/Zoho export, broadcast graphics feed |
| Later | Mobile apps, multi-sport (deferred by product decision) |

## 8. The League Execution Playbook

Source of truth: `apps/api/src/data/playbook.ts`

### Phase 1 — League Foundation & Identity
_Define what the league is, who owns it and how it looks._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Create league profile | League Owner | ✅ | League name, sport, format (T10/T20/ODI/Indoor/Corporate), category (open, corporate, celebrity, state-level, school/university), host city and target season window. |
| League logo | Branding | ✅ | Upload your league logo. No logo yet? Generate concepts with SportsIQ AI or hire a logo designer from the vendor marketplace. |
| Brand identity kit | Branding |  | Colour palette, typography, logo variants (mono, horizontal, icon) and usage guidelines used across jerseys, broadcast graphics and social media. |
| Legal entity, PAN & GST | Legal & Finance | ✅ | Register the organising entity (Pvt Ltd / LLP / Society / Trust), obtain PAN, GST registration and open a dedicated league bank account. |
| Trademark & IP protection | Legal |  | File trademark for league name and logo (and team names if league-owned). Define IP ownership of content and broadcast footage. |
| Governing body sanction / NOC | League Owner |  | Obtain approval or NOC from the relevant association (state cricket association / national federation) where required, especially if registered players participate. |
| Tournament rules & playing conditions | Cricket Operations | ✅ | Format, points system, tie-breakers (NRR), over-rate rules, impact-player/substitute rules, rain rules (DLS), squad size, overseas/local player limits, code of conduct and disciplinary process. |

### Phase 2 — Strategy, Budget & Calendar
_Lock the commercial model, budget and season window._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Season window & key milestones | League Owner | ✅ | Fix league dates avoiding clashes with international/domestic calendar, festivals, exams and monsoon. Set milestone dates: franchise sale, registrations, trials, auction, launch, first match, final. |
| Number of teams & franchise model | League Owner | ✅ | Decide team count, franchise fee, ownership model (single owner / co-owners), purse per team, and franchise term (1 season / multi-season). |
| Budget plan | Finance | ✅ | Category-wise budget: venue, production & broadcast, jerseys & kits, travel, accommodation, hospitality, officials, prize money, marketing, ceremonies, insurance, staff, contingency (8–10%). |
| Revenue model | Finance |  | Plan income streams: franchise fees, sponsorship, broadcast/OTT rights, ticketing, merchandise, player registration fees, hospitality boxes, digital/fantasy partnerships. |
| Prize money & awards structure | League Owner |  | Winner, runner-up, player of the series, best batter/bowler, emerging player, fair play, match awards. |
| Insurance | Finance |  | Public liability, player personal accident, event cancellation/weather, equipment and broadcast equipment insurance. |

### Phase 3 — Venue & Infrastructure
_Secure grounds, pitches and permissions._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Book stadium / grounds | Operations | ✅ | Shortlist and book match venues with dressing rooms, seating, parking, power backup and broadcast positions. Lock dates in a signed agreement. |
| Practice nets & training facilities | Operations |  | Allocate practice slots per team, with bowling machines and nets near team hotels. |
| Pitch & outfield preparation | Cricket Operations |  | Appoint curator and ground staff; plan pitch rotation, covers, super-soppers and outfield maintenance. |
| Floodlights & power backup | Operations |  | Floodlight lux levels suitable for broadcast, generators and fuel plan for night matches. |
| Government permissions | Legal | ✅ | Police permission, fire NOC, municipal approval, traffic plan, PPL/IPRS music licence for public performance, and drone permission if aerial shots are planned. |

### Phase 4 — Teams & Franchise Owners
_Sell franchises and onboard team owners._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Create teams | League Owner | ✅ | Create team slots with name, city and colours. Teams can be renamed by franchise owners after purchase. |
| Franchise sale & owner onboarding | League Owner | ✅ | Pitch to prospective owners with a team-sales deck, close deals and invite owners / co-owners to SportsIQ so they get their own team portal. |
| Franchise agreements | Legal | ✅ | Sign league–franchise agreements: fee & instalments, rights & obligations, branding rights, termination, revenue share. |
| Team logos & identity | Branding |  | Each team finalises logo, colours and anthem within league brand rules. |
| Team support staff | Team Owners |  | Head coach, assistant coaches, physio, trainer, analyst, team manager, logistics manager for each team. |

### Phase 5 — Player Registration, Trials & Auction
_Build the player pool and fill squads._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Open player registration | Cricket Operations | ✅ | Players register on SportsIQ with profile, role, batting/bowling style, past performance and KYC (ID & age proof, NOC). Optional registration fee. |
| Conduct trials | Cricket Operations |  | Schedule trial batches by city, check-in players via QR, record scout evaluations and auto-shortlist by score, role and age. |
| Player categories & base prices | Cricket Operations |  | Group players (Icon / A / B / C / Emerging, local vs overseas) and set base prices. |
| Auction rules & purse | Cricket Operations | ✅ | Team purse, retention/RTM rules, min/max squad size, role balance rules, bid increments. |
| Auction event | League Owner | ✅ | Run live auction on SportsIQ with a professional auctioneer, venue and live stream. Squads lock automatically. |
| Player contracts | Legal | ✅ | Player agreements with fee, payment schedule, image rights, code of conduct and anti-corruption clauses. |

### Phase 6 — Match Officials & Cricket Operations
_Integrity and quality of cricket._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Appoint umpires | Cricket Operations | ✅ | On-field, third and fourth umpires per match, with appointment roster and fees. |
| Match referees & scorers | Cricket Operations | ✅ | Match referee for conduct and over-rates; official scorers trained on the SportsIQ scoring app. |
| Anti-corruption & integrity | Cricket Operations |  | Integrity officer, player/official education session, mobile phone policy in PMOA, reporting channel. |
| Playing equipment | Operations |  | Match balls (approved brand), stumps (incl. LED/camera stumps), bails, sight screens, boundary ropes, covers, drinks carts. |
| Match technology | Production |  | Ball-tracking, ultra-edge/snickometer, speed gun, DRS (if broadcast budget allows), big-screen replays. |

### Phase 7 — Fixtures & Schedule
_Build a fair, broadcast-friendly schedule._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Create fixture schedule | Cricket Operations | ✅ | Group stage, playoffs and final with venue availability, team rest days (min 1 day between games), double headers and broadcast slots. |
| Publish schedule | Marketing |  | Announce fixtures to teams, broadcasters, sponsors and fans. |

### Phase 8 — Sponsorship, Broadcast & Ticketing
_Monetise the league._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Create sponsorship inventory | Commercial | ✅ | Title, powered-by, associate, jersey (front/back/sleeve/chest), toss, strategic time-out, boundary/LED, on-screen graphics, digital & social, hospitality — with price and deliverables. |
| Sponsorship deck | Commercial |  | League overview, audience reach, schedule, inventory and pricing. |
| Close sponsors | Commercial | ✅ | Find sponsors on SportsIQ, message them, track pipeline Lead → Contacted → Proposal → Negotiation → Won, then paper the deal. |
| Broadcast / OTT / live streaming | Production | ✅ | Sign broadcast or streaming partner; hire production house (cameras, OB van, graphics, replays, commentary). |
| Ticketing | Commercial |  | Ticket categories, pricing, promo codes, ticketing partner, box office and QR entry. |
| Merchandise | Commercial |  | Replica jerseys, caps, flags; online store and stadium stalls. |

### Phase 9 — Jerseys, Kits & Branding Production
_Everything that is printed, fabricated or made._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Jersey design | Branding | ✅ | Home/away kits per team with mandatory league logo and sponsor logo positions as per sponsorship contracts. |
| Jersey & kit printing | Branding | ✅ | Send approved design with size-wise quantities to printers, approve sample, track bulk production and delivery. |
| Trophies & medals | Operations |  | Championship trophy, runner-up trophy, individual awards and match awards, medals. |
| Ground branding & fabrication | Branding |  | Boundary boards, sight-screen branding, backdrops, podium, gates, toss area, dugouts. |
| LED boards & big screens | Production |  | Perimeter LED, giant screens for replays and sponsor content. |

### Phase 10 — Travel, Hospitality & Logistics
_Move and house everyone safely._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Hotels & room allotment | Logistics | ✅ | Team hotels, officials hotel, broadcast crew; rooming lists with check-in/check-out. |
| Flights & transport | Logistics | ✅ | Flights/trains for teams and officials, team buses, local cabs, airport transfers. |
| Catering & hospitality | Logistics |  | Player meals (nutritionist approved), officials, crew, VIP/hospitality boxes. |
| Security | Operations | ✅ | Venue security, team hotel security, bouncers, crowd management, PMOA access control. |
| Medical cover | Operations | ✅ | Ambulance at every match, doctor, physios, tie-up with nearby hospital. |
| Accreditation | Operations |  | Passes for players, staff, officials, media, vendors, VIPs with zone permissions. |

### Phase 11 — Marketing, PR & Ceremonies
_Build hype and fill the stands._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| League launch & press conference | Marketing |  | Launch event with trophy unveiling, jersey launch and media. |
| Social media & content | Marketing |  | Content calendar: team reveals, player stories, match promos, sponsor shout-outs, contests. |
| PR & media relations | Marketing |  | Press releases, media accreditation, interviews, coverage tracking. |
| Opening ceremony | Marketing |  | Performers, celebrity appearances, stage, sound, fireworks/pyro (with permission). |

### Phase 12 — Tournament Execution
_Deliver every match flawlessly._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Match-day operations checklist | Operations | ✅ | Ground ready, pitch & markings, stumps, rope, chairs, commentary box, AV, security, medical, water, toss-area branding — "Ready for toss" sign-off. |
| Live scoring & match centre | Cricket Operations | ✅ | Ball-by-ball scoring, live scorecards, automatic points table and NRR. |
| Sponsor deliverables tracking | Commercial |  | Track every promised deliverable per sponsor (logos, LED exposure, posts, mentions) with proof. |
| Daily expense control | Finance | ✅ | Record every expense against budget categories; alerts on overshoot. |

### Phase 13 — Final, Closing & Post-Season
_Finish strong and set up next season._

| Step | Owner | Critical | What happens |
|---|---|---|---|
| Final & closing ceremony | Marketing |  | Presentation ceremony, awards, trophy, fireworks, media. |
| Prize money & vendor settlements | Finance | ✅ | Pay prize money (with TDS), officials, vendors; collect outstanding receivables. |
| Sponsor post-campaign reports | Commercial |  | Reach, impressions, deliverables proof and renewal pitch. |
| Final accounts & P&L | Finance | ✅ | Close books, P&L, audit, GST filing. |
| Season review | League Owner |  | Fan NPS, team/sponsor feedback, lessons learned, plan for next season. |

## 9. Vendor categories

Source of truth: `apps/api/src/data/vendorCategories.ts`

**Venues & Infrastructure**
- Stadiums & Grounds — Stadium hire per match, Ground hire per day, Turf ground, Indoor arena, Box cricket arena
- Practice Nets & Academies — Net sessions, Bowling machine, Indoor nets, Gym access
- Curators & Ground Staff — Pitch preparation, Outfield maintenance, Covers & super-sopper, Ground markings
- Floodlights & Generators — Floodlight rental, Generator rental, Power distribution, Fuel supply
- Event & Banquet Venues — Auction venue, Launch event venue, Awards night venue, Press conference hall
- Tents, Stands & Temporary Structures — Temporary seating, German hangars, VIP enclosures, Dugouts, Commentary box
- Housekeeping & Sanitation — Venue cleaning, Portable toilets, Waste management

**Cricket Operations & Officials**
- Umpires — On-field umpire, Third umpire, Fourth umpire, Umpire panel
- Match Referees — Match referee per match, Tournament referee
- Scorers & Statisticians — Official scorer, Digital scorer, Statistician, Analyst
- Coaches, Scouts & Selectors — Head coach, Batting coach, Bowling coach, Fielding coach, Talent scout, Selector
- Fitness Trainers & Physios — Strength & conditioning, Physiotherapist, Massage therapist, Nutritionist
- Anti-Corruption & Integrity — Integrity officer, ACU education session, Investigations
- Auctioneers — Player auction host, Franchise auction host
- Sports Equipment Suppliers — Match balls, Stumps & bails, LED stumps, Boundary ropes, Sight screens, Bats & pads, Helmets & gloves
- Match Technology & Analytics — Ball tracking, Speed gun, Snickometer / Ultra-edge, DRS system, Performance analytics

**Broadcast, Media & Technology**
- Broadcast Production Houses — Multi-camera production, OB van, Replays & slow-mo, Broadcast graphics, Spider cam, Drone camera
- OTT & Live Streaming — YouTube live streaming, OTT platform rights, Streaming encoder setup, Internet bonding
- Commentators & Experts — English commentary, Hindi commentary, Regional commentary, Expert analyst
- LED Boards & Big Screens — Perimeter LED boards, Giant replay screen, LED backdrop, Content operation
- Audio-Visual Equipment — PA system, Wireless mics, Projectors, Walkie-talkies
- IT, Wi-Fi & Connectivity — Event Wi-Fi, Leased line, Laptops & printers rental, CCTV
- Photographers & Videographers — Match photography, Team photoshoot, Highlights editing, Documentary, Reels creation
- Fantasy, Gaming & App Partners — Fantasy game partner, League app development, Website development

**Branding, Design & Creative**
- Logo Designers — League logo, Team logo, Logo refresh, Mascot design
- Branding Agencies — Brand identity kit, Brand guidelines, Naming, Brand strategy
- Jersey & Kit Designers — Jersey design, Training kit design, Kit mock-ups, Sponsor logo placement
- Graphic Designers — Social media creatives, Posters, Match-day graphics, Broadcast graphics package
- Presentation & Deck Designers — Sponsorship deck, Franchise sales deck, Investor deck
- Motion Graphics & Animation — Logo animation, Intro video, Player cards animation, 3D trophy render
- Music, Anthem & Jingles — League anthem, Team anthem, Jingles, Stadium DJ
- Fabrication & Ground Branding — Boundary boards, Sight-screen branding, Backdrops, Podium, Entry arches, Standees
- Printing & ID Cards — Accreditation cards, Lanyards, Flex printing, Brochures, Tickets printing

**Kits, Merchandise & Awards**
- Jersey Printers & Kit Manufacturers — Sublimation printing, Screen printing, Embroidery, Full kit (jersey, trouser, cap), Training kits
- Merchandise Makers — Replica jerseys, Caps & hats, Flags & scarves, Mugs & keychains, Online merch store
- Trophy & Medal Makers — Championship trophy, Runner-up trophy, Individual awards, Medals, Mementos
- Corporate Gifting & Welcome Kits — Player welcome kits, VIP hampers, Sponsor gifts

**Events, Ceremonies & Entertainment**
- Event Management Companies — Opening ceremony, Closing ceremony, Launch event, Awards night, Auction event management
- Anchors & Hosts — Event anchor, Auction host, Presentation ceremony host, Stadium MC
- Artists, Celebrities & Performers — Singer / band, Dance troupe, Celebrity appearance, Cheerleaders, Mascot performer
- Sound, Light & Stage — Stage setup, Concert sound, Stage lighting, Trussing
- Fireworks & Special Effects — Fireworks, Cold pyro, Confetti, Drone light show, Laser show

**Marketing, PR & Digital**
- Digital Marketing Agencies — Social media management, Paid ads, Content calendar, SEO, Contests
- Influencers & Creators — Instagram promotion, YouTube promotion, Meet & greet
- PR & Media Agencies — Press releases, Press conference, Media coverage, Crisis communication
- Advertising & Outdoor (OOH) — Hoardings, Radio ads, Newspaper ads, Cinema ads, Bus branding
- Sponsorship Sales Agencies — Sponsorship sales, Valuation of inventory, Sponsor activation

**Travel, Hospitality & Logistics**
- Hotels & Accommodation — Team hotel, Officials hotel, Crew accommodation, Banquet hall
- Travel Agencies (Flights & Trains) — Group flight booking, Train booking, Visa assistance, Travel insurance
- Buses, Cabs & Transport — Team bus, Luxury cars, Airport transfers, Tempo traveller
- Catering & Food — Player meals, Officials lunch, VIP hospitality, Crew meals, Food stalls
- Water & Beverages — Packaged water, Energy drinks, Ice supply
- Logistics & Courier — Kit transport, Equipment logistics, Courier, Storage / warehousing
- Furniture & Equipment Rental — Chairs & tables, Sofas for VIP, Coolers & fans, Barricades

**Safety, Security & Medical**
- Security Agencies & Bouncers — Venue security, Bouncers, Hotel security, Crowd management, Personal security officer
- Medical & Ambulance — Ambulance on standby, Doctor on duty, First-aid team, Hospital tie-up
- Fire & Safety — Fire tender, Fire extinguishers, Safety audit
- Anti-Doping & Testing — Dope testing, Education sessions

**Legal, Finance & Compliance**
- Sports & Corporate Lawyers — Franchise agreements, Player contracts, Sponsor agreements, Broadcast agreements, Company registration
- IP & Trademark Lawyers — Trademark filing, Copyright, IP enforcement
- Chartered Accountants & Auditors — GST registration, Bookkeeping, TDS filing, Audit, Financial planning
- Insurance Brokers — Event liability insurance, Player accident insurance, Event cancellation cover, Equipment insurance
- Permissions & Liaison Consultants — Police permission, Fire NOC, Municipal approvals, PPL/IPRS licence, Drone permission
- Payments & Banking — Payment gateway, POS machines, Escrow services

**Staffing & Manpower**
- Event Staff & Volunteers — Ushers, Ball boys/girls, Registration desk staff, Volunteers, Hostesses
- Team & Logistics Managers — Team manager, Liaison officer, Logistics coordinator, Tournament director
- League Consultants — League setup consulting, Tournament operations, Commercial strategy

**Fan Experience & Ticketing**
- Ticketing Partners — Online ticketing, Box office, QR scanning, Access control
- Fan Engagement & Activation — Fan zones, Games & contests, Face painting, Photo booths
- Food & Beverage Concessions — Food stalls, Beverage counters, Mobile vending
