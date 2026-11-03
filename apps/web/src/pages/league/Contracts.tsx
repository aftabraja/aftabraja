import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, FileSignature, Printer, Save, Scale, ShieldAlert, Store, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago } from '../../lib/format';
import { Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Textarea } from '../../components/ui';
import { useVendorPanel } from '../../components/VendorPanel';

export function LegalNotice({ text }: { text?: string }) {
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">Please verify with a qualified lawyer before use</p>
        <p className="mt-1">{text ?? 'SportsIQ contract templates are generic starting points provided for convenience only. They are not legal advice and may not suit your situation or comply with applicable law. Always have every agreement reviewed by a qualified lawyer before signing. SportsIQ is not a party to these agreements and accepts no liability for their use.'}</p>
      </div>
    </div>
  );
}

export function ContractList() {
  const { leagueId } = useLeague();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const tpl = useQuery({ queryKey: ['contract-templates'], queryFn: () => get(`/leagues/${leagueId}/studio/contracts/templates`) });
  const list = useQuery({ queryKey: ['contracts', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/studio/contracts`) });
  const [pick, setPick] = useState<any>(null);
  const [counterparty, setCounterparty] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/studio/contracts`, { templateKey: pick.key, counterparty, values }), onSuccess: (c) => nav(`/leagues/${leagueId}/contracts/${c.id}`) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/studio/contracts/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', leagueId] }) });

  return (
    <>
      <PageHeader title="Legal Contracts" subtitle="Editable agreement templates for every league relationship — or hire a sports lawyer from the marketplace."
        actions={<Button variant="secondary" onClick={() => openVendors('sports-lawyer', leagueId)}><Scale className="h-4 w-4" />Find legal vendors</Button>} />
      <LegalNotice text={tpl.data?.disclaimer} />
      <p className="label">Templates</p>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tpl.data?.templates.map((t: any) => (
          <button key={t.key} onClick={() => { setPick(t); setCounterparty(''); setValues({ governing_law: 'India', cure_days: '15', agreement_date: new Date().toISOString().slice(0, 10) }); }} className="card p-5 text-left transition hover:border-brand-200 hover:shadow-pop">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><FileSignature className="h-5 w-5" /></div>
            <p className="font-semibold">{t.title}</p>
            <p className="mt-1 text-xs text-ink-500">{t.description}</p>
          </button>
        ))}
      </div>
      <Card title="League contracts" padded={false}>
        {list.isLoading ? <Spinner /> : (
          <Table head={['Contract', 'Counterparty', 'Status', 'Updated', '']} empty={!list.data?.length && <Empty icon={<FileSignature className="h-5 w-5" />} title="No contracts yet" text="Choose a template above to draft one." />}>
            {list.data?.map((c) => (
              <tr key={c.id}>
                <td className="td"><Link to={`/leagues/${leagueId}/contracts/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">{c.title}</Link></td>
                <td className="td">{c.counterparty ?? '—'}</td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td">{ago(c.updatedAt)}</td>
                <td className="td text-right"><div className="flex justify-end gap-1"><Link to={`/leagues/${leagueId}/contracts/${c.id}`}><Button size="sm" variant="secondary">Open</Button></Link><button onClick={() => confirm('Delete contract?') && remove.mutate(c.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!pick} onClose={() => setPick(null)} size="lg" title={pick?.title} footer={<><Button variant="secondary" onClick={() => setPick(null)}>Cancel</Button><Button disabled={!counterparty} loading={create.isPending} onClick={() => create.mutate()}>Create draft</Button></>}>
        <ErrorText error={create.error} />
        <p className="mb-4 text-sm text-ink-500">Fill what you know — anything left blank appears as a [PLACEHOLDER] you can edit later.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={pick?.counterpartyLabel} className="sm:col-span-2"><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></Field>
          {pick?.fields.map((f: any) => <Field key={f.key} label={f.label}><Input type={f.type ?? 'text'} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} /></Field>)}
        </div>
      </Modal>
    </>
  );
}

export function ContractEditor() {
  const { leagueId } = useLeague();
  const { contractId } = useParams();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const c = useQuery({ queryKey: ['contract', contractId], queryFn: () => get(`/leagues/${leagueId}/studio/contracts/${contractId}`) });
  const [body, setBody] = useState<string | null>(null);
  const [status, setStatus] = useState('DRAFT');
  useEffect(() => { if (c.data && body === null) { setBody(c.data.body); setStatus(c.data.status); } }, [c.data, body]);
  const save = useMutation({ mutationFn: (extra: object = {}) => patch(`/leagues/${leagueId}/studio/contracts/${contractId}`, { body, status, ...extra }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contract', contractId] }); qc.invalidateQueries({ queryKey: ['contracts', leagueId] }); } });
  if (c.isLoading || body === null) return <Spinner />;
  const ack = !!c.data.acknowledgedAt;
  const full = `${c.data.disclaimer}\n\n${'-'.repeat(60)}\n\n${body}\n\n${'-'.repeat(60)}\n${c.data.disclaimer}`;
  const esc = (t: string) => t.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[x]!);
  const docHtml = `<html><head><meta charset="utf-8"><title>${esc(c.data.title)}</title></head><body style="font-family:Arial;font-size:12pt;line-height:1.5"><p style="border:1px solid #d97706;background:#fffbeb;padding:8px;font-size:10pt"><b>${esc(c.data.disclaimer)}</b></p><pre style="white-space:pre-wrap;font-family:Arial">${esc(body)}</pre><p style="font-size:9pt;color:#666">${esc(c.data.disclaimer)}</p></body></html>`;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([docHtml], { type: 'application/msword' })); a.download = `${c.data.title.replace(/[^\w]+/g, '_')}.doc`; a.click(); };
  const print = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(docHtml); w.document.close(); setTimeout(() => w.print(), 300); };

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/contracts`} className="hover:underline">Legal Contracts</Link>} title={c.data.title}
        actions={<>
          <Button variant="secondary" onClick={() => openVendors('sports-lawyer', leagueId)}><Store className="h-4 w-4" />Get it reviewed by a lawyer</Button>
          <Button loading={save.isPending} onClick={() => save.mutate({})}><Save className="h-4 w-4" />Save</Button>
        </>} />
      <LegalNotice text={c.data.disclaimer} />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card padded={false}><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[65vh] rounded-xl border-0 font-mono text-[13px] leading-relaxed shadow-none focus:ring-0" /></Card>
        <div className="space-y-4">
          <Card title="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['DRAFT', 'UNDER_LEGAL_REVIEW', 'SENT', 'SIGNED', 'ARCHIVED'].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
            <p className="mt-2 text-xs text-ink-500">Recommended flow: Draft → Under legal review → Sent → Signed.</p>
          </Card>
          <Card title="Export">
            {!ack ? (
              <label className="flex gap-2 text-sm text-ink-700">
                <input type="checkbox" className="mt-1" onChange={(e) => e.target.checked && save.mutate({ acknowledge: true })} />
                I understand this is a template, not legal advice, and I will have it verified by a qualified lawyer before signing.
              </label>
            ) : <p className="text-xs text-emerald-700">Legal notice acknowledged.</p>}
            <div className="mt-4 space-y-2">
              <Button className="w-full" variant="secondary" disabled={!ack} onClick={download}><FileDown className="h-4 w-4" />Download Word (.doc)</Button>
              <Button className="w-full" variant="secondary" disabled={!ack} onClick={print}><Printer className="h-4 w-4" />Print / save PDF</Button>
              <Button className="w-full" variant="ghost" disabled={!ack} onClick={() => navigator.clipboard?.writeText(full)}>Copy text</Button>
            </div>
            <p className="mt-3 text-[11px] text-ink-500">Exports always include the legal notice.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
