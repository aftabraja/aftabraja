import { Copy, MailCheck } from 'lucide-react';
import { Button, Modal } from './ui';

/** Shown after inviting a team owner / staff member */
export function CredentialsModal({ data, onClose }: { data: { user: { name: string; email: string }; inviteUrl: string | null; emailed?: boolean } | null; onClose: () => void }) {
  if (!data) return null;
  return (
    <Modal open onClose={onClose} title="Invitation sent" size="sm" footer={<Button onClick={onClose}>Done</Button>}>
      {data.emailed ? (
        <p className="flex gap-2 text-sm text-ink-700"><MailCheck className="h-5 w-5 shrink-0 text-emerald-600" />We emailed <b>{data.user.name}</b> ({data.user.email}) a link to set their password. It's valid for 7 days.</p>
      ) : data.inviteUrl ? (
        <>
          <p className="text-sm text-ink-700">Email delivery isn't configured yet, so share this one-time invitation link with <b>{data.user.name}</b> securely. It's valid for 7 days.</p>
          <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-ink-50 p-3 text-xs">{data.inviteUrl}</pre>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigator.clipboard?.writeText(data.inviteUrl!)}><Copy className="h-3.5 w-3.5" />Copy link</Button>
        </>
      ) : <p className="text-sm text-ink-700"><b>{data.user.name}</b> already has a SportsIQ account and has been added. They've been notified.</p>}
    </Modal>
  );
}
