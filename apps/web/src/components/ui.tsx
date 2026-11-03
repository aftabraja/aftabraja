import { clsx } from 'clsx';
import { Loader2, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const cx = clsx;

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({ variant = 'primary', size = 'md', loading, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' && 'h-8 px-3 text-xs', size === 'md' && 'h-10 px-4 text-sm', size === 'lg' && 'h-12 px-6 text-base',
        variant === 'primary' && 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus:ring-brand-100',
        variant === 'secondary' && 'border border-ink-200 bg-white text-ink-700 shadow-sm hover:bg-ink-50 focus:ring-ink-100',
        variant === 'ghost' && 'text-ink-700 hover:bg-ink-100 focus:ring-ink-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-100',
        variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-100',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }: { label?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx('input', className)} />;
export function Select({ className, options, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...p} className={cx('input pr-8', className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Card({ className, children, title, action, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <div className={cx('card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {action}
        </div>
      )}
      <div className={cx(padded && 'p-5')}>{children}</div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  gray: 'bg-ink-100 text-ink-700 ring-ink-200', blue: 'bg-brand-50 text-brand-700 ring-brand-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
export const Badge = ({ color = 'gray', children, className }: { color?: keyof typeof BADGE | string; children: ReactNode; className?: string }) => (
  <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE[color] ?? BADGE.gray, className)}>{children}</span>
);

export const STATUS_COLOR: Record<string, string> = {
  DONE: 'green', IN_PROGRESS: 'amber', NOT_STARTED: 'gray', SKIPPED: 'violet',
  OPEN: 'blue', IN_DISCUSSION: 'amber', SOLD: 'green', CLOSED: 'gray',
  PAID: 'green', PENDING: 'amber', PARTIAL: 'blue',
  APPLIED: 'gray', SHORTLISTED: 'blue', REJECTED: 'red', UNSOLD: 'amber',
  DRAFT: 'gray', PLANNING: 'blue', REGISTRATION_OPEN: 'violet', LIVE: 'green', COMPLETED: 'gray', CANCELLED: 'red',
  ACTIVE: 'green', TRIAL: 'amber', EXPIRED: 'red',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge color={STATUS_COLOR[status] ?? 'gray'}>{status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Badge>;

export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'green' | 'red' }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div className={cx('h-full rounded-full transition-all', tone === 'brand' && 'bg-brand-600', tone === 'green' && 'bg-emerald-500', tone === 'red' && 'bg-red-500')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'green' | 'red' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</div>}
      </div>
      <p className={cx('mt-2 text-2xl font-bold tracking-tight', tone === 'green' && 'text-emerald-600', tone === 'red' && 'text-red-600')}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs font-medium text-ink-500">{breadcrumb}</div>}
        <h1 className="truncate text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', size === 'sm' && 'sm:max-w-md', size === 'md' && 'sm:max-w-lg', size === 'lg' && 'sm:max-w-2xl', size === 'xl' && 'sm:max-w-4xl')}>
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-ink-100 p-3 text-ink-500">{icon}</div>}
      <p className="font-semibold text-ink-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Spinner = ({ className }: { className?: string }) => (
  <div className={cx('flex items-center justify-center py-16 text-ink-400', className)}><Loader2 className="h-6 w-6 animate-spin" /></div>
);

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-ink-100">
        <thead className="bg-ink-50/70"><tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition', value === t.value ? 'border-brand-700 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-900')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size }} className={cx('shrink-0 rounded-lg border border-ink-200 bg-white object-contain', className)} />
  ) : (
    <div style={{ width: size, height: size, fontSize: size * 0.38 }} className={cx('flex shrink-0 items-center justify-center rounded-lg bg-brand-50 font-bold text-brand-700', className)}>{ini}</div>
  );
}

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{(error as Error).message}</div> : null;
