import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { VENDOR_CATEGORIES } from '../src/data/vendorCategories.js';
import { DEMO_LOGO } from './demoLogo.js';

const prisma = new PrismaClient();
const DEMO = process.env.SEED_DEMO !== 'false';
const DEMO_PASSWORD = 'Demo@1234';

async function main() {
  // 1. Super admin
  const adminEmail = (process.env.SUPERADMIN_EMAIL ?? 'admin@sportsiq.in').toLowerCase();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: 'SportsIQ Admin', role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe@123', 10) },
  });

  // 2. Vendor taxonomy (idempotent)
  for (const c of VENDOR_CATEGORIES) {
    await prisma.vendorCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, group: c.group, suggestions: c.services },
      create: { slug: c.slug, name: c.name, group: c.group, suggestions: c.services },
    });
  }
  console.log(`Seeded ${VENDOR_CATEGORIES.length} vendor categories`);

  if (!DEMO) return;
  if (await prisma.user.findUnique({ where: { email: 'owner@demo.sportsiq.in' } })) {
    console.log('Demo data already present');
    return;
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const trial = (plan: string, amount: number) => ({ create: { plan, amount, status: 'TRIAL', validTill: new Date(Date.now() + 14 * 864e5) } });

  // 3. Demo league owner + CLT10
  const owner = await prisma.user.create({ data: { email: 'owner@demo.sportsiq.in', name: 'Rahul Mehta', role: 'LEAGUE_OWNER', passwordHash: hash, phone: '9800000001', subscriptions: trial('LEAGUE_OWNER', 5000) } });
  const start = new Date(); start.setMonth(start.getMonth() + 2);
  const end = new Date(start); end.setDate(end.getDate() + 18);
  const league = await prisma.league.create({
    data: {
      name: 'Corporate League T10', shortCode: 'CLT10', slug: 'clt10', sport: 'Cricket', format: 'T10', category: 'Corporate',
      city: 'Mumbai', description: 'Premier corporate T10 cricket league with 8 franchises.', startDate: start, endDate: end,
      numTeams: 8, teamPurse: 5000000, status: 'REGISTRATION_OPEN', ownerId: owner.id, primaryColor: '#1d4ed8', logoUrl: DEMO_LOGO,
    },
  });
  const teamNames = ['Mumbai Mavericks', 'Pune Panthers', 'Thane Titans', 'Navi Mumbai Ninjas', 'Andheri Avengers', 'Bandra Blasters', 'Powai Pirates', 'Worli Warriors'];
  const teams = await Promise.all(teamNames.map((name) => prisma.team.create({ data: { leagueId: league.id, name, shortName: name.split(' ').map((w) => w[0]).join(''), city: 'Mumbai', purse: 5000000, franchiseFee: 1500000 } })));
  const teamOwner = await prisma.user.create({ data: { email: 'teamowner@demo.sportsiq.in', name: 'Priya Shah', role: 'TEAM_OWNER', passwordHash: hash, subscriptions: trial('TEAM_OWNER', 2000) } });
  await prisma.teamOwner.create({ data: { teamId: teams[0].id, userId: teamOwner.id, sharePct: 60 } });
  const staff = await prisma.user.create({ data: { email: 'ops@demo.sportsiq.in', name: 'Arjun Nair', role: 'LEAGUE_STAFF', passwordHash: hash } });
  await prisma.leagueMember.create({ data: { leagueId: league.id, userId: staff.id, department: 'Operations', title: 'Head of Operations' } });

  const doneSteps = ['league-profile', 'league-logo', 'legal-entity', 'season-window', 'teams-structure', 'budget', 'create-teams', 'venue-booking', 'player-registration'];
  await prisma.leagueStepProgress.createMany({ data: doneSteps.map((stepKey) => ({ leagueId: league.id, stepKey, status: 'DONE' as const })) });
  await prisma.leagueStepProgress.createMany({ data: ['franchise-sale', 'sponsorship-inventory', 'brand-identity'].map((stepKey) => ({ leagueId: league.id, stepKey, status: 'IN_PROGRESS' as const })) });

  await prisma.budgetLine.createMany({ data: [
    ['Venue & Grounds', 1500000], ['Broadcast & Production', 2000000], ['Jerseys & Kits', 600000], ['Match Officials', 300000],
    ['Travel', 500000], ['Accommodation', 800000], ['Marketing & PR', 1000000], ['Prize Money & Trophies', 1200000], ['Ceremonies & Events', 700000],
  ].map(([category, planned]) => ({ leagueId: league.id, category: category as string, planned: planned as number })) });

  await prisma.sponsorshipOpportunity.createMany({ data: [
    { leagueId: league.id, title: 'Title Sponsor', tier: 'Title', price: 5000000, deliverables: ['League name rights: "<Brand> CLT10"', 'Logo on all jerseys (chest)', 'Trophy branding', 'All broadcast graphics', '20 social posts'] },
    { leagueId: league.id, title: 'Powered By Partner', tier: 'Powered By', price: 2500000, deliverables: ['"Powered by" lock-up with league logo', 'Jersey sleeve logo', 'LED exposure every match'] },
    { leagueId: league.id, title: 'Official Toss Partner', tier: 'On-ground', price: 600000, deliverables: ['Toss area branding', 'Toss coin branding', 'Broadcast toss graphic'] },
    { leagueId: league.id, title: 'Strategic Time-out Partner', tier: 'Broadcast', price: 800000, deliverables: ['Time-out graphic', 'Commentator mention'] },
    { leagueId: league.id, title: 'Official Digital Partner', tier: 'Digital', price: 400000, deliverables: ['10 Instagram reels', '5 YouTube shorts', 'Contest integration'] },
  ] });

  await prisma.expense.createMany({ data: [
    { leagueId: league.id, category: 'Venue & Grounds', description: 'Stadium advance booking', amount: 500000, status: 'PAID' },
    { leagueId: league.id, category: 'Marketing & PR', description: 'Launch campaign', amount: 250000, status: 'PENDING' },
    { leagueId: league.id, category: 'Jerseys & Kits', description: 'Design fee', amount: 80000, status: 'PAID' },
  ] });
  await prisma.income.createMany({ data: [
    { leagueId: league.id, source: 'Franchise Fee', description: 'Mumbai Mavericks — instalment 1', amount: 750000, status: 'PAID' },
    { leagueId: league.id, source: 'Player Registration Fee', description: 'Registrations batch 1', amount: 120000, status: 'PAID' },
  ] });

  // 4. Demo vendors across categories
  const cats = await prisma.vendorCategory.findMany();
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const demoVendors: Array<[string, string, string, Array<[string, string, number, number, string]>]> = [
    ['PixelCraft Studio', 'Mumbai', 'Sports logo & identity designers. 300+ team logos delivered.', [['logo-design', 'League logo design (3 concepts)', 15000, 40000, 'per project'], ['branding-agency', 'Complete brand identity kit', 60000, 150000, 'per project']]],
    ['SportsWear Pro', 'Ludhiana', 'Sublimation jerseys and full kits with 10-day turnaround.', [['jersey-printing', 'Sublimated cricket jersey', 450, 850, 'per piece'], ['jersey-design', 'Jersey design (home + away)', 10000, 25000, 'per team'], ['merchandise', 'Replica fan jerseys', 299, 499, 'per piece']]],
    ['Wankhede Grounds Mgmt', 'Mumbai', 'Turf grounds with floodlights and broadcast positions.', [['stadium-ground', 'Floodlit ground hire', 60000, 120000, 'per match'], ['practice-facility', 'Practice nets', 2000, 5000, 'per session']]],
    ['LiveCast Productions', 'Mumbai', '6–12 camera cricket production with replays and graphics.', [['broadcast-production', 'Multi-camera live production', 150000, 400000, 'per match'], ['ott-streaming', 'YouTube live stream setup', 25000, 50000, 'per match']]],
    ['Elite Umpires Panel', 'Pune', 'Panel of BCCI/state-level certified umpires and scorers.', [['umpires', 'On-field umpire', 3000, 8000, 'per match'], ['scorers', 'Official scorer', 1500, 3000, 'per match'], ['match-referee', 'Match referee', 5000, 10000, 'per match']]],
    ['Royal Trophies', 'Delhi', 'Custom trophies, medals and mementos.', [['trophy-medals', 'Championship trophy (custom)', 40000, 200000, 'per piece'], ['trophy-medals', 'Medals', 250, 800, 'per piece']]],
    ['Voice of Cricket — Anchors', 'Mumbai', 'Bilingual anchors for auctions, ceremonies and match MCs.', [['anchors-hosts', 'Event anchor', 25000, 100000, 'per event'], ['commentators', 'Hindi commentary', 10000, 30000, 'per match']]],
    ['SecureGuard Services', 'Mumbai', 'Licensed security & bouncers for sporting events.', [['security', 'Venue security guards', 1200, 2000, 'per guard per day'], ['security', 'Bouncers', 2500, 4000, 'per person per day']]],
    ['LexSport Legal', 'Bengaluru', 'Sports law firm — franchise, player and sponsor agreements.', [['sports-lawyer', 'Franchise agreement drafting', 50000, 150000, 'lump sum'], ['ip-trademark-lawyer', 'Trademark filing', 15000, 30000, 'per mark']]],
    ['Grand Stay Hotels', 'Mumbai', 'Business hotel with team floors and banquet.', [['hotels', 'Team rooms (twin sharing)', 4500, 7000, 'per room per night'], ['event-venue', 'Auction ballroom', 150000, 300000, 'per event']]],
    ['SkyTravel Sports', 'Delhi', 'Group travel specialists for sports teams.', [['travel-agency', 'Group flight booking', 0, 0, 'service fee on quote'], ['ground-transport', 'Team bus (45 seater)', 9000, 15000, 'per day']]],
    ['Brandwall Fabricators', 'Mumbai', 'Boundary boards, backdrops and podiums.', [['fabrication-branding', 'Boundary boards', 1200, 2500, 'per board'], ['fabrication-branding', 'Stage backdrop', 30000, 80000, 'per piece']]],
    ['Bidmaster Auctions', 'Mumbai', 'Professional sports auctioneers.', [['auctioneer', 'Player auction host', 75000, 250000, 'per auction']]],
    ['CareFirst Ambulance', 'Mumbai', 'ALS ambulances with paramedics on standby.', [['medical', 'Ambulance on standby', 6000, 12000, 'per match'], ['fitness-physio', 'Physiotherapist', 3000, 6000, 'per day']]],
  ];
  for (const [i, [companyName, city, description, services]] of demoVendors.entries()) {
    await prisma.user.create({
      data: {
        email: `vendor${i + 1}@demo.sportsiq.in`, name: companyName, role: 'VENDOR', passwordHash: hash, subscriptions: trial('VENDOR', 1500),
        vendorProfile: {
          create: {
            companyName, city, description, serviceAreas: [city, 'Pan India'], verified: i % 3 !== 2, rating: 3.8 + ((i * 7) % 12) / 10, reviewCount: 5 + i * 3, yearsInBusiness: 3 + (i % 9),
            services: { create: services.map(([slug, title, priceMin, priceMax, unit]) => ({ categoryId: bySlug.get(slug)!.id, title, priceMin: priceMin || null, priceMax: priceMax || null, unit })) },
          },
        },
      },
    });
  }

  // 5. Demo sponsors
  const sponsors: Array<[string, string, string, number, number]> = [
    ['FreshBrew Beverages', 'FMCG', 'Mumbai', 500000, 5000000],
    ['ZipPay Fintech', 'Fintech', 'Bengaluru', 300000, 3000000],
    ['Velocity Motors', 'Automobile', 'Pune', 1000000, 10000000],
    ['ByteLearn EdTech', 'Education', 'Delhi', 200000, 1500000],
  ];
  for (const [i, [companyName, industry, city, budgetMin, budgetMax]] of sponsors.entries()) {
    await prisma.user.create({ data: { email: `sponsor${i + 1}@demo.sportsiq.in`, name: companyName, role: 'SPONSOR', passwordHash: hash, subscriptions: trial('SPONSOR', 2500), sponsorProfile: { create: { companyName, industry, city, budgetMin, budgetMax, description: `${companyName} is looking for cricket partnerships to reach young urban audiences.` } } } });
  }

  // 6. Demo players
  const roles = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'];
  const first = ['Aman', 'Rohit', 'Karan', 'Vikram', 'Sahil', 'Nikhil', 'Yash', 'Dev', 'Ishaan', 'Kabir', 'Manav', 'Tanmay'];
  for (const [i, n] of first.entries()) {
    const u = await prisma.user.create({ data: { email: `player${i + 1}@demo.sportsiq.in`, name: `${n} ${['Patil', 'Kulkarni', 'Singh', 'Rao'][i % 4]}`, role: 'PLAYER', passwordHash: hash, playerProfile: { create: { city: 'Mumbai', playingRole: roles[i % 4], battingStyle: i % 3 ? 'Right-hand bat' : 'Left-hand bat', bowlingStyle: i % 2 ? 'Right-arm medium' : 'Right-arm off-spin', matches: 10 + i * 4, runs: 200 + i * 87, wickets: (i * 5) % 40 } } }, include: { playerProfile: true } });
    await prisma.playerRegistration.create({ data: { leagueId: league.id, playerId: u.playerProfile!.id, status: i < 4 ? 'SHORTLISTED' : 'APPLIED', category: i < 2 ? 'Icon' : i < 6 ? 'A' : 'B', basePrice: i < 2 ? 500000 : i < 6 ? 200000 : 50000 } });
  }

  await prisma.notification.create({ data: { userId: owner.id, title: 'Welcome to SportsIQ', body: 'Your league CLT10 is set up. Continue with the execution playbook.', link: `/leagues/${league.id}/playbook`, type: 'success' } });
  console.log(`Demo data created. Demo password for all demo users: ${DEMO_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
