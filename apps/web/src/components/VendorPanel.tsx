import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ComplianceBadge } from './ComplianceBadge';
import { ArrowLeft, BadgeCheck, MapPin, MessageSquare, Search, Send, Star, X, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { inr } from '../lib/format';
import { Avatar, Badge, Button, Empty, Spinner, Textarea, cx } from './ui';

interface PanelState { open: boolean; category?: string; leagueId?: string; vendorId?: string }
const Ctx = createContext<{ state: PanelState; openVendors: (category?: string, leagueId?: string, vendorId?: string) => void; close: () => void }>(null!);

export function VendorPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelState>({ open: false });
  const value = useMemo(() => ({
    state,
    openVendors: (category?: string, leagueId?: string, vendorId?: string) => setState({ open: true, category, leagueId, vendorId }),
    close: () => setState({ open: false }),
  }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useVendorPanel = () => useContext(Ctx);

export interface Category { id: string; slug: string; name: string; group: string; suggestions: string[]; vendorCount: number }
export const useCategories = () => useQuery({ queryKey: ['vendor-categories'], queryFn: () => get<{ groups: string[]; categories: Category[] }>('/vendors/categories'), staleTime: 5 * 60_000 });

/** Vendor search UI — used in the right-hand split pane and in the full marketplace page. */
export function VendorBrowser({ initialCategory, initialVendor, leagueId, onClose, compact }: { initialCategory?: string; initialVendor?: string; leagueId?: string; onClose?: () => void; compact?: boolean }) {
  const [category, setCategory] = useState(initialCategory ?? '');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('rating');
  const [selected, setSelected] = useState<string | null>(initialVendor ?? null);
  const cats = useCategories();
  const params = new URLSearchParams({ ...(category && { category }), ...(q && { q }), ...(city && { city }), sort }).toString();
  const vendors = useQuery({ queryKey: ['vendors', params], queryFn: () => get<any[]>(`/vendors?${params}`) });
  const catName = cats.data?.categories.find((c) => c.slug === category)?.name;

  if (selected) return <VendorDetail id={selected} leagueId={leagueId} onBack={() => setSelected(null)} />;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-ink-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Vendor marketplace</p>
            <h2 className="text-base font-bold">{catName ?? 'All vendors'}</h2>
          </div>
          {onClose && <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close"><X className="h-4 w-4" /></button>}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search services, companies…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className={cx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          <select className={cx('input', compact ? 'col-span-2' : 'col-span-1')} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {cats.data?.groups.map((g) => (
              <optgroup key={g} label={g}>
                {cats.data.categories.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.vendorCount})</option>)}
              </optgroup>
            ))}
          </select>
          <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rating">Top rated</option><option value="price">Lowest price</option><option value="new">Newest</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-ink-50/50 p-3">
        {vendors.isLoading ? <Spinner /> : !vendors.data?.length ? (
          <Empty icon={<Store className="h-5 w-5" />} title="No vendors found" text="Try another category or city. New vendors join SportsIQ every day." />
        ) : (
          <div className={cx('grid gap-3', !compact && 'md:grid-cols-2 xl:grid-cols-3')}>
            {vendors.data.map((v) => (
              <button key={v.id} onClick={() => setSelected(v.id)} className="card w-full p-4 text-left transition hover:border-brand-200 hover:shadow-pop">
                <div className="flex gap-3">
                  <Avatar name={v.companyName} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{v.companyName}</p>
                      {v.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                      {v.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{v.city}</span>}
                      {v.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{v.rating.toFixed(1)} ({v.reviewCount})</span>}
                    </div>
                  </div>
                </div>
                {v.description && <p className="mt-2 line-clamp-2 text-xs text-ink-500">{v.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  {[...new Set<string>(v.services.map((s: any) => s.category.name))].slice(0, 3).map((n) => <Badge key={n}>{n}</Badge>)}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-xs">
                  <span className="text-ink-500">{v.services.length} service{v.services.length !== 1 && 's'}</span>
                  <span className="font-semibold text-ink-900">{v.startingPrice ? `From ${inr(v.startingPrice)}` : 'Price on request'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VendorDetail({ id, leagueId, onBack }: { id: string; leagueId?: string; onBack: () => void }) {
  const v = useQuery({ queryKey: ['vendor', id], queryFn: () => get(`/vendors/${id}`) });
  const [msg, setMsg] = useState('');
  const send = useMutation({ mutationFn: () => post('/messages', { toUserId: v.data.user.id, leagueId, subject: `Enquiry for ${v.data.companyName}`, body: msg }) });
  if (v.isLoading) return <Spinner />;
  const d = v.data;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-100 p-4">
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Back to results</button>
        <div className="flex gap-3">
          <Avatar name={d.companyName} size={52} />
          <div>
            <div className="flex items-center gap-1.5"><h2 className="text-lg font-bold">{d.companyName}</h2>{d.verified && <BadgeCheck className="h-5 w-5 text-brand-600" />}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
              {d.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.city}</span>}
              {d.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{d.rating.toFixed(1)} · {d.reviewCount} reviews</span>}
              {d.yearsInBusiness && <span>{d.yearsInBusiness} yrs in business</span>}
            </div>
          </div>
        </div>
        {d.description && <p className="mt-3 text-sm text-ink-700">{d.description}</p>}
        {d.serviceAreas?.length > 0 && <p className="mt-2 text-xs text-ink-500">Serves: {d.serviceAreas.join(', ')}</p>}
        {d.compliance && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            <ComplianceBadge c={{ compliant: d.compliance.compliant, missing: d.compliance.items.filter((i: any) => i.status !== 'VALID').length }} />
            {d.compliance.items.map((i: any) => <span key={i.type} className={`rounded px-1.5 py-0.5 ${i.status === 'VALID' ? 'bg-emerald-50 text-emerald-800' : i.status === 'EXPIRED' ? 'bg-red-50 text-red-800' : 'bg-ink-100 text-ink-600'}`}>{i.label}: {i.status.toLowerCase()}</span>)}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="label">Services & pricing</p>
          <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
            {d.services.map((s: any) => (
              <div key={s.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-ink-500">{s.category.name}{s.description && ` · ${s.description}`}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{s.priceMin ? (s.priceMax && s.priceMax !== s.priceMin ? `${inr(s.priceMin)} – ${inr(s.priceMax)}` : inr(s.priceMin)) : 'On request'}</p>
                  {s.unit && <p className="text-xs text-ink-500">{s.unit}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {leagueId && (
          <Link to={`/leagues/${leagueId}/procurement?new=1&category=${d.services[0]?.category.slug ?? ''}&vendor=${d.id}`} className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><Send className="h-4 w-4" />Request a formal quote</Link>
        )}
        {d._count?.workOrders > 0 && <p className="text-center text-xs text-ink-500">{d._count.workOrders} jobs completed through SportsIQ</p>}
        {d.portfolio?.length > 0 && (
          <div>
            <p className="label">Portfolio</p>
            <div className="grid grid-cols-3 gap-2">{d.portfolio.map((p: any) => (
              <a key={p.id} href={p.imageUrl ?? p.videoUrl ?? '#'} target="_blank" rel="noreferrer" title={p.title} className="group block overflow-hidden rounded-lg border border-ink-200">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-20 w-full object-cover" /> : <div className="flex h-20 items-center justify-center bg-ink-50 text-[10px] text-ink-500">{p.title}</div>}
              </a>
            ))}</div>
          </div>
        )}
        {d.reviews?.length > 0 && (
          <div>
            <p className="label">Reviews from leagues</p>
            <ul className="space-y-2">{d.reviews.map((r: any) => (
              <li key={r.id} className="rounded-lg border border-ink-200 p-3 text-xs">
                <p className="flex justify-between"><b>{r.leagueName}</b><span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{((r.quality + r.onTime + r.value) / 3).toFixed(1)}</span></p>
                {r.comment && <p className="mt-1 text-ink-700">“{r.comment}”</p>}
              </li>
            ))}</ul>
          </div>
        )}
        <div className="card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-brand-700" />Message {d.companyName}</p>
          {send.isSuccess ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Message sent. You'll find the conversation in Messages.</p>
          ) : (
            <>
              <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe what you need: dates, quantity, venue, budget…" />
              <Button className="mt-2 w-full" onClick={() => send.mutate()} loading={send.isPending} disabled={!msg.trim()}>Send enquiry</Button>
              {send.error && <p className="mt-2 text-xs text-red-600">{(send.error as Error).message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Right-hand pane of the 3-pane layout */
export function VendorPane() {
  const { state, close } = useVendorPanel();
  if (!state.open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden" onClick={close} />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-ink-200 bg-white shadow-pop lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:w-[420px] lg:max-w-none lg:shrink-0 lg:shadow-none xl:w-[460px]">
        <VendorBrowser key={`${state.category}-${state.leagueId}-${state.vendorId}`} initialCategory={state.category} initialVendor={state.vendorId} leagueId={state.leagueId} onClose={close} compact />
      </aside>
    </>
  );
}
