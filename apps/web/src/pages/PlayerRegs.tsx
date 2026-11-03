import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Trash2 } from 'lucide-react';
import { del, get, post } from '../lib/api';
import { checkout } from '../lib/pay';
import { inr } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Spinner, StatusBadge } from '../components/ui';
import { UploadButton } from './league/Procurement';

const KYC_COLOR: Record<string, string> = { PENDING: 'gray', SUBMITTED: 'amber', VERIFIED: 'green', REJECTED: 'red' };

/** Player portal: per-league registration fee, KYC documents and status */
export function PlayerRegistrations() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-regs'], queryFn: () => get('/players/registrations') });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['my-regs'] }); qc.invalidateQueries({ queryKey: ['my-player'] }); };
  const upload = useMutation({ mutationFn: ({ regId, type, fileUrl }: any) => post(`/players/registrations/${regId}/documents`, { type, fileUrl }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: ({ regId, id }: any) => del(`/players/registrations/${regId}/documents/${id}`), onSuccess: refresh });
  const pay = useMutation({ mutationFn: async (regId: string) => checkout(await post(`/players/registrations/${regId}/pay`, {})), onSuccess: refresh });
  if (q.isLoading) return <Card title="My registrations"><Spinner /></Card>;
  const { docTypes, registrations } = q.data;
  return (
    <Card title="My registrations" padded={false}>
      <ErrorText error={upload.error || remove.error || pay.error} />
      {!registrations.length ? <Empty title="Not registered yet" text="Register for an open league below." /> : (
        <ul className="divide-y divide-ink-100">
          {registrations.map((r: any) => (
            <li key={r.id} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar name={r.league.name} src={r.league.logoUrl} size={36} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.league.name}</p><p className="text-xs text-ink-500">{r.team ? `Picked by ${r.team.name}` : 'Awaiting selection'}</p></div>
                <StatusBadge status={r.status} />
              </div>
              {r.feeStatus && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span>Registration fee {inr(r.league.regFee)}</span>
                  {r.feeStatus === 'PENDING' ? <Button size="sm" loading={pay.isPending && pay.variables === r.id} onClick={() => pay.mutate(r.id)}><CreditCard className="h-3.5 w-3.5" />Pay now</Button> : <Badge color="green">{r.feeStatus.toLowerCase()}</Badge>}
                </div>
              )}
              {r.league.regDocs.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink-700">Documents <Badge color={KYC_COLOR[r.kycStatus]}>{r.kycStatus.toLowerCase()}</Badge></p>
                  <ul className="space-y-1.5">
                    {r.league.regDocs.map((t: string) => {
                      const d = r.documents.find((x: any) => x.type === t);
                      return (
                        <li key={t} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate">{docTypes[t]}{d?.status === 'REJECTED' && <span className="block text-red-700">Rejected: {d.note}</span>}</span>
                          {d && d.status !== 'REJECTED' ? (
                            <span className="flex items-center gap-1">{d.status === 'VERIFIED' ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />verified</> : <>under review<button onClick={() => remove.mutate({ regId: r.id, id: d.id })} className="p-1 text-ink-300 hover:text-red-600" aria-label="Remove"><Trash2 className="h-3 w-3" /></button></>}</span>
                          ) : <UploadButton label={d ? 'Re-upload' : 'Upload'} onAdd={(u) => upload.mutate({ regId: r.id, type: t, fileUrl: u[0] })} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
