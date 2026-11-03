import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpError } from './http.js';

/**
 * File storage. Local disk by default (served at /files), or S3-compatible storage when
 * S3_BUCKET is set (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO).
 */
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };

let s3: S3Client | null = null;
const useS3 = () => !!process.env.S3_BUCKET;
const client = () => (s3 ??= new S3Client({ region: process.env.S3_REGION ?? 'auto', endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT }));

export async function saveDataUrl(dataUrl: string, folder = 'misc') {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new HttpError(400, 'Invalid file data');
  const [, mime, b64] = m;
  const ext = TYPES[mime];
  if (!ext) throw new HttpError(400, `File type ${mime} is not allowed`);
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(413, `File is larger than ${MAX_BYTES / 1024 / 1024} MB`);
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(16).toString('hex')}.${ext}`;
  if (useS3()) {
    await client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buf, ContentType: mime, CacheControl: 'public, max-age=31536000, immutable' }));
    return `${(process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '')}/${key}`;
  }
  const full = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
  return `/files/${key}`;
}

/**
 * Converts any base64 data-URL string in a JSON request body into a stored file URL,
 * so uploads from every screen land in file storage instead of the database.
 */
export function persistUploads(req: Request, _res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object' || req.method === 'GET') return next();
  const folder = (req.originalUrl.split('?')[0].split('/')[2] ?? 'misc').replace(/[^a-z]/g, '') || 'misc';
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === 'string') return v.startsWith('data:') && v.length > 100 ? saveDataUrl(v, folder) : v;
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) o[k] = await walk(o[k]);
      return o;
    }
    return v;
  };
  walk(req.body).then(() => next(), next);
}
