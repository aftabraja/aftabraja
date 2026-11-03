import { Copy } from 'lucide-react';
import { Button, Modal } from './ui';

/** Shown after creating an account for someone else (team owner / staff) */
export function CredentialsModal({ data, onClose }: { data: { user: { name: string; email: string }; tempPassword: string | null } | null; onClose: () => void }) {
  if (!data) return null;
  const text = `SportsIQ login\nURL: ${window.location.origin}/login\nEmail: ${data.user.email}\nTemporary password: ${data.tempPassword}`;
  return (
    <Modal open onClose={onClose} title="Account ready" size="sm" footer={<Button onClick={onClose}>Done</Button>}>
      {data.tempPassword ? (
        <>
          <p className="text-sm text-ink-700">An account was created for <b>{data.user.name}</b>. Share these login details securely — they should change the password after first login.</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs">{text}</pre>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigator.clipboard?.writeText(text)}><Copy className="h-3.5 w-3.5" />Copy</Button>
        </>
      ) : <p className="text-sm text-ink-700"><b>{data.user.name}</b> already has a SportsIQ account and has been added. They've been notified.</p>}
    </Modal>
  );
}
