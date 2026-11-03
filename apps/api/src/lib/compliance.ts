/** Vendor compliance documents and what each category must hold */
export const DOC_TYPES: Record<string, string> = {
  PAN: 'PAN card', GST: 'GST registration', FSSAI: 'FSSAI food licence', TRADE_LICENSE: 'Trade / shop licence', INSURANCE: 'Insurance certificate',
  FIRE_NOC: 'Fire safety NOC', POLICE_NOC: 'Police verification / PSARA licence', MSME: 'MSME / Udyam certificate', OTHER: 'Other',
};

const BASE = ['PAN', 'GST'];
const BY_CATEGORY: Record<string, string[]> = {
  catering: ['FSSAI'], 'food-stalls': ['FSSAI'], 'water-beverages': ['FSSAI'],
  security: ['POLICE_NOC', 'INSURANCE'], medical: ['INSURANCE'], 'pyro-special-effects': ['FIRE_NOC', 'INSURANCE'],
  'fire-safety': ['FIRE_NOC'], 'temporary-structures': ['INSURANCE'], 'sound-stage': ['INSURANCE'], 'ground-transport': ['INSURANCE'],
  'stadium-ground': ['TRADE_LICENSE'], 'event-venue': ['TRADE_LICENSE'], hotels: ['TRADE_LICENSE'], 'lighting-power': ['INSURANCE'],
};

export function requiredDocs(categorySlugs: string[]) {
  return [...new Set([...BASE, ...categorySlugs.flatMap((c) => BY_CATEGORY[c] ?? [])])];
}

export interface DocLike { type: string; verified: boolean; expiresOn: Date | null }
/** Per required document: VALID (verified, not expired), PENDING (uploaded, not verified), EXPIRED, MISSING */
export function complianceStatus(required: string[], docs: DocLike[], now = new Date()) {
  const items = required.map((type) => {
    const d = docs.filter((x) => x.type === type).sort((a, b) => +(b.expiresOn ?? 8.64e15) - +(a.expiresOn ?? 8.64e15))[0];
    const status = !d ? 'MISSING' : d.expiresOn && d.expiresOn < now ? 'EXPIRED' : d.verified ? 'VALID' : 'PENDING';
    return { type, label: DOC_TYPES[type], status, expiresOn: d?.expiresOn ?? null };
  });
  return { items, compliant: items.every((i) => i.status === 'VALID'), missing: items.filter((i) => i.status !== 'VALID').length };
}

/** Which expiry alert (if any) is due for a date, given the last one sent */
export function expiryAlertDue(expiresOn: Date | null, lastLevel: string | null, now = new Date()): 'D30' | 'D7' | 'EXPIRED' | null {
  if (!expiresOn) return null;
  const days = (expiresOn.getTime() - now.getTime()) / 864e5;
  const level = days < 0 ? 'EXPIRED' : days <= 7 ? 'D7' : days <= 30 ? 'D30' : null;
  const rank = { D30: 1, D7: 2, EXPIRED: 3 } as const;
  if (!level) return null;
  return !lastLevel || rank[level] > rank[lastLevel as keyof typeof rank] ? level : null;
}

/** Compliance summary for a vendor, derived from its service categories (no file URLs — safe to show leagues) */
export async function vendorCompliance(vendorId: string) {
  const { prisma } = await import('./prisma.js');
  const [services, docs] = await Promise.all([
    prisma.vendorService.findMany({ where: { vendorId }, select: { category: { select: { slug: true } } } }),
    prisma.vendorDocument.findMany({ where: { vendorId }, select: { type: true, verified: true, expiresOn: true } }),
  ]);
  return complianceStatus(requiredDocs(services.map((s) => s.category.slug)), docs);
}

export async function vendorComplianceMap(vendorIds: string[]) {
  const out: Record<string, { compliant: boolean; missing: number }> = {};
  await Promise.all([...new Set(vendorIds)].map(async (id) => { const c = await vendorCompliance(id); out[id] = { compliant: c.compliant, missing: c.missing }; }));
  return out;
}
