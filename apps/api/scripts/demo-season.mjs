/**
 * Demo season: drives the running API end-to-end to populate a realistic league state.
 * Usage: API on :4000, demo seed loaded →  node scripts/demo-season.mjs
 * Doubles as an integration test (throws on any failed request / assertion).
 */
const B = process.env.API ?? 'http://localhost:4000/api';
const req = async (path, body, token, method) => {
  const r = await fetch(B + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method ?? (body ? 'POST' : 'GET')} ${path} → ${r.status} ${JSON.stringify(d)}`);
  return d;
};
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); };
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const login = async (email, password = 'Demo@1234') => (await req('/auth/login', { email, password })).token;

const T = await login('owner@demo.sportsiq.in');
const L = (await req('/leagues', null, T)).find((l) => l.slug === 'clt10');
const P = `/leagues/${L.id}`;
const teams = await req(`${P}/teams`, null, T);

// ---- Players: register more players so squads are realistic ----
const first = ['Arjun', 'Rohan', 'Siddharth', 'Kunal', 'Aditya', 'Varun', 'Harsh', 'Neel', 'Pranav', 'Om', 'Tejas', 'Ayaan', 'Rudra', 'Vivaan', 'Krish', 'Reyansh', 'Shaurya', 'Atharv', 'Parth', 'Dhruv', 'Ansh', 'Kabir', 'Laksh', 'Mihir', 'Nakul', 'Ojas', 'Pratham', 'Rishi', 'Samar', 'Tanish', 'Utkarsh', 'Veer', 'Yuvraj', 'Zaid', 'Aarush', 'Bhavya'];
const last = ['Shah', 'Iyer', 'Desai', 'Joshi', 'Naik', 'Pawar', 'Menon', 'Gupta', 'Kapoor', 'Reddy', 'Bose', 'Malhotra'];
const roles = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'];
for (let i = 0; i < first.length; i++) {
  const email = `p${i + 100}@demo.sportsiq.in`;
  let tok;
  try { tok = (await req('/auth/register', { name: `${first[i]} ${last[i % last.length]}`, email, password: 'Demo@1234', role: 'PLAYER', city: 'Mumbai', playingRole: roles[i % 4], acceptTerms: true })).token; }
  catch { tok = await login(email); }
  await req(`/players/register/${L.id}`, {}, tok).catch(() => {});
}
const regs = await req(`${P}/registrations`, null, T);
for (const [i, g] of regs.entries()) {
  if (g.status === 'APPLIED') await req(`${P}/registrations/${g.id}`, { status: 'SHORTLISTED', category: i < 4 ? 'Icon' : i < 16 ? 'A' : 'B', basePrice: i < 4 ? 500000 : i < 16 ? 200000 : 50000 }, T, 'PATCH');
}
console.log('players in pool:', regs.length);

// ---- Trials ----
const trial = await req(`${P}/trials`, { title: 'Mumbai Trials — Batch 1', city: 'Mumbai', venue: 'Shivaji Park Nets', date: new Date(Date.now() + 3 * 864e5).toISOString(), capacity: 60 }, T);
await req(`${P}/trials/${trial.id}/entries`, { regIds: regs.slice(0, 14).map((g) => g.id) }, T);
const td = await req(`${P}/trials/${trial.id}`, null, T);
for (const [i, e] of td.entries.entries()) {
  if (i < 10) await req(`${P}/trials/${trial.id}/checkin`, { code: e.code }, T);
  if (i < 8) await req(`${P}/trials/${trial.id}/entries/${e.id}`, { batting: 5 + Math.floor(rnd() * 5), bowling: 4 + Math.floor(rnd() * 6), fielding: 5 + Math.floor(rnd() * 5), fitness: 6 + Math.floor(rnd() * 4), comments: 'Good temperament' }, T, 'PATCH');
}
console.log('trial entries:', td.entries.length);

// ---- Auction ----
await req(`${P}/auction`, { bidIncrement: 25000, timerSeconds: 30, minSquad: 4, maxSquad: 8 }, T, 'PATCH');
await req(`${P}/auction/status`, { status: 'LIVE' }, T);
let sold = 0;
for (let k = 0; k < 32; k++) {
  const s = await req(`${P}/auction/next`, {}, T);
  const bidders = [...s.teams].sort(() => rnd() - 0.5).filter((t) => t.squad < 8).slice(0, 2 + Math.floor(rnd() * 3));
  if (!bidders.length) break;
  const rounds = 1 + Math.floor(rnd() * 5);
  let last = null;
  for (let b = 0; b < rounds; b++) {
    const t = bidders[b % bidders.length];
    if (t.id === last) continue;
    try { await req(`${P}/auction/bid`, { teamId: t.id }, T); last = t.id; } catch { /* purse limit */ }
  }
  if (last) { await req(`${P}/auction/sell`, {}, T); sold++; } else await req(`${P}/auction/unsold`, {}, T);
}
// leave one player on the podium with a live bid for the demo
const live = await req(`${P}/auction/next`, {}, T).catch(() => null);
if (live?.current) await req(`${P}/auction/bid`, { teamId: live.teams[1].id }, T).catch(() => {});
console.log('auction sold:', sold);

// ---- Venues + schedule ----
const v1 = await req(`${P}/venues`, { name: 'Wankhede Turf A', city: 'Mumbai', capacity: 8000 }, T);
const v2 = await req(`${P}/venues`, { name: 'Dadar Union Ground', city: 'Mumbai', capacity: 5000 }, T);
const start = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
const sch = await req(`${P}/schedule/generate`, { startDate: start, times: ['16:00', '20:00'], rounds: 1, restDays: 1, venueIds: [v1.id, v2.id], oversPerSide: 5, playoffs: 'IPL' }, T);
await req(`${P}/matches/publish`, {}, T);
const matches = await req(`${P}/matches`, null, T);
console.log('fixtures:', sch.created);

// ---- Score 3 matches fully + one live ----
async function playInnings(m, xiBat, xiBowl, upto) {
  let striker = xiBat[0], non = xiBat[1], next = 2, bowlerIdx = 0;
  let v;
  for (let ball = 0; ball < 200; ball++) {
    v = await req(`${P}/matches/${m.id}`, null, T);
    if (v.inningsOver || (upto && v.innings[v.currentInnings - 1].legalBalls >= upto)) return v;
    const n = v.next;
    striker = n.striker ?? (n.nonStriker === xiBat[next - 1] ? xiBat[next++] : xiBat[next++]);
    non = n.nonStriker ?? xiBat[next++];
    if (!n.striker && !n.nonStriker) { striker = xiBat[0]; non = xiBat[1]; next = 2; }
    let bowler = n.bowler;
    if (!bowler) { bowlerIdx = (bowlerIdx + 1) % 5; bowler = xiBowl[10 - bowlerIdx]; if (bowler === n.lastOverBowler) bowler = xiBowl[10 - ((bowlerIdx + 1) % 5)]; }
    const x = rnd();
    const b = x < 0.06 ? { wicket: ['BOWLED', 'CAUGHT', 'LBW'][Math.floor(rnd() * 3)], fielder: xiBowl[Math.floor(rnd() * 11)] }
      : x < 0.1 ? { extraType: 'WD', extraRuns: 1 } : x < 0.3 ? { runs: 0 } : x < 0.6 ? { runs: 1 } : x < 0.72 ? { runs: 2 } : x < 0.88 ? { runs: 4 } : { runs: 6 };
    await req(`${P}/matches/${m.id}/balls`, { striker, nonStriker: non, bowler, runs: 0, ...b }, T);
  }
  return v;
}
const sq = async (teamId, prefix) => {
  const t = (await req(`${P}/teams`, null, T)).find((x) => x.id === teamId);
  const mine = t.players.map((p) => p.player.user.name);
  const fill = Array.from({ length: 11 - Math.min(11, mine.length) }, (_, i) => `${prefix} Player ${i + 1}`);
  return [...mine.slice(0, 11), ...fill];
};
const league = matches.filter((m) => m.stage === 'League');
for (const [i, m] of league.slice(0, 4).entries()) {
  const homeXI = await sq(m.homeTeamId, m.homeTeam.shortName ?? 'H');
  const awayXI = await sq(m.awayTeamId, m.awayTeam.shortName ?? 'A');
  await req(`${P}/matches/${m.id}/start`, { tossWinnerId: m.homeTeamId, tossDecision: i % 2 ? 'BOWL' : 'BAT', homeXI, awayXI, oversPerSide: 5 }, T);
  const v0 = await req(`${P}/matches/${m.id}`, null, T);
  const firstBat = v0.battingFirst === m.homeTeamId ? [homeXI, awayXI] : [awayXI, homeXI];
  if (i === 3) { await playInnings(m, firstBat[0], firstBat[1], 17); break; }
  await playInnings(m, firstBat[0], firstBat[1]);
  await req(`${P}/matches/${m.id}/innings/next`, {}, T);
  await playInnings(m, firstBat[1], firstBat[0]);
  const done = await req(`${P}/matches/${m.id}/complete`, {}, T);
  console.log(`match ${m.number}:`, done.resultText);
}
const st = await req(`${P}/standings`, null, T);
assert(st.rows[0].points >= 2, 'standings has a leader');

// ---- Hotels & travel ----
const h = await req(`${P}/logistics/hotels`, { name: 'Grand Stay Hotel, Andheri', city: 'Mumbai', address: 'JB Nagar, Andheri East', contact: '+91 22 4000 0000', checkIn: new Date(Date.now() - 5 * 864e5).toISOString(), checkOut: new Date(Date.now() + 20 * 864e5).toISOString() }, T);
for (const [i, t] of teams.slice(0, 4).entries()) {
  for (let r = 0; r < 3; r++) await req(`${P}/logistics/hotels/${h.id}/rooms`, { roomNo: `${3 + i}0${r + 1}`, roomType: 'Twin', teamId: t.id, group: t.name, occupants: [`${t.shortName} Player ${r * 2 + 1}`, `${t.shortName} Player ${r * 2 + 2}`] }, T);
}
await req(`${P}/logistics/hotels/${h.id}/rooms`, { roomNo: '701', roomType: 'Single', group: 'Match Officials', occupants: ['Umpire R. Kulkarni'] }, T);
for (const [i, t] of teams.slice(0, 3).entries()) {
  await req(`${P}/logistics/travel`, { mode: 'FLIGHT', teamId: t.id, travellers: Array.from({ length: 14 }, (_, k) => `${t.shortName} member ${k + 1}`), fromPlace: ['Delhi', 'Bengaluru', 'Pune'][i], toPlace: 'Mumbai', departAt: new Date(Date.now() - 4 * 864e5 + i * 36e5).toISOString(), arriveAt: new Date(Date.now() - 4 * 864e5 + (i + 2) * 36e5).toISOString(), carrier: ['6E 2134', 'AI 865', 'UK 941'][i], reference: ['PNR8XK2L', 'PNR7QW1Z', 'PNR3MN4P'][i], status: 'BOOKED', cost: 168000 }, T);
}

// ---- Ticketing ----
const cats = [];
for (const [name, price, qty] of [['General Stand', 199, 4000], ['Pavilion', 499, 1500], ['VIP Box', 2499, 120]]) cats.push(await req(`${P}/tickets/categories`, { name, price, quantity: qty }, T));
for (let k = 0; k < 12; k++) {
  const c = cats[k % 3];
  const pay = await req('/public/tickets/order', { categoryId: c.id, qty: 1 + (k % 4), buyerName: `Fan ${k + 1}`, email: `fan${k + 1}@example.com`, phone: '9800000000' });
  const v = await req('/payments/verify', { paymentId: pay.paymentId });
  if (k < 5) await req(`${P}/tickets/checkin`, { code: v.ticketCode }, T);
}

// ---- Accreditation ----
await req(`${P}/accreditation`, null, T);
for (const s of ['MANAGEMENT', 'SQUADS', 'TEAM_OWNERS']) await req(`${P}/accreditation/bulk`, { source: s }, T);
const ac = await req(`${P}/accreditation`, null, T);
const face = (name, hue) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><rect width="120" height="150" fill="hsl(${hue},45%,88%)"/><circle cx="60" cy="58" r="28" fill="hsl(${hue},30%,55%)"/><path d="M14 150c4-34 24-50 46-50s42 16 46 50z" fill="hsl(${hue},30%,45%)"/><text x="60" y="64" font-family="Arial" font-weight="700" font-size="20" fill="#fff" text-anchor="middle">${name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</text></svg>`).toString('base64');
const ids = [];
for (const [i, a] of ac.accreditations.slice(0, 18).entries()) {
  await req(`${P}/accreditation/${a.id}`, { photoUrl: face(a.name, (i * 47) % 360), idType: 'Aadhaar', idNumber: `1234 5678 ${String(1000 + i)}`, idVerified: true, validFrom: new Date(Date.now() - 864e5).toISOString().slice(0, 10) }, T, 'PATCH');
  ids.push(a.id);
}
let w = await req(`${P}/accreditation/workflow`, { ids, action: 'APPROVE' }, T);
assert(w.done === ids.length, 'all approvable');
await req(`${P}/accreditation/workflow`, { ids: ids.slice(0, 8), action: 'PRINTED' }, T);
await req(`${P}/accreditation/workflow`, { ids: ids.slice(0, 5), action: 'ISSUE' }, T);
// rules: unapproved without photo is blocked
w = await req(`${P}/accreditation/workflow`, { ids: [ac.accreditations.at(-1).id], action: 'APPROVE' }, T);
assert(w.skipped.length === 1, 'approval blocked without photo/ID');
const issued = (await req(`${P}/accreditation`, null, T)).accreditations.find((a) => a.id === ids[0]);
let g = await req(`${P}/accreditation/verify`, { payload: `${issued.code}.${issued.version}`, zone: issued.zones[0] }, T);
assert(g.allowed, 'issued card allowed in its zone: ' + g.reason);
g = await req(`${P}/accreditation/verify`, { payload: `${issued.code}.${issued.version}`, zone: '3' }, T);
assert(!g.allowed || issued.zones.includes('3'), 'zone restriction');
await req(`${P}/accreditation/workflow`, { ids: [ids[1]], action: 'REPRINT', reason: 'Lost card' }, T);
const lost = (await req(`${P}/accreditation`, null, T)).accreditations.find((a) => a.id === ids[1]);
g = await req(`${P}/accreditation/verify`, { payload: `${lost.code}.1`, zone: lost.zones[0] }, T);
assert(!g.allowed && /Old card version/.test(g.reason), 'old version rejected after reprint');
// public self-application
const pubCats = await req(`/public/accreditation/${L.slug}`);
await req(`/public/accreditation/${L.slug}`, { categoryId: pubCats.categories[0].id, name: 'Meera Kulkarni', organisation: 'Mumbai Sports Daily', designation: 'Sports Reporter', email: 'meera@example.com', phone: '9876543210', photoUrl: face('Meera Kulkarni', 200), idType: 'Press card', idNumber: 'MSD-2026-0042', consent: true });
console.log('accreditation records:', (await req(`${P}/accreditation`, null, T)).summary);

// ---- Finance: vendors, GST/TDS, approvals, receivables ----
const fin = await req(`${P}/finance`, null, T);
const vByName = (n) => fin.vendors.find((v) => v.companyName === n)?.id;
const days = (n) => new Date(Date.now() + n * 864e5).toISOString();
const exp = [
  ['Venue & Grounds', 'Wankhede Turf A — 14 match days', 840000, 151200, 16800, 'Wankhede Grounds Mgmt', 'PAID', 'WGM/26/118'],
  ['Broadcast & Production', 'Live production — league stage', 1650000, 297000, 33000, 'LiveCast Productions', 'PARTIAL', 'LCP-2231'],
  ['Jerseys & Kits', 'Sublimated kits — 8 teams × 25 sets', 136000, 6800, 0, 'SportsWear Pro', 'PAID', 'SWP/INV/882'],
  ['Match Officials', 'Umpires & scorers — first 10 matches', 160000, 0, 16000, 'Elite Umpires Panel', 'PENDING', 'EUP-41'],
  ['Accommodation', 'Team hotel block — 120 room nights', 648000, 77760, 0, 'Grand Stay Hotels', 'PENDING', 'GSH/3381'],
  ['Prize Money & Trophies', 'Championship & runner-up trophies', 145000, 26100, 0, 'Royal Trophies', 'PAID', 'RT-0921'],
  ['Security & Medical', 'Ambulance standby — 16 matches', 128000, 0, 0, 'CareFirst Ambulance', 'PENDING', 'CF-771'],
  ['Marketing & PR', 'Digital campaign — launch month', 380000, 68400, 7600, null, 'PAID', 'DG/2026/14'],
];
for (const [category, description, amount, gstAmount, tdsAmount, vendor, status, invoiceNo] of exp)
  await req(`${P}/finance/expenses`, { category, description, amount, gstAmount, tdsAmount, vendorId: vendor ? vByName(vendor) : null, payee: vendor ? null : 'Pixel Growth Media', status, invoiceNo, paymentMode: status === 'PAID' ? 'Bank transfer' : null, date: days(-Math.floor(rnd() * 40)) }, T);
const inc = [
  ['Franchise Fee', 'Pune Panthers — instalment 1', 750000, 135000, 'PAID', 'Pune Panthers Sports LLP', -30],
  ['Franchise Fee', 'Thane Titans — instalment 1', 750000, 135000, 'PENDING', 'Thane Titans Pvt Ltd', -5],
  ['Sponsorship', 'Official Toss Partner — FreshBrew', 600000, 108000, 'PARTIAL', 'FreshBrew Beverages', 10],
  ['Broadcast Rights', 'Streaming rights — league stage', 900000, 162000, 'PENDING', 'StreamPlay OTT', 20],
];
for (const [source, description, amount, gstAmount, status, party, due] of inc)
  await req(`${P}/finance/incomes`, { source, description, amount, gstAmount, status, party, invoiceNo: `CLT/${Math.floor(rnd() * 900 + 100)}`, dueDate: days(due) }, T);
await req(`${P}/finance/settings`, { expenseApprovalLimit: 50000 }, T, 'PATCH');
const OPS = await login('ops@demo.sportsiq.in');
const pend = await req(`${P}/finance/expenses`, { category: 'Equipment', description: 'LED stumps hire — playoffs', amount: 185000, gstAmount: 33300, payee: 'StumpCam Rentals', status: 'PENDING' }, OPS);
assert(pend.approval === 'PENDING_APPROVAL', 'staff expense above limit needs approval');
await req(`${P}/finance/expenses`, { category: 'Food & Hospitality', description: 'Match-day water & snacks', amount: 18000, payee: 'Local caterer', status: 'PAID' }, OPS);
const f2 = await req(`${P}/finance`, null, T);
console.log('P&L:', f2.pnl.income, f2.pnl.expense, f2.pnl.profit, 'pending approval', f2.pnl.pendingApprovalCount, 'GST net', f2.pnl.gst.net);

// ---- Talent marketplace enquiries ----
const SP = await login('sponsor1@demo.sportsiq.in');
const talents = await req('/talent?purpose=ENDORSEMENT', null, SP);
await req(`/talent/${talents[0].id}/enquiries`, { purpose: 'ENDORSEMENT', organisation: 'FreshBrew Beverages', budget: 2500000, dates: 'Feb–Mar 2027', message: 'TV + digital campaign for our new energy drink: 2 shoot days, 6 social posts, 12-month usage in India.' }, SP);
const legends = await req('/talent?purpose=LEAGUE&status=RETIRED', null, T);
assert(legends.length >= 2, 'legends available for leagues');
await req(`/talent/${legends[0].id}/enquiries`, { purpose: 'LEAGUE', leagueId: L.id, budget: 1200000, dates: 'Jan 2027 season', message: 'We would like to sign you as the icon player and mentor for CLT10 Season 1.' }, T);

// ---- Procurement: RFQ → quotes → award → proof → approve → review ----
const jerseyVendors = await req('/vendors?category=jersey-printing', null, T);
const allVendors = await req('/vendors', null, T);
const brandwall = allVendors.find((v) => v.companyName === 'Brandwall Fabricators');
const rfq = await req(`${P}/procurement/rfqs`, { title: 'Match kits — 8 teams', categorySlug: 'jersey-printing', specs: 'Sublimated jerseys and trousers, 180 GSM, 8 teams × 25 sets, sizes S–XXL, name & number printed, sponsor logos as per placement map.', quantity: '200 sets', location: 'Mumbai', neededBy: days(20), budgetMax: 400000, vendorIds: [...jerseyVendors.map((v) => v.id), brandwall.id] }, T);
const V2 = await login('vendor2@demo.sportsiq.in'); // SportsWear Pro
const V12 = await login('vendor12@demo.sportsiq.in'); // Brandwall Fabricators
await req(`/vendor-portal/rfqs/${rfq.id}/quote`, { amount: 340000, gstAmount: 17000, timeline: 'Sample in 4 days, bulk in 12 days', terms: '40% advance, balance on delivery' }, V2);
await req(`/vendor-portal/rfqs/${rfq.id}/quote`, { amount: 395000, gstAmount: 19750, timeline: 'Bulk in 15 days', terms: '50% advance' }, V12);
const cmp = await req(`${P}/procurement/rfqs/${rfq.id}`, null, T);
assert(cmp.quotes.find((q) => q.isLowest).vendor.companyName === 'SportsWear Pro', 'lowest quote flagged');
const award = await req(`${P}/procurement/quotes/${cmp.quotes.find((q) => q.isLowest).id}/award`, { createContract: true, createExpense: true, expenseCategory: 'Jerseys & Kits', contactPerson: 'Arjun Nair (Ops)' }, T);
assert(award.contractId && award.expenseId, 'award creates contract draft and expense');
await req(`/vendor-portal/work-orders/${award.workOrderId}/updates`, { kind: 'START', body: 'Fabric ordered, sampling started' }, V2);
await req(`/vendor-portal/work-orders/${award.workOrderId}/updates`, { kind: 'PROOF', body: 'Sample jersey for Mumbai Mavericks', attachments: [face('Sample Kit', 210)] }, V2);
await req(`${P}/procurement/work-orders/${award.workOrderId}/updates`, { kind: 'REVISION', body: 'Please move the sponsor logo 2 cm higher on the chest.' }, T);
await req(`/vendor-portal/work-orders/${award.workOrderId}/updates`, { kind: 'SUBMIT', body: 'Revised sample + bulk production photos' }, V2);
await req(`${P}/procurement/work-orders/${award.workOrderId}/updates`, { kind: 'APPROVE' }, T);
await req(`${P}/procurement/work-orders/${award.workOrderId}/review`, { quality: 5, onTime: 4, value: 5, comment: 'Great print quality, quick turnaround on revisions.' }, T);
const sw = (await req('/vendors?category=jersey-printing', null, T)).find((v) => v.companyName === 'SportsWear Pro');
assert(sw.reviewCount >= 1, 'vendor rating updated from review');
// a second RFQ left open with quotes for the demo
const rfq2 = await req(`${P}/procurement/rfqs`, { title: 'Ambulance standby — playoffs', categorySlug: 'medical', specs: 'ALS ambulance with paramedic at the venue for 4 playoff matches, 4 hours each.', quantity: '4 match days', location: 'Wankhede Turf A', neededBy: days(30), inviteAllInCategory: true }, T);
await req(`/vendor-portal/rfqs/${rfq2.id}/quote`, { amount: 36000, gstAmount: 0, timeline: 'Available on all 4 dates', terms: 'Payment after each match' }, await login('vendor14@demo.sportsiq.in'));
console.log('procurement: RFQ awarded, work order completed, vendor rated', sw.rating);

// ---- Jersey studio: team owner designs → league approves → printers quote → milestones ----
const TO = await login('teamowner@demo.sportsiq.in');
const js = await req(`${P}/jerseys`, null, TO);
const myTeam = js.teams[0];
const squadNames = (await req(`${P}/teams`, null, TO))[0].players.map((pl) => pl.player.user.name);
const design = await req(`${P}/jerseys`, { teamId: myTeam.id, name: `${myTeam.name} — Home kit`, kit: 'HOME', template: 'sash', colors: { body: '#0b3d91', sleeves: '#0a2f6e', collar: '#f59e0b', accent: '#f59e0b', text: '#ffffff' }, sponsors: [{ slot: 'FRONT_CHEST', name: 'FreshBrew' }, { slot: 'SLEEVE_LEFT', name: 'ZipPay' }], sampleName: 'PATIL', sampleNumber: '18', roster: squadNames.map((n, i) => ({ name: n.split(' ').slice(-1)[0].toUpperCase(), number: String(i + 1), size: ['M', 'L', 'XL'][i % 3] })), extraSizes: { M: 2, L: 2 } }, TO);
const bad = await req(`${P}/jerseys/${design.id}`, { sponsors: [{ slot: 'CHEST_RIGHT', name: 'Rogue' }] }, TO, 'PATCH');
let blocked = false;
try { await req(`${P}/jerseys/${design.id}/submit`, {}, TO); } catch { blocked = true; }
assert(blocked, 'sponsor on the reserved league-logo position is blocked');
await req(`${P}/jerseys/${design.id}`, { sponsors: [{ slot: 'FRONT_CHEST', name: 'FreshBrew' }, { slot: 'SLEEVE_LEFT', name: 'ZipPay' }] }, TO, 'PATCH');
await req(`${P}/jerseys/${design.id}/submit`, {}, TO);
await req(`${P}/jerseys/${design.id}/review`, { decision: 'APPROVE', note: 'Approved — keep sponsor logos in white.' }, T);
const sent = await req(`${P}/jerseys/${design.id}/send-to-vendors`, { inviteAll: true, specs: 'Approved home kit — see attached production files and roster.', neededBy: days(18), files: [] }, T);
await req(`/vendor-portal/rfqs/${sent.rfqId}/quote`, { amount: 52000, gstAmount: 2600, timeline: 'Sample 3 days, bulk 10 days' }, V2);
const jq = (await req(`${P}/procurement/rfqs/${sent.rfqId}`, null, T)).quotes[0];
const jwo = await req(`${P}/procurement/quotes/${jq.id}/award`, { createContract: false, createExpense: true, expenseCategory: 'Jerseys & Kits' }, T);
await req(`/vendor-portal/work-orders/${jwo.workOrderId}/milestones/0`, { note: 'Sample couriered' }, V2);
await req(`${P}/procurement/work-orders/${jwo.workOrderId}/milestones/1`, {}, T);
await req(`/vendor-portal/work-orders/${jwo.workOrderId}/milestones/2`, {}, V2);
console.log('jersey: design approved, printer awarded, sample approved, bulk production underway');
void bad;

// ---- Sponsor CRM: marketplace enquiry → deal → won → deliverables with proof ----
const SP2 = await login('sponsor2@demo.sportsiq.in');
const mk = await req('/sponsors/marketplace', null, SP2);
const powered = mk.find((l) => l.id === L.id).opportunities.find((o) => o.title === 'Powered By Partner');
await req(`/sponsors/opportunities/${powered.id}/interest`, { message: 'ZipPay is interested in the Powered By package for CLT10. Please share audience numbers.' }, SP2);
const crm0 = await req(`${P}/crm`, null, T);
assert(crm0.deals.some((x) => x.source === 'MARKETPLACE'), 'marketplace enquiries become CRM deals');
const titleOpp = crm0.opportunities.find((o) => o.title === 'Title Sponsor');
const deal = await req(`${P}/crm/deals`, { company: 'Velocity Motors', contactName: 'Neha Sharma', email: 'neha@example.com', opportunityId: titleOpp.id, stage: 'CONTACTED', expectedClose: days(15) }, T);
await req(`${P}/crm/deals/${deal.id}/activities`, { kind: 'MEETING', body: 'Met marketing head; wants naming rights + jersey front. Sending deck.' }, T);
await req(`${P}/crm/deals/${deal.id}/documents`, { kind: 'DECK' }, T);
await req(`${P}/crm/deals/${deal.id}`, { stage: 'PROPOSAL' }, T, 'PATCH');
await req(`${P}/crm/deals/${deal.id}`, { stage: 'NEGOTIATION' }, T, 'PATCH');
await req(`${P}/crm/deals/${deal.id}/documents`, { kind: 'CONTRACT' }, T);
const wonDeal = await req(`${P}/crm/deals/${deal.id}/win`, { value: 4800000, addReceivable: true, dueDate: days(30) }, T);
assert(wonDeal.deliverables.length >= 5, 'deliverables created from the package');
const dv = wonDeal.deliverables.find((x) => /social posts/.test(x.title)) ?? wonDeal.deliverables[0];
let noProof = false;
try { await req(`${P}/crm/deliverables/${dv.id}`, { delivered: dv.quantity }, T, 'PATCH'); } catch { noProof = true; }
assert(noProof, 'deliverable cannot be completed without proof');
await req(`${P}/crm/deliverables/${dv.id}`, { delivered: Math.min(dv.quantity, 6), addProofs: [face('Post proof', 30)] }, T, 'PATCH');
const jer = wonDeal.deliverables.find((x) => x.channel === 'JERSEY');
if (jer) await req(`${P}/crm/deliverables/${jer.id}`, { delivered: 1, addProofs: [face('Jersey proof', 60)] }, T, 'PATCH');
// a lost deal for realistic win rate
const lostDeal = await req(`${P}/crm/deals`, { company: 'ByteLearn EdTech', opportunityId: crm0.opportunities.find((o) => o.title === 'Official Digital Partner').id, stage: 'PROPOSAL' }, T);
await req(`${P}/crm/deals/${lostDeal.id}`, { stage: 'LOST', lostReason: 'Budget' }, T, 'PATCH');
const crm1 = await req(`${P}/crm`, null, T);
console.log('crm: pipeline', crm1.summary.pipeline, 'won', crm1.summary.won, 'win rate', crm1.summary.winRate + '%');
console.log('DEMO SEASON OK');
