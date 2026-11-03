import PDFDocument from 'pdfkit';
import type { Invoice } from '@prisma/client';
import { prisma } from './prisma.js';
import { financialYear, gstSplit, inWords, PLATFORM } from './gst.js';

/** Creates the tax invoice for a paid subscription (idempotent per payment) */
export async function issueSubscriptionInvoice(paymentId: string) {
  const existing = await prisma.invoice.findUnique({ where: { paymentId } });
  if (existing) return existing;
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: p.refId! }, include: { user: true } });
  const bill = await prisma.billingProfile.findUnique({ where: { userId: sub.userId } });
  const billState = bill?.state ?? PLATFORM().state;
  const split = gstSplit(sub.amount, billState);
  const fy = financialYear();
  // Sequential numbering per financial year (required for GST invoices)
  return prisma.$transaction(async (tx) => {
    const count = await tx.invoice.count({ where: { number: { startsWith: `SIQ/${fy}/` } } });
    return tx.invoice.create({
      data: {
        number: `SIQ/${fy}/${String(count + 1).padStart(5, '0')}`, userId: sub.userId, paymentId, sac: PLATFORM().sac,
        description: `SportsIQ ${sub.plan.replace('_', ' ').toLowerCase()} plan — 12 months`,
        taxable: sub.amount, ...split, billName: bill?.name ?? sub.user.name, billGstin: bill?.gstin ?? null, billState, billAddress: bill?.address ?? null,
      },
    });
  });
}

export function invoicePdf(inv: Invoice): Promise<Buffer> {
  return new Promise((resolve) => {
    const P = PLATFORM();
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`;
    doc.rect(0, 0, doc.page.width, 8).fill('#1d4ed8');
    doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(18).text('SPORTS', 48, 36, { continued: true }).fillColor('#f59e0b').text('IQ');
    doc.fillColor('#0f172a').fontSize(16).text('TAX INVOICE', 48, 36, { align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    doc.text(P.name, 48, 66).text(P.address).text(`GSTIN: ${P.gstin || 'not set'} · State: ${P.state}`);
    doc.text(`Invoice no: ${inv.number}`, 330, 66, { align: 'right' }).text(`Date: ${inv.issuedAt.toLocaleDateString('en-IN')}`, { align: 'right' }).text(`Place of supply: ${inv.billState}`, { align: 'right' });
    doc.moveDown(2);
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor('#0f172a').text('Bill to', 48, y);
    doc.font('Helvetica').fillColor('#334155').text(inv.billName).text(inv.billAddress ?? '').text(inv.billGstin ? `GSTIN: ${inv.billGstin}` : 'Unregistered (B2C)').text(`State: ${inv.billState}`);
    doc.moveDown(1.5);
    const top = doc.y;
    const cols = [48, 300, 370, 470];
    doc.rect(48, top, doc.page.width - 96, 20).fill('#1d4ed8');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
    ['Description', 'SAC', 'Qty', 'Taxable value'].forEach((h, i) => doc.text(h, cols[i] + 6, top + 6, { width: i === 3 ? 70 : 240, align: i === 3 ? 'right' : 'left' }));
    doc.fillColor('#0f172a').font('Helvetica').text(inv.description, cols[0] + 6, top + 28, { width: 240 });
    doc.text(inv.sac, cols[1] + 6, top + 28).text('1', cols[2] + 6, top + 28).text(rs(inv.taxable), cols[3] + 6, top + 28, { width: 70, align: 'right' });
    let ty = top + 60;
    const line = (label: string, v: number, bold = false) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, ty).text(rs(v), cols[3] + 6, ty, { width: 70, align: 'right' }); ty += 16; };
    doc.moveTo(48, ty - 8).lineTo(doc.page.width - 48, ty - 8).strokeColor('#e2e8f0').stroke();
    line('Taxable value', inv.taxable);
    if (inv.igst) line(`IGST`, inv.igst); else { line(`CGST`, inv.cgst); line(`SGST`, inv.sgst); }
    line('Total', inv.total, true);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`Amount in words: Rupees ${inWords(inv.total)} only`, 48, ty + 10);
    doc.text('Payment received online. This is a computer-generated invoice and does not require a signature.', 48, ty + 30);
    doc.end();
  });
}
