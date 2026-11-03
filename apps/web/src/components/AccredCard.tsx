/** Accreditation card — CR80 / ID-1 size (54 × 85.6 mm), rendered in mm so it prints at true size. */
export interface CardData {
  name: string; organisation?: string | null; designation?: string | null; photoUrl?: string | null; cardNo: number; code: string; version: number;
  zones: string[]; validFrom?: string | null; validTo?: string | null; idLast4?: string | null;
  category: { name: string; letter: string; color: string };
}
interface Brand { name: string; shortCode?: string | null; logoUrl?: string | null; primaryColor?: string | null }
const d = (x?: string | null) => (x ? new Date(x).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const qr = (a: CardData, origin: string) => `${origin}/api/qr?data=${encodeURIComponent(`${a.code}.${a.version}`)}`;

export function CardFront({ a, brand, zones, sponsorLogoUrl, showIdLast4, origin = '' }: { a: CardData; brand: Brand; zones: { code: string }[]; sponsorLogoUrl?: string | null; showIdLast4?: boolean; origin?: string }) {
  const c = a.category.color;
  return (
    <div style={{ width: '54mm', height: '85.6mm', fontFamily: 'Inter, Arial, sans-serif', border: '0.2mm solid #e2e8f0', borderRadius: '3mm', overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', color: '#0f172a' }}>
      <div style={{ background: brand.primaryColor || '#1d4ed8', color: '#fff', padding: '2mm 2.5mm', display: 'flex', alignItems: 'center', gap: '2mm' }}>
        {brand.logoUrl && <img src={brand.logoUrl} alt="" style={{ width: '8mm', height: '8mm', objectFit: 'contain', background: '#fff', borderRadius: '1mm' }} />}
        <div style={{ lineHeight: 1.1, minWidth: 0 }}>
          <div style={{ fontSize: '2.6mm', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand.name}</div>
          <div style={{ fontSize: '1.7mm', letterSpacing: '0.4mm', opacity: 0.85 }}>OFFICIAL ACCREDITATION</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '2mm', padding: '2.5mm 2.5mm 1.5mm' }}>
        <div style={{ width: '20mm', height: '25mm', border: '0.3mm solid #cbd5e1', borderRadius: '1mm', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8mm', color: '#94a3b8' }}>
          {a.photoUrl ? <img src={a.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'PHOTO'}
        </div>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '3.1mm', fontWeight: 800, lineHeight: 1.1, wordBreak: 'break-word' }}>{a.name}</div>
            {a.organisation && <div style={{ fontSize: '2mm', marginTop: '0.8mm', color: '#334155', fontWeight: 600 }}>{a.organisation}</div>}
            {a.designation && <div style={{ fontSize: '1.9mm', color: '#64748b' }}>{a.designation}</div>}
          </div>
          <img src={qr(a, origin)} alt="" style={{ width: '13mm', height: '13mm', alignSelf: 'flex-end' }} />
        </div>
      </div>
      <div style={{ background: c, color: '#fff', padding: '1.2mm 2.5mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '2.4mm', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2mm' }}>{a.category.name}</span>
        <span style={{ fontSize: '5mm', fontWeight: 900, lineHeight: 1 }}>{a.category.letter}</span>
      </div>
      <div style={{ padding: '1.5mm 2.5mm 0', flex: 1 }}>
        <div style={{ fontSize: '1.6mm', color: '#64748b', fontWeight: 700, letterSpacing: '0.3mm' }}>ACCESS ZONES</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8mm', marginTop: '0.8mm' }}>
          {zones.map((z) => {
            const ok = a.zones.includes(z.code);
            return <span key={z.code} style={{ width: '4.6mm', height: '4.6mm', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4mm', fontWeight: 900, borderRadius: '0.8mm', background: ok ? '#0f172a' : '#fff', color: ok ? '#fff' : '#cbd5e1', border: `0.25mm solid ${ok ? '#0f172a' : '#e2e8f0'}`, textDecoration: ok ? 'none' : 'line-through' }}>{z.code}</span>;
          })}
        </div>
      </div>
      <div style={{ padding: '1.2mm 2.5mm 1.8mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', fontSize: '1.6mm', color: '#475569' }}>
        <div>
          <div><b>No.</b> {a.cardNo}{a.version > 1 ? ` · v${a.version}` : ''}{showIdLast4 && a.idLast4 ? ` · ID ••${a.idLast4}` : ''}</div>
          <div><b>Valid</b> {d(a.validFrom)} – {d(a.validTo)}</div>
        </div>
        {sponsorLogoUrl && <img src={sponsorLogoUrl} alt="" style={{ height: '5mm', maxWidth: '14mm', objectFit: 'contain' }} />}
      </div>
    </div>
  );
}

export function CardBack({ a, brand, zones, backText }: { a: CardData; brand: Brand; zones: { code: string; name: string }[]; backText: string }) {
  return (
    <div style={{ width: '54mm', height: '85.6mm', fontFamily: 'Inter, Arial, sans-serif', border: '0.2mm solid #e2e8f0', borderRadius: '3mm', overflow: 'hidden', background: '#fff', padding: '3mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: '#0f172a' }}>
      <div style={{ fontSize: '2.2mm', fontWeight: 800, color: brand.primaryColor || '#1d4ed8' }}>ZONE GUIDE</div>
      <div style={{ marginTop: '1mm' }}>
        {zones.map((z) => (
          <div key={z.code} style={{ display: 'flex', gap: '1.5mm', alignItems: 'center', fontSize: '1.75mm', lineHeight: 1.35, color: a.zones.includes(z.code) ? '#0f172a' : '#94a3b8' }}>
            <span style={{ width: '3.6mm', textAlign: 'center', fontWeight: 900 }}>{z.code}</span><span>{z.name}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', fontSize: '1.65mm', lineHeight: 1.35, color: '#334155' }}>{backText}</div>
      <div style={{ marginTop: '1.5mm', borderTop: '0.2mm solid #e2e8f0', paddingTop: '1mm', fontSize: '1.5mm', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>{brand.shortCode || brand.name}</span><span>No. {a.cardNo} · v{a.version}</span>
      </div>
    </div>
  );
}
