import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';

export interface SlideData { layout: 'cover' | 'bullets' | 'stats' | 'table' | 'closing'; title: string; subtitle?: string; bullets?: string[]; stats?: { label: string; value: string }[]; rows?: string[][] }
interface Brand { name: string; logoUrl?: string | null; color?: string | null }

/** A slide rendered at a fixed 960×540 canvas (scaled by the caller). */
export function SlideCanvas({ s, brand, index, total }: { s: SlideData; brand: Brand; index: number; total: number }) {
  const c = brand.color || '#1d4ed8';
  const dark = s.layout === 'cover' || s.layout === 'closing';
  return (
    <div style={{ width: 960, height: 540, background: dark ? `linear-gradient(135deg, ${c}, #0f172a)` : '#ffffff', fontFamily: 'Inter, sans-serif' }} className={cx('relative overflow-hidden', dark ? 'text-white' : 'text-ink-900')}>
      {!dark && <div style={{ background: c }} className="absolute left-0 top-0 h-2 w-full" />}
      {dark && <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />}
      <div className="absolute right-10 top-8 flex items-center gap-3">
        {brand.logoUrl && <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-lg bg-white object-contain p-1" />}
      </div>
      {dark ? (
        <div className="flex h-full flex-col justify-center px-20">
          {brand.logoUrl && s.layout === 'cover' && <img src={brand.logoUrl} alt="" className="mb-8 h-28 w-28 rounded-2xl bg-white object-contain p-2" />}
          <h1 className="text-6xl font-extrabold leading-tight tracking-tight">{s.title}</h1>
          {s.subtitle && <p className="mt-5 text-2xl text-white/80">{s.subtitle}</p>}
        </div>
      ) : (
        <div className="flex h-full flex-col px-16 pb-14 pt-16">
          <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: c }}>{s.title}</h2>
          {s.subtitle && <p className="mt-2 text-xl text-ink-500">{s.subtitle}</p>}
          <div className="mt-8 flex-1">
            {s.layout === 'bullets' && (
              <ul className="space-y-4">
                {s.bullets?.map((b, i) => <li key={i} className="flex gap-4 text-2xl leading-snug"><span style={{ background: c }} className="mt-3 h-3 w-3 shrink-0 rounded-full" />{b}</li>)}
              </ul>
            )}
            {s.layout === 'stats' && (
              <div className="grid grid-cols-2 gap-6">
                {s.stats?.map((x, i) => <div key={i} className="rounded-2xl border-2 border-ink-100 p-6"><p className="text-5xl font-extrabold" style={{ color: c }}>{x.value}</p><p className="mt-2 text-xl text-ink-500">{x.label}</p></div>)}
              </div>
            )}
            {s.layout === 'table' && s.rows && (
              <table className="w-full text-xl">
                <thead><tr>{s.rows[0]?.map((h, i) => <th key={i} style={{ background: c }} className="px-4 py-3 text-left font-bold text-white first:rounded-l-lg last:rounded-r-lg">{h}</th>)}</tr></thead>
                <tbody>{s.rows.slice(1, 9).map((r, i) => <tr key={i} className="border-b border-ink-100">{r.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
      <div className={cx('absolute bottom-5 left-16 right-10 flex justify-between text-sm', dark ? 'text-white/60' : 'text-ink-400')}>
        <span className="font-semibold">{brand.name}</span><span>{index + 1} / {total}</span>
      </div>
    </div>
  );
}

/** Scales a 960×540 slide to the width of its container */
export function ScaledSlide(props: Parameters<typeof SlideCanvas>[0] & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 960));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx('relative w-full overflow-hidden rounded-lg border border-ink-200 shadow-card', props.className)} style={{ aspectRatio: '16 / 9' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}><SlideCanvas {...props} /></div>
    </div>
  );
}
