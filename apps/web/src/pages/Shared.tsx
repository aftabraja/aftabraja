import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Lock } from 'lucide-react';
import { get, post } from '../lib/api';
import { Button, Spinner, Textarea, cx } from '../components/ui';
import { ScaledSlide, SlideCanvas } from '../components/Slide';
import { Logo } from '../components/Logo';

/** Public, view-only deck: /d/:token */
export function SharedDeck() {
  const { token } = useParams();
  const q = useQuery({ queryKey: ['shared-deck', token], queryFn: () => get(`/public/decks/${token}`), retry: false, refetchOnWindowFocus: false });
  const [i, setI] = useState(0);
  const n = q.data?.slides.length ?? 0;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(n - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [n]);
  if (q.isLoading) return <Spinner className="h-screen" />;
  if (q.error) return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-ink-50 p-6 text-center">
      <Lock className="h-10 w-10 text-ink-300" /><p className="text-lg font-semibold">{(q.error as Error).message}</p><p className="text-sm text-ink-500">Shared decks are personal, time-limited links.</p>
    </div>
  );
  const d = q.data;
  const pdf = () => {
    const html = d.slides.map((x: any, k: number) => `<div class="pg">${renderToStaticMarkup(<SlideCanvas s={x} brand={d.brand} index={k} total={n} watermark={d.watermark} />)}</div>`).join('');
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((x) => x.outerHTML).join('');
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${d.title}</title>${styles}<style>@page{size:960px 540px;margin:0}body{margin:0}.pg{width:960px;height:540px;page-break-after:always;overflow:hidden}</style></head><body>${html}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 600);
  };
  return (
    <div className="min-h-screen bg-ink-900 text-white" onContextMenu={(e) => e.preventDefault()}>
      <header className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
        <div className="min-w-0"><p className="truncate font-semibold">{d.title}</p><p className="text-xs text-white/50">{d.brand.name}{d.expiresAt ? ` · link expires ${new Date(d.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</p></div>
        <div className="flex items-center gap-3">{d.allowDownload && <Button size="sm" variant="secondary" onClick={pdf}><Download className="h-3.5 w-3.5" />PDF</Button>}<span className="text-white/60">{i + 1} / {n}</span></div>
      </header>
      <main className="mx-auto max-w-6xl select-none px-4 pb-6">
        <ScaledSlide s={d.slides[i]} brand={d.brand} index={i} total={n} watermark={d.watermark} className="border-0" />
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button>
          <Button variant="secondary" disabled={i >= n - 1} onClick={() => setI(i + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{d.slides.map((x: any, k: number) => <button key={k} onClick={() => setI(k)} className={cx('w-32 shrink-0 rounded ring-2', k === i ? 'ring-brand-400' : 'ring-transparent opacity-60 hover:opacity-100')}><ScaledSlide s={x} brand={d.brand} index={k} total={n} className="border-0" /></button>)}</div>
        <p className="mt-4 text-center text-xs text-white/40">Confidential. Shared via SportsIQ — please do not forward this link.</p>
      </main>
    </div>
  );
}

/** Public NPS survey: /s/:token */
export function PublicSurvey() {
  const { token } = useParams();
  const q = useQuery({ queryKey: ['survey', token], queryFn: () => get(`/public/surveys/${token}`), retry: false });
  const [score, setScore] = useState<number | null>(null);
  const [f, setF] = useState({ comment: '', name: '', email: '' });
  const send = useMutation({ mutationFn: () => post(`/public/surveys/${token}`, { score, comment: f.comment || undefined, name: f.name || undefined, email: f.email || undefined }) });
  const shell = (body: React.ReactNode) => <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-card sm:p-8">{body}<p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">Powered by <Logo size={14} /></p></div></div>;
  if (q.isLoading) return <Spinner className="h-screen" />;
  if (q.error) return shell(<p className="text-center text-lg font-semibold">{(q.error as Error).message}</p>);
  const d = q.data;
  if (send.isSuccess) return shell(<div className="text-center"><p className="text-2xl font-bold">Thank you!</p><p className="mt-2 text-ink-500">Your feedback goes straight to the {d.league.name} team.</p></div>);
  return shell(
    <>
      <div className="mb-5 flex items-center gap-3">{d.league.logoUrl && <img src={d.league.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />}<div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{d.league.name}</p><p className="font-semibold">{d.title}</p></div></div>
      <p className="text-lg font-semibold">{d.question}</p>
      <div className="mt-4 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, k) => <button key={k} onClick={() => setScore(k)} aria-pressed={score === k} className={cx('h-11 rounded-lg border text-sm font-bold transition', score === k ? (k >= 9 ? 'border-emerald-600 bg-emerald-600 text-white' : k >= 7 ? 'border-amber-500 bg-amber-500 text-white' : 'border-red-500 bg-red-500 text-white') : 'border-ink-200 hover:bg-ink-50')}>{k}</button>)}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-500"><span>Not at all likely</span><span>Extremely likely</span></div>
      {score !== null && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-medium">{d.followUp}<Textarea className="mt-1" rows={3} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} /></label>
          <div className="grid gap-2 sm:grid-cols-2"><input className="input" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className="input" type="email" placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          {send.error && <p className="text-sm text-red-600">{(send.error as Error).message}</p>}
          <Button className="w-full" loading={send.isPending} onClick={() => send.mutate()}>Submit</Button>
          <p className="text-[11px] text-ink-400">Name and email are optional and only used by the league to follow up on your feedback.</p>
        </div>
      )}
    </>
  );
}
