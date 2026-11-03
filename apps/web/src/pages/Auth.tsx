import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Check, Megaphone, Star, Trophy, User } from 'lucide-react';
import { homeFor, useAuth } from '../lib/auth';
import { Button, ErrorText, Field, Input, Select, cx } from '../components/ui';
import { Logo } from '../components/Logo';

function AuthLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/"><Logo size={34} /></Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-400/10" />
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">The League Operating System</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight">From idea to closing ceremony — run your entire league in one place.</h2>
          <ul className="mt-8 space-y-3 text-white/85">
            {['66-step execution playbook built from tournament operations best practice', '70+ vendor categories — stadiums to trophy makers', 'Sponsorship marketplace, finance & live P&L', 'Teams, owners, players and management — each with their own portal'].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { const u = await login(email, password); nav(homeFor(u.role)); } catch (err) { setError(err); } finally { setLoading(false); }
  };
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your SportsIQ workspace.">
      <form onSubmit={submit} className="space-y-4">
        <ErrorText error={error} />
        <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button className="w-full" size="lg" loading={loading}>Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">New to SportsIQ? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link></p>
      <div className="mt-8 rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs text-ink-500">
        <p className="mb-1 font-semibold text-ink-700">Demo accounts (password Demo@1234)</p>
        owner@demo.sportsiq.in · teamowner@demo.sportsiq.in · vendor1@demo.sportsiq.in · sponsor1@demo.sportsiq.in · player1@demo.sportsiq.in
      </div>
    </AuthLayout>
  );
}

const ROLES = [
  { value: 'LEAGUE_OWNER', label: 'League Owner', desc: 'Create and run a league end to end', icon: Trophy, price: '₹5,000 / season' },
  { value: 'VENDOR', label: 'Vendor', desc: 'List your services for leagues', icon: Building2, price: '₹1,500 / year' },
  { value: 'SPONSOR', label: 'Sponsor', desc: 'Discover leagues to sponsor', icon: Megaphone, price: '₹2,500 / year' },
  { value: 'PLAYER', label: 'Player', desc: 'Build your profile & join leagues', icon: User, price: 'Free' },
  { value: 'TALENT_AGENT', label: 'Agency / Manager', desc: 'Represent cricketers & legends', icon: Star, price: '₹2,500 / year' },
];

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') ?? 'LEAGUE_OWNER');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', companyName: '', city: '', industry: '', playingRole: '' });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { const u = await register({ ...f, role }); nav(u.role === 'LEAGUE_OWNER' ? '/leagues/new' : homeFor(u.role)); } catch (err) { setError(err); } finally { setLoading(false); }
  };
  return (
    <AuthLayout title="Create your account" subtitle="Start with a 14-day free trial. No card required.">
      <div className="mb-6 grid grid-cols-2 gap-2">
        {ROLES.map((r) => (
          <button key={r.value} type="button" onClick={() => setRole(r.value)}
            className={cx('rounded-xl border p-3 text-left transition', role === r.value ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-100' : 'border-ink-200 hover:border-ink-300')}>
            <r.icon className={cx('h-5 w-5', role === r.value ? 'text-brand-700' : 'text-ink-400')} />
            <p className="mt-2 text-sm font-semibold">{r.label}</p>
            <p className="text-xs text-ink-500">{r.desc}</p>
            <p className="mt-1 text-[11px] font-semibold text-brand-700">{r.price}</p>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <ErrorText error={error} />
        <Field label="Full name"><Input required value={f.name} onChange={set('name')} /></Field>
        {(role === 'VENDOR' || role === 'SPONSOR' || role === 'TALENT_AGENT') && <Field label={role === 'TALENT_AGENT' ? 'Agency / manager name' : 'Company name'}><Input required value={f.companyName} onChange={set('companyName')} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
          {role === 'SPONSOR' && <Field label="Industry"><Input value={f.industry} onChange={set('industry')} placeholder="FMCG, Fintech…" /></Field>}
          {role === 'PLAYER' && <Field label="Playing role"><Select value={f.playingRole} onChange={set('playingRole')} placeholder="Select" options={['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper']} /></Field>}
        </div>
        <Field label="Password" hint="At least 8 characters"><Input type="password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
        <Button className="w-full" size="lg" loading={loading}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
    </AuthLayout>
  );
}
