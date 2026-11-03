import { useQuery } from '@tanstack/react-query';
import { FileText, Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { Card, Empty, PageHeader, Spinner, Table } from '../../components/ui';

/** Central file library: every document uploaded against a playbook step */
export default function Documents() {
  const { leagueId } = useLeague();
  const pb = useQuery({ queryKey: ['playbook', leagueId], queryFn: () => get(`/leagues/${leagueId}/playbook`) });
  if (pb.isLoading) return <Spinner />;
  const rows = pb.data.phases.flatMap((p: any) => p.steps.flatMap((s: any) => s.attachments.map((a: string, i: number) => ({ phase: p.title, step: s, url: a, i }))));
  return (
    <>
      <PageHeader title="Documents" subtitle="Contracts, permissions, NOCs, brand guidelines and every file uploaded through the playbook." />
      <Card padded={false}>
        <Table head={['Document', 'Step', 'Phase', '']} empty={!rows.length && <Empty icon={<FileText className="h-5 w-5" />} title="No documents yet" text="Upload files from the relevant playbook step — they'll all appear here." />}>
          {rows.map((r: any, k: number) => (
            <tr key={k}>
              <td className="td"><span className="flex items-center gap-2 font-medium text-ink-900"><Paperclip className="h-4 w-4 text-ink-400" />{r.step.title} — file {r.i + 1}</span></td>
              <td className="td"><Link to={`/leagues/${leagueId}/playbook#${r.step.key}`} className="text-brand-700 hover:underline">{r.step.title}</Link></td>
              <td className="td">{r.phase}</td>
              <td className="td text-right"><a href={r.url} download={`${r.step.key}-${r.i + 1}`} className="text-xs font-semibold text-brand-700 hover:underline">Download</a></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
