import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from './ui';

/** Compliance summary chip shown to leagues (never exposes the document files) */
export function ComplianceBadge({ c }: { c?: { compliant: boolean; missing: number } | null }) {
  if (!c) return null;
  return c.compliant
    ? <Badge color="green"><ShieldCheck className="mr-1 inline h-3 w-3" />Docs verified</Badge>
    : <Badge color="amber"><ShieldAlert className="mr-1 inline h-3 w-3" />{c.missing} doc{c.missing === 1 ? '' : 's'} pending</Badge>;
}

