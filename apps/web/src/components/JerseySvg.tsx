/** Parametric cricket jersey (front & back) rendered as SVG — used for design, approval and production files. */
export interface JerseyColors { body: string; sleeves: string; collar: string; accent: string; text: string }
export interface JerseySponsor { slot: string; name: string; logoUrl?: string | null }
export interface JerseyProps {
  side: 'front' | 'back'; template: string; colors: JerseyColors; sponsors: JerseySponsor[];
  leagueLogo?: string | null; teamLogo?: string | null; leagueLogoSlot: string; teamLogoSlot: string;
  name?: string; number?: string; teamShort?: string; showSlots?: boolean; allowedSlots?: string[]; id?: string;
}

const BODY = 'M90 22 L120 12 Q150 34 180 12 L210 22 L236 116 L236 332 L64 332 L64 116 Z';
const SLEEVE_L = 'M90 22 L12 72 L36 132 L66 116 Z';
const SLEEVE_R = 'M210 22 L288 72 L264 132 L234 116 Z';
const COLLAR_FRONT = 'M120 12 Q150 34 180 12 L172 8 Q150 24 128 8 Z';
const COLLAR_BACK = 'M118 12 Q150 22 182 12 L176 6 Q150 14 124 6 Z';

/** Logo slot boxes: x, y (centre), w, h */
export const SLOT_BOX: Record<string, { side: 'front' | 'back'; x: number; y: number; w: number; h: number }> = {
  FRONT_CHEST: { side: 'front', x: 150, y: 150, w: 104, h: 40 },
  CHEST_LEFT: { side: 'front', x: 112, y: 82, w: 30, h: 30 },
  CHEST_RIGHT: { side: 'front', x: 188, y: 82, w: 30, h: 30 },
  LOWER_FRONT: { side: 'front', x: 150, y: 222, w: 80, h: 24 },
  SLEEVE_LEFT: { side: 'front', x: 48, y: 82, w: 28, h: 20 },
  SLEEVE_RIGHT: { side: 'front', x: 252, y: 82, w: 28, h: 20 },
  BACK_TOP: { side: 'back', x: 150, y: 58, w: 90, h: 22 },
  BACK_BOTTOM: { side: 'back', x: 150, y: 300, w: 90, h: 22 },
};

function Pattern({ template, c, id }: { template: string; c: JerseyColors; id: string }) {
  switch (template) {
    case 'sash': return <path d="M64 116 L236 300 L236 332 L210 332 L64 160 Z" fill={c.accent} clipPath={`url(#${id}-body)`} />;
    case 'panels': return <g clipPath={`url(#${id}-body)`}><rect x="64" y="0" width="26" height="340" fill={c.accent} /><rect x="210" y="0" width="26" height="340" fill={c.accent} /></g>;
    case 'hoops': return <g clipPath={`url(#${id}-body)`}>{[130, 190, 250].map((y) => <rect key={y} x="0" y={y} width="300" height="22" fill={c.accent} />)}</g>;
    case 'gradient': return <rect x="0" y="0" width="300" height="340" fill={`url(#${id}-grad)`} clipPath={`url(#${id}-body)`} />;
    case 'chevron': return <path d="M64 96 L150 176 L236 96 L236 128 L150 208 L64 128 Z" fill={c.accent} clipPath={`url(#${id}-body)`} />;
    default: return <g clipPath={`url(#${id}-body)`}><rect x="0" y="318" width="300" height="14" fill={c.accent} /></g>;
  }
}

function Logo({ box, href, label, dashed }: { box: { x: number; y: number; w: number; h: number }; href?: string | null; label?: string; dashed?: boolean }) {
  const x = box.x - box.w / 2, y = box.y - box.h / 2;
  if (href) return <image href={href} x={x} y={y} width={box.w} height={box.h} preserveAspectRatio="xMidYMid meet" />;
  if (dashed) return <rect x={x} y={y} width={box.w} height={box.h} rx="3" fill="none" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />;
  const text = (label ?? '').slice(0, 14).toUpperCase();
  const fs = Math.min(12, box.h * 0.45, (box.w - 4) / Math.max(1, text.length * 0.66));
  return <g><rect x={x} y={y} width={box.w} height={box.h} rx="3" fill="#ffffff" fillOpacity="0.9" /><text x={box.x} y={box.y + fs * 0.35} textAnchor="middle" fontFamily="Arial" fontWeight="800" fontSize={fs} fill="#0f172a">{text}</text></g>;
}

export function JerseySvg(p: JerseyProps) {
  const c = p.colors;
  const id = p.id ?? `j${p.side}`;
  const slotItems = Object.entries(SLOT_BOX).filter(([, b]) => b.side === p.side);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 340" width="100%" style={{ maxWidth: 360 }} role="img" aria-label={`Jersey ${p.side}`}>
      <defs>
        <clipPath id={`${id}-body`}><path d={BODY} /></clipPath>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.body} /><stop offset="1" stopColor={c.accent} /></linearGradient>
      </defs>
      <path d={SLEEVE_L} fill={c.sleeves} stroke="#0f172a" strokeOpacity="0.25" />
      <path d={SLEEVE_R} fill={c.sleeves} stroke="#0f172a" strokeOpacity="0.25" />
      <path d="M12 72 L36 132 L44 128 L20 68 Z M288 72 L264 132 L256 128 L280 68 Z" fill={c.accent} />
      <path d={BODY} fill={c.body} />
      <Pattern template={p.template} c={c} id={id} />
      <path d={BODY} fill="none" stroke="#0f172a" strokeOpacity="0.25" />
      <path d={p.side === 'front' ? COLLAR_FRONT : COLLAR_BACK} fill={c.collar} />
      {p.side === 'front' && <path d="M150 34 L150 60" stroke={c.collar} strokeWidth="3" />}
      {slotItems.map(([slot, box]) => {
        if (slot === p.leagueLogoSlot) return <Logo key={slot} box={box} href={p.leagueLogo} label="LEAGUE" />;
        if (slot === p.teamLogoSlot) return <Logo key={slot} box={box} href={p.teamLogo} label={p.teamShort ?? 'TEAM'} />;
        const s = p.sponsors.find((x) => x.slot === slot);
        if (s) return <Logo key={slot} box={box} href={s.logoUrl} label={s.name} />;
        return p.showSlots && p.allowedSlots?.includes(slot) ? <Logo key={slot} box={box} dashed /> : null;
      })}
      {p.side === 'back' && (
        <g fontFamily="Arial Black, Arial" fontWeight="900" fill={c.text} textAnchor="middle">
          <text x="150" y="104" fontSize="20" letterSpacing="2">{(p.name ?? 'PLAYER').toUpperCase().slice(0, 14)}</text>
          <text x="150" y="232" fontSize="104">{p.number ?? '10'}</text>
        </g>
      )}
    </svg>
  );
}
