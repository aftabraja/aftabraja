import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { HttpError } from './http.js';

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Single-use token; only its hash is stored */
export async function issueToken(userId: string, purpose: 'RESET' | 'INVITE', hours: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({ data: { userId, purpose, tokenHash: hash(token), expiresAt: new Date(Date.now() + hours * 36e5) } });
  return token;
}

export async function consumeToken(token: string) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new HttpError(400, 'This link is invalid or has expired. Please request a new one.');
  await prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}
