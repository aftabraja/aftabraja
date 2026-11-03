import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Column, ReportResult } from './registry.js';

export interface ReportMeta { title: string; league: string; period?: string; generatedBy: string }

const inGroups = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (v: unknown, time = false) => {
  if (!v) return '';
  const d = new Date(v as string);
  return isNaN(+d) ? String(v) : d.toLocaleString('en-IN', time ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
};
/** Display text for a cell (PDF uses "Rs." because the core PDF fonts have no ₹ glyph) */
export function cellText(c: Column, v: unknown, rupee = '₹') {
  if (v === null || v === undefined || v === '') return '';
  switch (c.type) {
    case 'money': return typeof v === 'number' ? `${v < 0 ? '-' : ''}${rupee}${inGroups(Math.abs(v))}` : String(v);
    case 'number': return typeof v === 'number' ? (Number.isInteger(v) ? inGroups(v) : String(v)) : String(v);
    case 'percent': return typeof v === 'number' ? `${v}%` : String(v);
    case 'date': return fmtDate(v);
    case 'datetime': return fmtDate(v, true);
    default: return String(v);
  }
}
export const totalsRow = (r: ReportResult) => r.columns.some((c) => c.total)
  ? Object.fromEntries(r.columns.map((c, i) => [c.key, c.total ? r.rows.reduce((s, row) => s + (Number(row[c.key]) || 0), 0) : i === 0 ? 'TOTAL' : '']))
  : null;

export function toCsv(r: ReportResult) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [r.columns.map((c) => esc(c.label)).join(',')];
  for (const row of r.rows) lines.push(r.columns.map((c) => {
    const v = row[c.key];
    return esc(c.type === 'money' || c.type === 'number' ? (v ?? '').toString() : cellText(c, v));
  }).join(','));
  const t = totalsRow(r);
  if (t) lines.push(r.columns.map((c) => esc(String(t[c.key] ?? ''))).join(','));
  return '﻿' + lines.join('\r\n'); // BOM so Excel opens UTF-8 (₹, names) correctly
}

export async function toXlsx(r: ReportResult, meta: ReportMeta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SportsIQ';
  wb.created = new Date();
  const ws = wb.addWorksheet(meta.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 5 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const n = r.columns.length;
  ws.mergeCells(1, 1, 1, n);
  ws.getCell(1, 1).value = `${meta.league} — ${meta.title}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).value = [meta.period && `Period: ${meta.period}`, `Generated ${new Date().toLocaleString('en-IN')} by ${meta.generatedBy}`, 'SportsIQ'].filter(Boolean).join('  ·  ');
  ws.getCell(2, 1).font = { size: 9, color: { argb: 'FF64748B' } };
  if (r.summary?.length) {
    ws.mergeCells(3, 1, 3, n);
    ws.getCell(3, 1).value = r.summary.map((s) => `${s.label}: ${s.type === 'money' && typeof s.value === 'number' ? '₹' + inGroups(s.value) : s.value}`).join('   |   ');
    ws.getCell(3, 1).font = { bold: true, size: 10 };
  }
  const header = ws.getRow(5);
  r.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle', horizontal: c.type && c.type !== 'text' ? 'right' : 'left', wrapText: true };
    ws.getColumn(i + 1).width = c.width ?? Math.min(40, Math.max(10, c.label.length + 4));
  });
  header.height = 22;
  const inrFmt = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
  const write = (rowIdx: number, data: Record<string, unknown>, bold = false) => {
    const row = ws.getRow(rowIdx);
    r.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = data[c.key];
      if (v === null || v === undefined || v === '') return;
      if ((c.type === 'date' || c.type === 'datetime') && !isNaN(+new Date(v as string))) { cell.value = new Date(v as string); cell.numFmt = c.type === 'date' ? 'dd-mmm-yyyy' : 'dd-mmm-yyyy hh:mm'; }
      else if (c.type === 'money' && typeof v === 'number') { cell.value = v; cell.numFmt = inrFmt; }
      else if (c.type === 'percent' && typeof v === 'number') { cell.value = v / 100; cell.numFmt = '0.0%'; }
      else cell.value = typeof v === 'number' ? v : String(v);
      if (bold) cell.font = { bold: true };
      cell.alignment = { vertical: 'top', wrapText: c.type === 'text' || !c.type };
    });
    if (rowIdx % 2 === 0 && !bold) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  };
  r.rows.forEach((row, i) => write(6 + i, row, !!row._bold));
  const t = totalsRow(r);
  if (t) { write(6 + r.rows.length, t, true); ws.getRow(6 + r.rows.length).eachCell((c) => { c.border = { top: { style: 'thin' } }; }); }
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: n } };
  r.notes?.forEach((note, i) => { const cell = ws.getCell(8 + r.rows.length + i, 1); cell.value = note; cell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } }; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPdf(r: ReportResult, meta: ReportMeta): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: `${meta.league} — ${meta.title}`, Author: 'SportsIQ' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const left = 36, width = doc.page.width - 72;
    const weights = r.columns.map((c) => c.width ?? 12);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const colW = weights.map((w) => (w / totalW) * width);
    const fs = r.columns.length > 9 ? 7 : 8;

    const pageHeader = () => {
      doc.rect(0, 0, doc.page.width, 6).fill('#1d4ed8');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(15).text(meta.title, left, 22, { width: width * 0.7 });
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(meta.league + (meta.period ? `  ·  ${meta.period}` : ''), left, 42, { width: width * 0.7 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1d4ed8').text('SPORTS', left + width - 90, 24, { continued: true }).fillColor('#f59e0b').text('IQ');
      doc.y = 64;
    };
    const tableHeader = () => {
      const y = doc.y;
      doc.rect(left, y, width, 18).fill('#1d4ed8');
      let x = left;
      doc.font('Helvetica-Bold').fontSize(fs).fillColor('#ffffff');
      r.columns.forEach((c, i) => { doc.text(c.label.replace(/₹/g, 'Rs.'), x + 3, y + 5, { width: colW[i] - 6, align: c.type && c.type !== 'text' ? 'right' : 'left', lineBreak: false, ellipsis: true }); x += colW[i]; });
      doc.y = y + 18;
    };
    const drawRow = (row: Record<string, unknown>, idx: number, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
      const texts = r.columns.map((c) => cellText(c, row[c.key], 'Rs.').replace(/₹/g, 'Rs.').replace(/→/g, '->').replace(/[✓]/g, 'Y').replace(/[✗]/g, 'N').replace(/[•]/g, '*'));
      const h = Math.max(14, ...texts.map((t, i) => doc.heightOfString(t, { width: colW[i] - 6 }) + 6));
      if (doc.y + h > doc.page.height - 40) { doc.addPage(); pageHeader(); tableHeader(); doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs); }
      const y = doc.y;
      if (bold) doc.rect(left, y, width, h).fill('#e2e8f0');
      else if (idx % 2) doc.rect(left, y, width, h).fill('#f8fafc');
      doc.fillColor('#0f172a');
      let x = left;
      texts.forEach((t, i) => { const c = r.columns[i]; doc.text(t, x + 3, y + 3, { width: colW[i] - 6, align: c.type && c.type !== 'text' ? 'right' : 'left' }); x += colW[i]; });
      doc.y = y + h;
    };

    pageHeader();
    if (r.summary?.length) {
      const boxW = Math.min(170, width / r.summary.length - 8);
      const y = doc.y;
      r.summary.forEach((s, i) => {
        const x = left + i * (boxW + 8);
        doc.roundedRect(x, y, boxW, 38, 4).lineWidth(0.5).stroke('#e2e8f0');
        doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(s.label.toUpperCase(), x + 8, y + 7, { width: boxW - 16 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(s.type === 'money' && typeof s.value === 'number' ? `Rs.${inGroups(s.value)}` : String(s.value), x + 8, y + 18, { width: boxW - 16 });
      });
      doc.y = y + 50;
    }
    tableHeader();
    if (!r.rows.length) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No data for this report yet.', left, doc.y + 10);
    r.rows.forEach((row, i) => drawRow(row, i, !!row._bold));
    const t = totalsRow(r);
    if (t) drawRow(t, 0, true);
    if (r.notes?.length) { doc.moveDown(); doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b'); r.notes.forEach((n) => doc.text(n, left, doc.y, { width })); }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(`Generated ${new Date().toLocaleString('en-IN')} by ${meta.generatedBy} · SportsIQ`, left, doc.page.height - 26, { width: width / 2, lineBreak: false });
      doc.text(`Page ${i + 1} of ${range.count}`, left + width / 2, doc.page.height - 26, { width: width / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
