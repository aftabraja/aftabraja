import { useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button, Field, Input, Modal, cx } from './ui';

/**
 * AI Logo Studio (v1): generates sports-crest logo concepts from league name, initials and palette.
 * Runs fully in the browser and outputs SVG. A generative-image provider can be plugged in later
 * behind the same "onSelect(dataUrl)" contract.
 */
const PALETTES = [
  ['#1d4ed8', '#f59e0b'], ['#0f172a', '#22c55e'], ['#b91c1c', '#fbbf24'], ['#6d28d9', '#f472b6'],
  ['#047857', '#facc15'], ['#0e7490', '#f97316'], ['#111827', '#ef4444'], ['#9333ea', '#22d3ee'],
];
const SHAPES = ['shield', 'circle', 'hex', 'badge', 'diamond', 'pennant'] as const;
type Shape = (typeof SHAPES)[number];

const shapePath: Record<Shape, string> = {
  shield: 'M100 12 172 36v58c0 48-31 80-72 96-41-16-72-48-72-96V36L100 12Z',
  circle: 'M100 14a86 86 0 1 1 0 172 86 86 0 0 1 0-172Z',
  hex: 'M100 10 178 55v90l-78 45-78-45V55l78-45Z',
  badge: 'M40 20h120a20 20 0 0 1 20 20v90c0 30-40 52-80 62-40-10-80-32-80-62V40a20 20 0 0 1 20-20Z',
  diamond: 'M100 8 192 100 100 192 8 100 100 8Z',
  pennant: 'M28 18h144v118l-72 52-72-52V18Z',
};

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!); }

export function makeLogoSvg(name: string, code: string, shape: Shape, [c1, c2]: string[], variant: number) {
  const ini = (code || name.split(/\s+/).map((w) => w[0]).join('')).toUpperCase().slice(0, 4);
  const fs = ini.length <= 2 ? 64 : ini.length === 3 ? 50 : 40;
  const word = name.toUpperCase().slice(0, 22);
  const accent = [
    `<path d="M40 150 C80 120 120 120 160 150" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    `<g fill="${c2}"><path d="m100 30 6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/></g>`,
    `<circle cx="100" cy="150" r="14" fill="${c2}"/><path d="M90 143c6 4 6 10 0 14M110 143c-6 4-6 10 0 14" stroke="#fff" stroke-width="2" fill="none"/>`,
    `<path d="M60 44h80" stroke="${c2}" stroke-width="5" stroke-linecap="round"/><path d="M70 160h60" stroke="${c2}" stroke-width="5" stroke-linecap="round"/>`,
  ][variant % 4];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="400" height="480">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c1}" stop-opacity=".82"/></linearGradient></defs>
  <path d="${shapePath[shape]}" fill="url(#g)" stroke="${c2}" stroke-width="5"/>
  <path d="${shapePath[shape]}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2" transform="translate(100 100) scale(.88) translate(-100 -100)"/>
  ${accent}
  <text x="100" y="${100 + fs * 0.35}" text-anchor="middle" font-family="Inter, Arial Black, sans-serif" font-weight="900" font-size="${fs}" fill="#fff" letter-spacing="2">${esc(ini)}</text>
  <text x="100" y="226" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${word.length > 16 ? 12 : 15}" fill="${c1}" letter-spacing="1.5">${esc(word)}</text>
</svg>`;
}

export const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

export function AiLogoStudio({ open, onClose, defaultName = '', defaultCode = '', onSelect }: { open: boolean; onClose: () => void; defaultName?: string; defaultCode?: string; onSelect: (dataUrl: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(defaultCode);
  const [seed, setSeed] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const concepts = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const k = i + seed * 8;
    return svgToDataUrl(makeLogoSvg(name || 'Your League', code, SHAPES[(k * 5) % SHAPES.length], PALETTES[(k * 3 + seed) % PALETTES.length], k));
  }), [name, code, seed]);

  return (
    <Modal open={open} onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" />AI Logo Studio</span>}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={picked === null} onClick={() => { onSelect(concepts[picked!]); onClose(); }}>Use selected logo</Button></>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
        <Field label="League / team name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Corporate League T10" /></Field>
        <Field label="Short code"><Input value={code} maxLength={4} onChange={(e) => setCode(e.target.value)} placeholder="CLT" /></Field>
        <div className="flex items-end"><Button variant="secondary" onClick={() => { setSeed(seed + 1); setPicked(null); }}><RefreshCw className="h-4 w-4" />More concepts</Button></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {concepts.map((src, i) => (
          <button key={i} onClick={() => setPicked(i)} className={cx('rounded-xl border-2 bg-ink-50 p-3 transition hover:border-brand-300', picked === i ? 'border-brand-600 ring-4 ring-brand-100' : 'border-transparent')}>
            <img src={src} alt={`Concept ${i + 1}`} className="mx-auto h-32 w-auto" />
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-500">Tip: shortlist a concept here, then hand it to a professional logo designer from the vendor marketplace for final artwork and trademark filing.</p>
    </Modal>
  );
}
