import nodemailer from 'nodemailer';
import { prisma } from './prisma.js';

/**
 * Email delivery. Uses SMTP when SMTP_HOST is set; otherwise emails are written to the
 * EmailLog (visible to the Super Admin) and the server console, so nothing is silently lost.
 */
export const mailConfigured = () => !!process.env.SMTP_HOST;
const transport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});
export const appUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;font-weight:800;font-size:18px">SPORTS<span style="color:#1d4ed8">IQ</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1><div style="font-size:14px;line-height:1.6;color:#334155">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 8px"><a href="${cta.url}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#64748b;word-break:break-all">Or open: ${cta.url}</p>` : ''}
</td></tr><tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">You received this because of your SportsIQ account. SportsIQ — the league operating system.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!mailConfigured()) {
    console.log(`[email:logged] to=${to} subject="${subject}"`);
    await prisma.emailLog.create({ data: { to, subject, html, status: 'LOGGED' } });
    return { delivered: false };
  }
  try {
    await transport().sendMail({ from: process.env.MAIL_FROM ?? 'SportsIQ <no-reply@sportsiq.in>', to, subject, html });
    await prisma.emailLog.create({ data: { to, subject, html, status: 'SENT' } });
    return { delivered: true };
  } catch (e) {
    await prisma.emailLog.create({ data: { to, subject, html, status: 'FAILED', error: (e as Error).message } });
    return { delivered: false };
  }
}
