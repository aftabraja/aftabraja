import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CornerDownLeft, Search, Store } from 'lucide-react';
import { get } from '../lib/api';
import { useVendorPanel } from './VendorPanel';
import { Spinner, cx } from './ui';

interface Hit { type: string; title: string; subtitle?: string; link: string }

/** Header search: one box for leagues, teams, players, matches, contracts, deals, vendors, sponsors and talent (Ctrl/⌘ + K) */
export function GlobalSearch({ leagueId, canSearchVendors }: { leagueId?: string; canSearchVendors: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [deb, setDeb] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const { openVendors } = useVendorPanel();
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); } if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 20); else { setQ(''); setActive(0); } }, [open]);
  const res = useQuery({ queryKey: ['search', deb, leagueId], queryFn: () => get<{ groups: Record<string, Hit[]> }>(`/search?q=${encodeURIComponent(deb)}${leagueId ? `&league=${leagueId}` : ''}`), enabled: open && deb.length >= 2, staleTime: 30_000 });
  const flat = Object.entries(res.data?.groups ?? {}).flatMap(([g, hits]) => hits.map((h) => ({ ...h, group: g })));
  const go = (h: Hit) => {
    setOpen(false);
    if (h.link.startsWith('vendor:')) openVendors(undefined, leagueId, h.link.slice(7));
    else nav(h.link);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && flat[active]) go(flat[active]);
  };
  let idx = -1;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-sm text-ink-500 transition hover:border-brand-200 hover:bg-white">
        <Search className="h-4 w-4 shrink-0" /><span className="truncate">Search players, teams, contracts, vendors…</span>
        <kbd className="ml-auto hidden rounded border border-ink-200 bg-white px-1.5 text-[10px] font-semibold text-ink-400 sm:block">Ctrl K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 p-4 pt-[10vh]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Search" className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-ink-100 px-4">
              <Search className="h-5 w-5 text-ink-400" />
              <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Search everything you have access to" className="h-14 flex-1 bg-transparent text-base outline-none" aria-label="Search" />
              {res.isFetching && <Spinner className="h-5 w-5 p-0" />}
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {deb.length < 2 ? <p className="px-3 py-6 text-center text-sm text-ink-500">Type at least 2 letters. Try a player, team, sponsor, vendor or contract.</p>
                : !flat.length && !res.isFetching ? <p className="px-3 py-6 text-center text-sm text-ink-500">No results for “{deb}”.</p>
                : Object.entries(res.data?.groups ?? {}).map(([g, hits]) => (
                  <div key={g} className="mb-2">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">{g}</p>
                    {hits.map((h) => { idx++; const me = idx; return (
                      <button key={`${g}-${me}`} onMouseEnter={() => setActive(me)} onClick={() => go(h)} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', active === me ? 'bg-brand-50' : 'hover:bg-ink-50')}>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink-900">{h.title}</span>{h.subtitle && <span className="block truncate text-xs text-ink-500">{h.subtitle}</span>}</span>
                        <span className="shrink-0 text-[11px] text-ink-400">{h.type}</span>
                        {active === me ? <CornerDownLeft className="h-3.5 w-3.5 text-brand-600" /> : <ArrowRight className="h-3.5 w-3.5 text-ink-300" />}
                      </button>
                    ); })}
                  </div>
                ))}
            </div>
            {canSearchVendors && (
              <button onClick={() => { setOpen(false); openVendors(undefined, leagueId); }} className="flex w-full items-center gap-2 border-t border-ink-100 px-5 py-3 text-left text-sm font-medium text-brand-700 hover:bg-brand-50">
                <Store className="h-4 w-4" />Browse the vendor marketplace by category
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
