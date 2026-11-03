import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BarChart3, Bell, BookOpenCheck, Gavel, IdCard, Plane, Radio, Star, Ticket, Building2, Check, ChevronDown, CircleDollarSign, FileSignature, Handshake, LayoutDashboard,
  Megaphone, Menu, MessageSquare, Presentation, ShieldCheck, Sparkles, Store, Trophy, User, Users, X,
} from 'lucide-react';
import { Logo, Monogram } from '../components/Logo';
import { cx } from '../components/ui';

const SHOTS = [
  { key: 'dashboard', label: 'League dashboard', img: '/screenshots/dashboard.jpg', text: 'League readiness, phase progress, teams, players, sponsorship and live P&L at a glance.' },
  { key: 'playbook', label: 'Execution playbook', img: '/screenshots/playbook.jpg', text: '13 phases and 66 steps — every step links to the right module, AI tool or vendor.' },
  { key: 'vendors', label: 'Vendor search', img: '/screenshots/vendor-split.jpg', text: 'Click “Find vendors” on any step: menu, dashboard and vendor list side by side.' },
  { key: 'auction', label: 'Live auction', img: '/screenshots/auction.jpg', text: 'Real-time player auction with purses, timers, squad rules and team-owner bidding.' },
  { key: 'scoring', label: 'Ball-by-ball scoring', img: '/screenshots/scoring.jpg', text: 'Scorer console with undo, live scorecards, points table, NRR and a public match centre.' },
  { key: 'accreditation', label: 'Accreditation', img: '/screenshots/accreditation.jpg', text: 'Zones, categories, photo & ID checks, CR80 card design, batch printing and gate verification.' },
  { key: 'finance', label: 'Finance & P&L', img: '/screenshots/finance.jpg', text: 'Every expense and income with GST/TDS, approvals, budget vs actual and a live P&L.' },
  { key: 'reports', label: 'Reports', img: '/screenshots/reports.jpg', text: '31 ready-made reports — download any of them as Excel, PDF or CSV.' },
  { key: 'talent', label: 'Cricketers & legends', img: '/screenshots/talent-legends.jpg', text: 'Sign retired legends for your league or approach cricketers for brand endorsements through their agents.' },
  { key: 'sponsors', label: 'Sponsor marketplace', img: '/screenshots/sponsor-marketplace.jpg', text: 'Sponsors browse upcoming leagues, readiness and open packages — and contact owners directly.' },
];

const FEATURES = [
  { icon: Gavel, title: 'Live Player Auction', text: 'Real-time bidding with purses, timers, squad limits and team-owner bidding from their own login.' },
  { icon: Radio, title: 'Scoring & Match Centre', text: 'Ball-by-ball scoring, auto points table with NRR, auto fixture scheduler and a public live match centre.' },
  { icon: IdCard, title: 'Accreditation', text: 'Zones, categories, photo & ID checks, CR80 card printing, revoke/reprint and QR gate verification.' },
  { icon: Ticket, title: 'Ticketing & Payments', text: 'Sell QR e-tickets online with Razorpay, run the box office and scan entries at the gate.' },
  { icon: Plane, title: 'Trials, Travel & Hotels', text: 'Trial batches with QR passes and scout scores, rooming lists, flights and team itineraries.' },
  { icon: BarChart3, title: 'Reports in Every Format', text: '31 reports across finance, cricket, commercial and operations — Excel, PDF or CSV.' },
  { icon: Star, title: 'Cricketers & Legends', text: 'Agencies list the players they represent. Brands sign endorsements; leagues sign legends.' },
  { icon: BookOpenCheck, title: 'Guided Execution Playbook', text: 'From league name and logo to closing ceremony — a proven step-by-step path with a live league progress bar.' },
  { icon: Store, title: 'Vendor Marketplace', text: '70+ categories: stadiums, umpires, scorers, anchors, production, jersey printers, trophy makers, lawyers, hotels and more.' },
  { icon: Megaphone, title: 'Sponsorship Marketplace', text: 'Create sponsorship inventory with pricing and deliverables. Sponsors discover your league and message you.' },
  { icon: CircleDollarSign, title: 'Finance, Budget & P&L', text: 'Category-wise expenses, income, budget overshoot alerts, receivables, payables and an exportable P&L.' },
  { icon: Users, title: 'Teams, Owners & Players', text: 'Teams with owners and co-owners, player registration, shortlisting, categories, base prices and squads.' },
  { icon: Presentation, title: 'Deck Studio', text: 'Edit SportsIQ sample decks filled with your data — or hire a deck designer from the marketplace.' },
  { icon: FileSignature, title: 'Contract Templates', text: 'Editable franchise, player, sponsor, vendor and venue templates — always to be verified by your lawyer.' },
  { icon: Sparkles, title: 'AI Logo Studio', text: 'No logo yet? Generate crest concepts instantly, then refine with a professional designer.' },
  { icon: MessageSquare, title: 'Messaging & Notifications', text: 'Talk to vendors, sponsors and owners in one inbox. Alerts for budgets, registrations and milestones.' },
];

const ROLES = [
  { icon: Star, title: 'Agencies & Managers', text: 'List the cricketers and legends you represent.', role: 'TALENT_AGENT' },
  { icon: Trophy, title: 'League Owners', text: 'Run the whole league from one workspace.', role: 'LEAGUE_OWNER' },
  { icon: Users, title: 'Management Team', text: 'Ops, finance, marketing & legal — added by the owner.', role: null },
  { icon: ShieldCheck, title: 'Team Owners', text: 'Follow your team, squad, purse and updates.', role: null },
  { icon: User, title: 'Players', text: 'Build a profile and register for leagues.', role: 'PLAYER' },
  { icon: Building2, title: 'Vendors', text: 'List services and prices, get enquiries.', role: 'VENDOR' },
  { icon: Handshake, title: 'Sponsors', text: 'Discover leagues and open sponsorship packages.', role: 'SPONSOR' },
];

const PLANS = [
  { name: 'League Owner', price: '₹5,000', period: 'per league season', role: 'LEAGUE_OWNER', highlight: true, items: ['Full execution playbook & progress bar', 'Unlimited teams, owners & management users', 'Vendor & sponsor marketplace access', 'Finance, budget & P&L', 'Deck Studio & contract templates', 'AI logo studio'] },
  { name: 'Team Owner', price: '₹2,000', period: 'per season', role: null, items: ['Team portal & squad view', 'Purse & auction tracking', 'Notifications & messaging', 'Added by your league'] },
  { name: 'Vendor', price: '₹1,500', period: 'per year', role: 'VENDOR', items: ['Business profile & unlimited services', 'Listed in 70+ categories', 'Direct enquiries from leagues', 'Verified badge'] },
  { name: 'Sponsor', price: '₹2,500', period: 'per year', role: 'SPONSOR', items: ['Browse every public league', 'See readiness & open packages', 'Message league owners', 'Company profile'] },
  { name: 'Agency / Manager', price: '₹2,500', period: 'per year', role: 'TALENT_AGENT', items: ['List active players & legends', 'Endorsement & league enquiries', 'Verified agency badge'] },
  { name: 'Player', price: 'Free', period: 'forever', role: 'PLAYER', items: ['Player profile & stats', 'Register for open leagues', 'Trial passes & selection alerts'] },
];

const PHASES = ['Foundation & identity', 'Strategy & budget', 'Venue & infrastructure', 'Teams & franchises', 'Players, trials & auction', 'Officials & cricket ops', 'Fixtures', 'Sponsorship & broadcast', 'Jerseys, kits & branding', 'Travel & logistics', 'Marketing & ceremonies', 'Tournament execution', 'Closing & post-season'];

const VENDOR_CLOUD = ['Stadiums & Grounds', 'Umpires', 'Match Referees', 'Scorers', 'Anchors & Hosts', 'Commentators', 'Broadcast Production', 'Live Streaming', 'Logo Designers', 'Jersey Printers', 'Trophy Makers', 'Sports Lawyers', 'Chartered Accountants', 'Hotels', 'Travel Agents', 'Team Buses', 'Caterers', 'Security', 'Ambulance & Medical', 'LED Screens', 'Fabrication', 'Event Management', 'Auctioneers', 'Photographers', 'Digital Agencies', 'PR Agencies', 'Ticketing', 'Insurance', 'Fireworks', 'Merchandise'];

const ROADMAP = ['Email, SMS & WhatsApp alerts', 'E-sign integrations', 'Broadcast graphics feed', 'Fan app & fantasy partners', 'Mobile apps', 'Football, kabaddi & more sports'];

const FAQ = [
  ['Who is SportsIQ for?', 'Anyone running a league — corporate, community, state-level or professional — plus the team owners, players, vendors and sponsors around it.'],
  ['Do I need technical knowledge?', 'No. Create your league and SportsIQ guides you step by step, telling you what to do next and connecting you with the right vendors.'],
  ['Are the contract templates legal advice?', 'No. They are generic, editable starting points. Every agreement must be reviewed and verified by a qualified lawyer before use — you can find sports lawyers in the vendor marketplace.'],
  ['Can brands sign cricketers for endorsements here?', 'Yes. Agencies and managers list the players they are authorised to represent. Brands and leagues send enquiries to the agent; agreements are made directly between them.'],
  ['Which sports are supported?', 'Cricket today. More sports are on the roadmap.'],
  ['Is there a free trial?', 'Yes — every paid plan starts with a 14-day free trial, no card required.'],
];

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
      <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-ink-400">app.sportsiq.in</span>
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}

export default function Landing() {
  const [shot, setShot] = useState(SHOTS[0].key);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const active = SHOTS.find((s) => s.key === shot)!;
  const nav = [['Features', '#features'], ['Product', '#product'], ['Vendors', '#vendors'], ['Pricing', '#pricing'], ['FAQ', '#faq']];

  return (
    <div className="bg-white text-ink-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/"><Logo size={32} /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-700 md:flex">{nav.map(([l, h]) => <a key={h} href={h} className="hover:text-brand-700">{l}</a>)}</nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50">Log in</Link>
            <Link to="/register" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Start free trial</Link>
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menu && (
          <div className="space-y-1 border-t border-ink-100 px-4 py-3 md:hidden">
            {nav.map(([l, h]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink-50">{l}</a>)}
            <div className="flex gap-2 pt-2"><Link to="/login" className="flex-1 rounded-lg border border-ink-200 py-2 text-center text-sm font-semibold">Log in</Link><Link to="/register" className="flex-1 rounded-lg bg-brand-700 py-2 text-center text-sm font-semibold text-white">Start free</Link></div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-50 to-white" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm"><Monogram size={16} />The operating system for sports leagues</span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">Run your entire league <span className="text-brand-700">from idea to closing ceremony</span> — in one place.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-500">No Excel sheets. No WhatsApp chaos. SportsIQ guides you through every step, connects you with every vendor and sponsor you need, and tracks every rupee.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register?role=LEAGUE_OWNER" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-800">Create your league <ArrowRight className="h-4 w-4" /></Link>
            <a href="#product" className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-6 py-3 font-semibold text-ink-700 hover:bg-ink-50">See the product</a>
          </div>
          <p className="mt-3 text-xs text-ink-500">14-day free trial · No card required</p>
          <div className="mx-auto mt-14 max-w-6xl"><BrowserFrame src="/screenshots/dashboard.jpg" alt="SportsIQ league dashboard" /></div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-y border-ink-100 bg-ink-50/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4">
          {[['66', 'guided steps'], ['70+', 'vendor categories'], ['31', 'downloadable reports'], ['8', 'role-based portals']].map(([n, l]) => (
            <div key={l}><p className="text-4xl font-extrabold text-brand-700">{n}</p><p className="mt-1 text-sm font-medium text-ink-500">{l}</p></div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-700">One platform, every stakeholder</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Everyone in your league, connected</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.title} className="card flex gap-4 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><r.icon className="h-5 w-5" /></div>
              <div>
                <p className="font-bold">{r.title}</p>
                <p className="mt-1 text-sm text-ink-500">{r.text}</p>
                {r.role && <Link to={`/register?role=${r.role}`} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Register →</Link>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product screenshots */}
      <section id="product" className="bg-ink-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">See it in action</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Built for the way leagues actually run</h2>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {SHOTS.map((s) => <button key={s.key} onClick={() => setShot(s.key)} className={cx('rounded-full px-4 py-2 text-sm font-semibold transition', shot === s.key ? 'bg-brand-700 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:ring-brand-300')}>{s.label}</button>)}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-ink-500">{active.text}</p>
          <div className="mx-auto mt-8 max-w-6xl"><BrowserFrame src={active.img} alt={active.label} /></div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Features</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything a league needs. Nothing it doesn’t.</h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-6">
              <f.icon className="h-6 w-6 text-brand-700" />
              <p className="mt-4 font-bold">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gradient-to-br from-brand-800 to-brand-900 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-amber-300">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Tournament-grade operations, step by step</h2>
            <p className="mt-4 text-white/75">Our playbook follows how professional tournament operations teams plan and deliver events. Create your league and SportsIQ tells you exactly what to do next — and who can help.</p>
            <ol className="mt-8 space-y-4">
              {['Create your league — name, format, city, dates. Upload a logo or design one with AI.', 'Follow the playbook. Each step opens the right module or the split-screen vendor search.', 'Sell franchises and sponsorships. Owners and sponsors get their own portals.', 'Deliver the season and close the books with a live P&L.'].map((t, i) => (
                <li key={i} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-ink-900">{i + 1}</span><span className="pt-1 text-white/90">{t}</span></li>
              ))}
            </ol>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PHASES.map((p, i) => (
              <div key={p} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium ring-1 ring-white/10">
                <span className="text-xs font-bold text-amber-300">{String(i + 1).padStart(2, '0')}</span>{p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendors */}
      <section id="vendors" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Vendor marketplace</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Every service your league needs, one click away</h2>
            <p className="mt-4 text-ink-500">From the stadium to the trophy — compare vendors by city, price and rating, and message them without leaving your dashboard.</p>
            <div className="mt-6 flex flex-wrap gap-2">{VENDOR_CLOUD.map((v) => <span key={v} className="rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-700">{v}</span>)}<span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">+40 more</span></div>
            <Link to="/register?role=VENDOR" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"><BadgeCheck className="h-4 w-4" />List your business on SportsIQ</Link>
          </div>
          <BrowserFrame src="/screenshots/vendor-split.jpg" alt="Vendor search split screen" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-ink-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing for every role</h2>
            <p className="mt-3 text-ink-500">Prices exclude GST. Every paid plan starts with a 14-day free trial.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={cx('flex flex-col rounded-2xl border bg-white p-6', p.highlight ? 'border-brand-600 shadow-pop ring-4 ring-brand-100' : 'border-ink-200 shadow-card')}>
                {p.highlight && <span className="mb-3 self-start rounded-full bg-brand-700 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Most popular</span>}
                <p className="font-bold">{p.name}</p>
                <p className="mt-3 text-3xl font-extrabold">{p.price}</p>
                <p className="text-xs text-ink-500">{p.period}</p>
                <ul className="mt-5 flex-1 space-y-2">{p.items.map((i) => <li key={i} className="flex gap-2 text-sm text-ink-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{i}</li>)}</ul>
                {p.role ? (
                  <Link to={`/register?role=${p.role}`} className={cx('mt-6 rounded-lg py-2.5 text-center text-sm font-semibold', p.highlight ? 'bg-brand-700 text-white hover:bg-brand-800' : 'border border-ink-200 text-ink-700 hover:bg-ink-50')}>{p.price === 'Free' ? 'Join free' : 'Start free trial'}</Link>
                ) : <p className="mt-6 rounded-lg bg-ink-50 py-2.5 text-center text-xs font-medium text-ink-500">Invited by your league</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="card grid gap-8 p-8 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Coming next</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">The roadmap</h2>
            <p className="mt-2 text-sm text-ink-500">SportsIQ is growing into the full stack for professional leagues — and for every sport.</p>
          </div>
          <div className="flex flex-wrap gap-2">{ROADMAP.map((r) => <span key={r} className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm"><LayoutDashboard className="h-4 w-4 text-brand-600" />{r}</span>)}</div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-ink-200 rounded-2xl border border-ink-200">
          {FAQ.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-semibold">{q}<ChevronDown className={cx('h-4 w-4 shrink-0 transition', faq === i && 'rotate-180')} /></button>
              {faq === i && <p className="px-6 pb-5 text-sm leading-relaxed text-ink-500">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-14 text-center text-white sm:px-12">
          <Monogram size={56} className="mx-auto" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Your next season starts here.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">Create your league in minutes and let SportsIQ guide you all the way to the trophy.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register?role=LEAGUE_OWNER" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-800 hover:bg-brand-50">Create your league</Link>
            <Link to="/register?role=SPONSOR" className="rounded-lg px-6 py-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">Register as sponsor</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div><Logo size={30} tagline /><p className="mt-4 max-w-sm text-sm text-ink-500">The operating system for sports leagues — planning, vendors, sponsors, teams, players and finance in one platform.</p></div>
            <div><p className="text-sm font-bold">Product</p><ul className="mt-3 space-y-2 text-sm text-ink-500"><li><a href="#features" className="hover:text-ink-900">Features</a></li><li><a href="#pricing" className="hover:text-ink-900">Pricing</a></li><li><a href="#vendors" className="hover:text-ink-900">Vendor marketplace</a></li></ul></div>
            <div><p className="text-sm font-bold">Join as</p><ul className="mt-3 space-y-2 text-sm text-ink-500"><li><Link to="/register?role=LEAGUE_OWNER" className="hover:text-ink-900">League owner</Link></li><li><Link to="/register?role=VENDOR" className="hover:text-ink-900">Vendor</Link></li><li><Link to="/register?role=SPONSOR" className="hover:text-ink-900">Sponsor</Link></li><li><Link to="/register?role=PLAYER" className="hover:text-ink-900">Player</Link></li></ul></div>
            <div><p className="text-sm font-bold">Account & legal</p><ul className="mt-3 space-y-2 text-sm text-ink-500"><li><Link to="/login" className="hover:text-ink-900">Log in</Link></li><li><Link to="/register" className="hover:text-ink-900">Sign up</Link></li><li><Link to="/privacy" className="hover:text-ink-900">Privacy Policy</Link></li><li><Link to="/terms" className="hover:text-ink-900">Terms of Service</Link></li></ul></div>
          </div>
          <div className="mt-10 border-t border-ink-100 pt-6 text-xs leading-relaxed text-ink-400">
            <p><Bell className="mr-1 inline h-3 w-3" />SportsIQ is a technology platform. Vendors and sponsors are independent businesses; SportsIQ is not a party to agreements between users. Contract templates are provided for reference only and are not legal advice — always have agreements verified by a qualified lawyer.</p>
            <p className="mt-3">© {new Date().getFullYear()} SportsIQ. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
