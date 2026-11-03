import type { SlideData } from '../components/Slide';

interface Brand { name: string; logoUrl?: string | null; color?: string | null }

async function toDataUrl(url: string) {
  if (url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
}
const imgSize = (src: string) => new Promise<{ w: number; h: number }>((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); i.onerror = () => res({ w: 16, h: 9 }); i.src = src; });

/** Builds a native, editable PowerPoint (16:9) from Deck Studio slides */
export async function exportPptx(title: string, slides: SlideData[], brand: Brand) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = title;
  pptx.company = brand.name;
  const c = (brand.color || '#1d4ed8').replace('#', '');
  const logo = brand.logoUrl ? await toDataUrl(brand.logoUrl).catch(() => null) : null;
  const W = 13.33;
  for (const [i, s] of slides.entries()) {
    const sl = pptx.addSlide();
    const dark = s.layout === 'cover' || s.layout === 'closing';
    const fg = dark ? 'FFFFFF' : '0F172A';
    if (dark) sl.background = { color: c };
    else sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.12, fill: { color: c }, line: { color: c } });
    if (logo) sl.addImage({ data: logo, x: W - 1.3, y: 0.35, w: 0.85, h: 0.85, sizing: { type: 'contain', w: 0.85, h: 0.85 } });
    if (dark) {
      sl.addText(s.title, { x: 0.9, y: 2.2, w: W - 2.5, h: 1.6, fontSize: 44, bold: true, color: fg, fontFace: 'Arial' });
      if (s.subtitle) sl.addText(s.subtitle, { x: 0.9, y: 3.8, w: W - 2.5, h: 0.9, fontSize: 22, color: 'E2E8F0', fontFace: 'Arial' });
    } else {
      sl.addText(s.title, { x: 0.8, y: 0.45, w: W - 2.6, h: 0.9, fontSize: 30, bold: true, color: c, fontFace: 'Arial' });
      if (s.subtitle) sl.addText(s.subtitle, { x: 0.8, y: 1.25, w: W - 2.6, h: 0.5, fontSize: 16, color: '64748B', fontFace: 'Arial' });
      const top = s.subtitle ? 2.0 : 1.6;
      if (s.layout === 'bullets' && s.bullets?.length) {
        sl.addText(s.bullets.filter(Boolean).map((b) => ({ text: b, options: { bullet: { code: '25CF' }, paraSpaceAfter: 10 } })), { x: 0.9, y: top, w: W - 1.8, h: 7.5 - top - 0.8, fontSize: 20, color: fg, fontFace: 'Arial', valign: 'top' });
      }
      if (s.layout === 'stats' && s.stats?.length) {
        const cols = 2, cw = (W - 1.6 - 0.4) / cols, ch = 1.9;
        s.stats.slice(0, 6).forEach((x, k) => {
          const cx = 0.8 + (k % cols) * (cw + 0.4), cy = top + Math.floor(k / cols) * (ch + 0.3);
          sl.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: ch, fill: { color: 'FFFFFF' }, line: { color: 'E2E8F0', width: 1.5 }, rectRadius: 0.15 });
          sl.addText(x.value, { x: cx + 0.3, y: cy + 0.2, w: cw - 0.6, h: 1, fontSize: 36, bold: true, color: c, fontFace: 'Arial' });
          sl.addText(x.label, { x: cx + 0.3, y: cy + 1.15, w: cw - 0.6, h: 0.5, fontSize: 16, color: '475569', fontFace: 'Arial' });
        });
      }
      if (s.layout === 'table' && s.rows?.length) {
        const rows = s.rows.slice(0, 9).map((r, ri) => r.map((cell) => ({ text: cell, options: ri === 0 ? { bold: true, color: 'FFFFFF', fill: { color: c } } : { color: fg } })));
        sl.addTable(rows, { x: 0.8, y: top, w: W - 1.6, fontSize: 14, fontFace: 'Arial', border: { type: 'solid', color: 'E2E8F0', pt: 1 }, rowH: 0.45 });
      }
      if (s.layout === 'image' && s.imageUrl) {
        const data = await toDataUrl(s.imageUrl).catch(() => null);
        if (data) {
          const { w, h } = await imgSize(data);
          const boxW = W - 1.6, boxH = 7.5 - top - (s.caption ? 1.3 : 0.8);
          const k = Math.min(boxW / w, boxH / h);
          sl.addImage({ data, x: 0.8 + (boxW - w * k) / 2, y: top, w: w * k, h: h * k });
        }
        if (s.caption) sl.addText(s.caption, { x: 0.8, y: 7.5 - 1.15, w: W - 1.6, h: 0.4, fontSize: 14, color: '64748B', align: 'center', fontFace: 'Arial' });
      }
    }
    sl.addText(`${brand.name}`, { x: 0.8, y: 7.0, w: 6, h: 0.3, fontSize: 10, bold: true, color: dark ? 'CBD5E1' : '94A3B8', fontFace: 'Arial' });
    sl.addText(`${i + 1} / ${slides.length}`, { x: W - 2.3, y: 7.0, w: 1.5, h: 0.3, fontSize: 10, align: 'right', color: dark ? 'CBD5E1' : '94A3B8', fontFace: 'Arial' });
    if (s.notes) sl.addNotes(s.notes);
  }
  await pptx.writeFile({ fileName: `${title.replace(/[^\w]+/g, '_')}.pptx` });
}
