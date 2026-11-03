import { Router } from 'express';
import { vendorCompliance } from '../lib/compliance.js';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { VENDOR_GROUPS } from '../data/vendorCategories.js';

const r = Router();
r.use(requireAuth);

// Full taxonomy with live vendor counts
r.get('/categories', ah(async (_req, res) => {
  const cats = await prisma.vendorCategory.findMany({ orderBy: { name: 'asc' }, include: { services: { select: { vendorId: true } } } });
  const items = cats.map(({ services, ...c }) => ({ ...c, vendorCount: new Set(services.map((s) => s.vendorId)).size }));
  res.json({ groups: VENDOR_GROUPS, categories: items });
}));

// Search vendors: ?q=&category=slug&city=&maxPrice=&sort=rating|price
r.get('/', ah(async (req, res) => {
  const q = z.object({
    q: z.string().optional(), category: z.string().optional(), city: z.string().optional(),
    maxPrice: z.coerce.number().optional(), verified: z.enum(['true', 'false']).optional(), sort: z.enum(['rating', 'price', 'new']).optional(),
  }).parse(req.query);
  const serviceFilter: Prisma.VendorServiceWhereInput = {
    ...(q.category && { category: { slug: q.category } }),
    ...(q.maxPrice && { OR: [{ priceMin: { lte: q.maxPrice } }, { priceMin: null }] }),
  };
  const where: Prisma.VendorProfileWhereInput = {
    user: { isActive: true },
    ...((q.category || q.maxPrice) && { services: { some: serviceFilter } }),
    ...(q.city && { OR: [{ city: { contains: q.city, mode: 'insensitive' } }, { serviceAreas: { has: q.city } }] }),
    ...(q.verified === 'true' && { verified: true }),
    ...(q.q && {
      AND: [{ OR: [
        { companyName: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { services: { some: { title: { contains: q.q, mode: 'insensitive' } } } },
        { services: { some: { category: { name: { contains: q.q, mode: 'insensitive' } } } } },
      ] }],
    }),
  };
  const vendors = await prisma.vendorProfile.findMany({
    where,
    take: 100,
    orderBy: q.sort === 'new' ? { createdAt: 'desc' } : [{ verified: 'desc' }, { rating: 'desc' }],
    include: { services: { include: { category: { select: { slug: true, name: true } } } }, user: { select: { id: true, name: true, email: true } } },
  });
  const out = vendors.map((v) => ({ ...v, startingPrice: Math.min(...v.services.map((s) => s.priceMin ?? Infinity)) }));
  if (q.sort === 'price') out.sort((a, b) => a.startingPrice - b.startingPrice);
  res.json(out.map((v) => ({ ...v, startingPrice: Number.isFinite(v.startingPrice) ? v.startingPrice : null })));
}));

// Vendor's own profile (must precede /:id)
r.get('/me/profile', requireRole('VENDOR'), ah(async (req, res) => {
  const v = await prisma.vendorProfile.findUnique({ where: { userId: me(req).id }, include: { services: { include: { category: true } } } });
  if (!v) throw new HttpError(404, 'Vendor profile not found');
  res.json(v);
}));

r.patch('/me/profile', requireRole('VENDOR'), ah(async (req, res) => {
  const d = z.object({
    companyName: z.string().min(2).optional(), description: z.string().optional().nullable(), city: z.string().optional().nullable(),
    state: z.string().optional().nullable(), serviceAreas: z.array(z.string()).optional(), gstNumber: z.string().optional().nullable(),
    website: z.string().optional().nullable(), phone: z.string().optional().nullable(), yearsInBusiness: z.coerce.number().int().optional().nullable(),
  }).parse(req.body);
  res.json(await prisma.vendorProfile.update({ where: { userId: me(req).id }, data: d }));
}));

const serviceSchema = z.object({
  categorySlug: z.string(), title: z.string().min(2), description: z.string().optional().nullable(),
  priceMin: z.coerce.number().int().optional().nullable(), priceMax: z.coerce.number().int().optional().nullable(), unit: z.string().optional().nullable(),
});

r.post('/me/services', requireRole('VENDOR'), ah(async (req, res) => {
  const { categorySlug, ...d } = serviceSchema.parse(req.body);
  const vendor = await prisma.vendorProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const cat = await prisma.vendorCategory.findUnique({ where: { slug: categorySlug } });
  if (!cat) throw new HttpError(400, 'Unknown category');
  res.status(201).json(await prisma.vendorService.create({ data: { ...d, vendorId: vendor.id, categoryId: cat.id } }));
}));

r.patch('/me/services/:sid', requireRole('VENDOR'), ah(async (req, res) => {
  const { categorySlug, ...d } = serviceSchema.partial().parse(req.body);
  const vendor = await prisma.vendorProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const cat = categorySlug ? await prisma.vendorCategory.findUnique({ where: { slug: categorySlug } }) : null;
  res.json(await prisma.vendorService.update({ where: { id: req.params.sid, vendorId: vendor.id }, data: { ...d, ...(cat && { categoryId: cat.id }) } }));
}));

r.delete('/me/services/:sid', requireRole('VENDOR'), ah(async (req, res) => {
  const vendor = await prisma.vendorProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  await prisma.vendorService.delete({ where: { id: req.params.sid, vendorId: vendor.id } });
  res.json({ ok: true });
}));

r.get('/:id', ah(async (req, res) => {
  const v = await prisma.vendorProfile.findUnique({
    where: { id: req.params.id },
    include: {
      services: { include: { category: true } }, user: { select: { id: true, name: true, email: true } },
      portfolio: { orderBy: { createdAt: 'desc' }, take: 12 }, reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { workOrders: { where: { status: 'COMPLETED' } } } },
    },
  });
  if (!v) throw new HttpError(404, 'Vendor not found');
  const c = await vendorCompliance(v.id);
  res.json({ ...v, compliance: { compliant: c.compliant, items: c.items.map(({ type, label, status, expiresOn }) => ({ type, label, status, expiresOn })) } });
}));

export default r;
