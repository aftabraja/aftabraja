export const inr = (n?: number | null) =>
  n == null ? '—' : (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN');

/** Compact Indian notation: ₹12.5 L, ₹1.2 Cr */
export const inrShort = (n?: number | null) => {
  if (n == null) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)} L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(0)}K`;
  return `${sign}₹${a}`;
};

export const date = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const ago = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
};

export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', LEAGUE_OWNER: 'League Owner', LEAGUE_STAFF: 'League Management', TEAM_OWNER: 'Team Owner',
  PLAYER: 'Player', VENDOR: 'Vendor', SPONSOR: 'Sponsor', TALENT_AGENT: 'Agency / Manager',
};

export const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
