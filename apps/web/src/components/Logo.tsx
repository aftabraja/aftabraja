import { cx } from './ui';

/**
 * SPORTSIQ monogram: a hexagonal sports badge (strength, structure, a league "crest")
 * holding a bold "S" stroke whose end becomes an amber spark — the "IQ" intelligence point.
 */
export function Monogram({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label="SPORTSIQ" role="img">
      <defs>
        <linearGradient id="siq-g" x1="6" y1="3" x2="42" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <path d="M24 2.5 42.5 13v22L24 45.5 5.5 35V13L24 2.5Z" fill="url(#siq-g)" />
      <path d="M24 6.5 39 15v18L24 41.5 9 33V15L24 6.5Z" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1" />
      <path
        d="M30.6 17.6c-1.5-2-3.9-3.1-6.8-3.1-3.9 0-6.6 2-6.6 5 0 3 2.5 3.9 6.8 4.6 4.1.7 6.6 1.8 6.6 4.8 0 3-2.7 4.8-6.6 4.8-3.2 0-5.8-1.2-7.2-3.4"
        fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="33.4" cy="15.2" r="3.1" fill="#f59e0b" />
      <circle cx="33.4" cy="15.2" r="1.2" fill="#fff" fillOpacity=".85" />
    </svg>
  );
}

export function Logo({ size = 32, className, light, tagline }: { size?: number; className?: string; light?: boolean; tagline?: boolean }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <Monogram size={size} />
      <div className="leading-none">
        <div className={cx('font-extrabold tracking-tight', light ? 'text-white' : 'text-ink-900')} style={{ fontSize: size * 0.62 }}>
          SPORTS<span className={light ? 'text-amber-400' : 'text-brand-700'}>IQ</span>
        </div>
        {tagline && <div className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]', light ? 'text-white/70' : 'text-ink-500')}>The League Operating System</div>}
      </div>
    </div>
  );
}
