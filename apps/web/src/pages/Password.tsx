import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get, post, tokenStore } from '../lib/api';
import { homeFor } from '../lib/auth';
import { Button, Card, ErrorText, Field, Input, Spinner } from '../components/ui';
import { Logo } from '../components/Logo';

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-ink-50/60 px-4 py-10">
      <Link to="/"><Logo size={32} /></Link>
      <Card className="mt-8 w-full max-w-md"><h1 className="mb-4 text-xl font-bold">{title}</h1>{children}</Card>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setErr(null);
    try { setMsg((await post('/auth/forgot-password', { email })).message); } catch (x) { setErr(x); } finally { setLoading(false); }
  };
  return (
    <Box title="Forgot your password?">
      {msg ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{msg} The link is valid for 1 hour.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-500">Enter your account email and we'll send you a reset link.</p>
          <ErrorText error={err} />
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link></p>
    </Box>
  );
}

/** Handles both /reset-password and /set-password (invitation) links */
export function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const info = useQuery({ queryKey: ['token', token], queryFn: () => get(`/auth/token-info?token=${encodeURIComponent(token)}`), retry: false, enabled: !!token });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setErr(new Error('Passwords do not match'));
    setLoading(true); setErr(null);
    try {
      const r = await post('/auth/set-password', { token, password: pw, acceptTerms: terms || undefined });
      tokenStore.set(r.token);
      window.location.href = homeFor(r.user.role);
    } catch (x) { setErr(x); } finally { setLoading(false); }
  };
  if (info.isLoading) return <Spinner className="h-screen" />;
  if (!token || info.error) return <Box title="Link expired"><p className="text-sm text-ink-700">{(info.error as Error)?.message ?? 'This link is invalid.'}</p><Button className="mt-4 w-full" onClick={() => nav('/forgot-password')}>Request a new link</Button></Box>;
  const invite = info.data.purpose === 'INVITE';
  return (
    <Box title={invite ? `Welcome, ${info.data.name}` : 'Choose a new password'}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-500">{invite ? 'Set a password to activate your SportsIQ account' : 'Set a new password for'} <b>{info.data.email}</b>.</p>
        <ErrorText error={err} />
        <Field label="New password" hint="At least 8 characters"><Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirm password"><Input type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {info.data.needsTerms && <label className="flex gap-2 text-sm text-ink-700"><input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />I agree to the <Link to="/terms" target="_blank" className="text-brand-700 underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="text-brand-700 underline">Privacy Policy</Link>.</label>}
        <Button className="w-full" loading={loading} disabled={info.data.needsTerms && !terms}>{invite ? 'Activate account' : 'Update password'}</Button>
      </form>
    </Box>
  );
}
