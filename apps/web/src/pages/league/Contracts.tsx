import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, Clock, FileDown, FileSignature, Library, Plus, Printer, RotateCcw, Save, Scale, Send, Settings2, ShieldAlert, Store, Trash2, Undo2, XCircle } from 'lucide-react';
import { Attachments, UploadButton } from './Procurement';
import { del, get, patch, post, put } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago } from '../../lib/format';
import { Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Textarea } from '../../components/ui';
import { Comments } from '../../components/Comments';
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
  const [lib, setLib] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/studio/contracts`, { templateKey: pick.key, counterparty, values }), onSuccess: (c) => nav(`/leagues/${leagueId}/contracts/${c.id}`) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/studio/contracts/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts', leagueId] }) });

  return (
    <>
      <PageHeader title="Legal Contracts" subtitle="Editable agreement templates for every league relationship — or hire a sports lawyer from the marketplace."
        actions={<>
          <Button variant="secondary" onClick={() => setLib(true)}><Library className="h-4 w-4" />Clause library</Button>
          <Button variant="secondary" onClick={() => setChainOpen(true)}><Settings2 className="h-4 w-4" />Approval chain</Button>
          <Button variant="secondary" onClick={() => openVendors('sports-lawyer', leagueId)}><Scale className="h-4 w-4" />Find legal vendors</Button>
        </>} />
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
          <Table head={['Contract', 'Counterparty', 'Status', 'Version', 'Expires', 'Updated', '']} empty={!list.data?.length && <Empty icon={<FileSignature className="h-5 w-5" />} title="No contracts yet" text="Choose a template above to draft one." />}>
            {list.data?.map((c) => (
              <tr key={c.id}>
                <td className="td"><Link to={`/leagues/${leagueId}/contracts/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">{c.title}</Link></td>
                <td className="td">{c.counterparty ?? '—'}</td>
                <td className="td"><StatusBadge status={c.status} /></td>
                <td className="td">v{c.version}</td>
                <td className="td">{c.expiresOn ? <span className={new Date(c.expiresOn) < new Date(Date.now() + 30 * 864e5) ? 'font-medium text-amber-700' : ''}>{day(c.expiresOn)}</span> : '—'}</td>
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
      <ClauseLibrary open={lib} onClose={() => setLib(false)} />
      {chainOpen && <ChainEditor onClose={() => setChainOpen(false)} />}
    </>
  );
}

function ChainEditor({ onClose }: { onClose: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['legal-chain', leagueId], queryFn: () => get(`/leagues/${leagueId}/legal/chain`) });
  const [chain, setChain] = useState<string[] | null>(null);
  useEffect(() => { if (q.data && !chain) setChain(q.data.chain); }, [q.data, chain]);
  const save = useMutation({ mutationFn: () => put(`/leagues/${leagueId}/legal/chain`, { chain }), onSuccess: onClose });
  const steps = chain ?? [];
  const middle = steps.slice(0, -1);
  const opts = (q.data?.departments ?? []).filter((d: string) => d !== 'League Owner');
  return (
    <Modal open onClose={onClose} title="Contract approval chain" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save chain</Button></>}>
      <p className="mb-3 text-sm text-ink-500">Every contract passes these approvers in order before it can be sent. Members of each department (Management) can approve their step; the League Owner always signs off last.</p>
      <ErrorText error={save.error} />
      <ol className="space-y-2">
        {middle.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 text-xs text-ink-500">{i + 1}.</span>
            <Select value={d} onChange={(e) => setChain([...middle.map((x, j) => (j === i ? e.target.value : x)), 'League Owner'])} options={opts} />
            <button className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Remove step" onClick={() => setChain([...middle.filter((_, j) => j !== i), 'League Owner'])}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        <li className="flex items-center gap-2 text-sm"><span className="w-5 text-xs text-ink-500">{middle.length + 1}.</span><span className="font-medium">League Owner</span><span className="text-xs text-ink-500">(final, fixed)</span></li>
      </ol>
      {middle.length < 6 && <Button className="mt-3" size="sm" variant="secondary" onClick={() => setChain([...middle, opts[0], 'League Owner'])}><Plus className="h-3.5 w-3.5" />Add step</Button>}
    </Modal>
  );
}

function ClauseLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['clauses', leagueId], queryFn: () => get(`/leagues/${leagueId}/legal/clauses`), enabled: open });
  const [edit, setEdit] = useState<any>(null);
  const save = useMutation({
    mutationFn: () => (edit.id ? patch(`/leagues/${leagueId}/legal/clauses/${edit.id}`, { title: edit.title, tag: edit.tag, body: edit.body }) : post(`/leagues/${leagueId}/legal/clauses`, { title: edit.title, tag: edit.tag, body: edit.body })),
    onSuccess: () => { setEdit(null); q.refetch(); },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/legal/clauses/${id}`), onSuccess: () => q.refetch() });
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Clause library" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="mb-3 text-sm text-ink-500">Reusable clauses your team can insert into any draft. Generic starting points — verify with a qualified lawyer.</p>
      {edit ? (
        <div className="space-y-3">
          <ErrorText error={save.error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Category"><Select value={edit.tag} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} options={q.data?.tags ?? []} /></Field>
          </div>
          <Field label="Clause text"><Textarea rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          <div className="flex gap-2"><Button loading={save.isPending} onClick={() => save.mutate()}>Save clause</Button><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      ) : (
        <>
          <Button size="sm" className="mb-3" onClick={() => setEdit({ title: '', tag: 'Other', body: '' })}><Plus className="h-3.5 w-3.5" />New clause</Button>
          {q.isLoading ? <Spinner /> : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {q.data?.clauses.map((c: any) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 p-3">
                  <div className="min-w-0"><p className="text-sm font-semibold">{c.title} <span className="ml-1 text-xs font-normal text-ink-500">{c.tag}{c.isDefault ? ' · SportsIQ sample' : ''}</span></p><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-ink-600">{c.body}</p></div>
                  <div className="flex shrink-0 gap-1"><Button size="sm" variant="secondary" onClick={() => setEdit(c)}>Edit</Button><button onClick={() => confirm('Delete clause?') && remove.mutate(c.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/** Simple line diff (LCS) between two versions */
function lineDiff(a: string, b: string) {
  const x = a.split('\n'), y = b.split('\n');
  const n = x.length, m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: ' ' | '+' | '-'; s: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) { if (x[i] === y[j]) { out.push({ t: ' ', s: x[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: '-', s: x[i++] }); else out.push({ t: '+', s: y[j++] }); }
  while (i < n) out.push({ t: '-', s: x[i++] });
  while (j < m) out.push({ t: '+', s: y[j++] });
  return out;
}

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function ClausePicker({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (text: string) => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['clauses', leagueId], queryFn: () => get(`/leagues/${leagueId}/legal/clauses`), enabled: open });
  const [tag, setTag] = useState('');
  const list = (q.data?.clauses ?? []).filter((c: any) => !tag || c.tag === tag);
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Insert a clause">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['', ...(q.data?.tags ?? [])].map((t: string) => <button key={t || 'all'} onClick={() => setTag(t)} className={`rounded-full px-3 py-1 text-xs font-medium ${tag === t ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'}`}>{t || 'All'}</button>)}
      </div>
      {q.isLoading ? <Spinner /> : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {list.map((c: any) => (
            <div key={c.id} className="rounded-lg border border-ink-200 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{c.title} <span className="ml-1 text-xs font-normal text-ink-500">{c.tag}</span></p><Button size="sm" variant="secondary" onClick={() => { onInsert(c.body); onClose(); }}><Plus className="h-3.5 w-3.5" />Insert</Button></div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-500">Library clauses are generic starting points — have them reviewed by a qualified lawyer.</p>
    </Modal>
  );
}

function ApprovalPanel({ contract, onChange }: { contract: any; onChange: () => void }) {
  const { leagueId } = useLeague();
  const id = contract.id;
  const q = useQuery({ queryKey: ['approvals', id], queryFn: () => get(`/leagues/${leagueId}/legal/contracts/${id}/approvals`) });
  const [note, setNote] = useState('');
  const decide = useMutation({ mutationFn: (decision: string) => post(`/leagues/${leagueId}/legal/contracts/${id}/decide`, { decision, note: note || undefined }), onSuccess: () => { setNote(''); q.refetch(); onChange(); } });
  const steps = q.data?.current ?? [];
  const lastRejected = !steps.length && q.data?.history?.find((h: any) => h.status === 'REJECTED');
  return (
    <Card title="Approval chain">
      {q.isLoading ? <Spinner /> : !steps.length ? (
        <p className="text-xs text-ink-500">{contract.status === 'DRAFT' ? 'Not submitted yet. Submit the draft to route it through your approval chain.' : 'No approval round.'}</p>
      ) : (
        <ol className="space-y-2">
          {steps.map((a: any) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              {a.status === 'APPROVED' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : a.status === 'REJECTED' ? <XCircle className="mt-0.5 h-4 w-4 text-red-600" /> : <Clock className="mt-0.5 h-4 w-4 text-ink-400" />}
              <div><p className="font-medium">{a.department}</p>{a.decidedBy && <p className="text-xs text-ink-500">{a.decidedBy} · {day(a.decidedAt)}{a.note ? ` — “${a.note}”` : ''}</p>}</div>
            </li>
          ))}
        </ol>
      )}
      {lastRejected && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">Last round rejected by {lastRejected.department}: “{lastRejected.note}”</p>}
      {q.data?.canDecide && contract.status === 'UNDER_LEGAL_REVIEW' && (
        <div className="mt-4 border-t border-ink-100 pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">Your decision ({q.data.nextStep.department})</p>
          <Textarea placeholder="Note (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorText error={decide.error} />
          <div className="mt-2 flex gap-2"><Button size="sm" loading={decide.isPending} onClick={() => decide.mutate('APPROVED')}>Approve</Button><Button size="sm" variant="secondary" disabled={!note} onClick={() => decide.mutate('REJECTED')}>Reject</Button></div>
        </div>
      )}
    </Card>
  );
}

function VersionsPanel({ contract, current, onRestored }: { contract: any; current: string; onRestored: () => void }) {
  const { leagueId } = useLeague();
  const q = useQuery({ queryKey: ['versions', contract.id, contract.version], queryFn: () => get<any[]>(`/leagues/${leagueId}/legal/contracts/${contract.id}/versions`) });
  const [view, setView] = useState<any>(null);
  const restore = useMutation({ mutationFn: (v: number) => post(`/leagues/${leagueId}/legal/contracts/${contract.id}/versions/${v}/restore`, {}), onSuccess: () => { setView(null); onRestored(); } });
  const diff = view ? lineDiff(view.body, current) : [];
  return (
    <Card title={`Versions (v${contract.version})`}>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {q.data?.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            <button onClick={() => setView(v)} className="text-left hover:text-brand-700"><span className="font-medium">v{v.version}</span> <span className="text-xs text-ink-500">{v.savedBy} · {ago(v.createdAt)}</span>{v.note && <span className="block text-xs text-ink-500">{v.note}</span>}</button>
          </li>
        ))}
      </ul>
      <Modal open={!!view} onClose={() => setView(null)} size="xl" title={view ? `v${view.version} compared with the editor` : ''}
        footer={<><Button variant="secondary" onClick={() => setView(null)}>Close</Button>{contract.status === 'DRAFT' && view?.version !== contract.version && <Button loading={restore.isPending} onClick={() => restore.mutate(view.version)}><RotateCcw className="h-4 w-4" />Restore v{view?.version}</Button>}</>}>
        <ErrorText error={restore.error} />
        <p className="mb-2 text-xs text-ink-500"><span className="bg-red-100 px-1">− removed</span> since v{view?.version} · <span className="bg-emerald-100 px-1">+ added</span> in the current text</p>
        <pre className="max-h-[60vh] overflow-auto rounded-lg border border-ink-200 p-3 text-[12px] leading-relaxed">
          {diff.map((d, i) => <div key={i} className={d.t === '+' ? 'bg-emerald-50 text-emerald-900' : d.t === '-' ? 'bg-red-50 text-red-900 line-through' : 'text-ink-600'}>{d.t} {d.s || ' '}</div>)}
        </pre>
      </Modal>
    </Card>
  );
}

function SignedPanel({ contract, onChange }: { contract: any; onChange: () => void }) {
  const { leagueId } = useLeague();
  const [files, setFiles] = useState<string[]>([]);
  const [f, setF] = useState({ signedAt: new Date().toISOString().slice(0, 10), effectiveFrom: contract.effectiveFrom?.slice(0, 10) ?? '', expiresOn: contract.expiresOn?.slice(0, 10) ?? '' });
  const save = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/legal/contracts/${contract.id}/signed`, { files, signedAt: f.signedAt, effectiveFrom: f.effectiveFrom || undefined, expiresOn: f.expiresOn || undefined }), onSuccess: () => { setFiles([]); onChange(); } });
  const dates = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/legal/contracts/${contract.id}/dates`, { effectiveFrom: f.effectiveFrom || null, expiresOn: f.expiresOn || null }), onSuccess: onChange });
  if (!['APPROVED', 'SENT', 'SIGNED'].includes(contract.status)) return null;
  const days = contract.expiresOn ? Math.ceil((+new Date(contract.expiresOn) - Date.now()) / 864e5) : null;
  return (
    <Card title="Signed copy">
      {contract.status === 'SIGNED' && <p className="mb-2 text-xs text-emerald-700">Signed {day(contract.signedAt)} · locked for editing</p>}
      {days !== null && <p className={`mb-2 text-xs ${days < 0 ? 'text-red-700' : days <= 30 ? 'text-amber-700' : 'text-ink-500'}`}>{days < 0 ? `Expired ${-days} days ago` : `Expires in ${days} days`} ({day(contract.expiresOn)})</p>}
      <Attachments urls={contract.signedCopies} />
      <div className="mt-3 grid gap-2">
        <Field label="Signed on"><Input type="date" value={f.signedAt} onChange={(e) => setF({ ...f, signedAt: e.target.value })} /></Field>
        <Field label="Effective from"><Input type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
        <Field label="Expires on" hint="We alert you 30 and 7 days before"><Input type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} /></Field>
      </div>
      <ErrorText error={save.error || dates.error} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <UploadButton label={files.length ? `${files.length} file(s) ready` : 'Upload signed PDF'} onAdd={(u) => setFiles([...files, ...u])} />
        <Button size="sm" disabled={!files.length} loading={save.isPending} onClick={() => save.mutate()}>Record signed copy</Button>
        {contract.status === 'SIGNED' && <Button size="sm" variant="ghost" loading={dates.isPending} onClick={() => dates.mutate()}>Update dates</Button>}
      </div>
      <p className="mt-2 text-[11px] text-ink-500">Signatures happen offline (wet ink or your e-sign provider). Upload the executed copy here for the record.</p>
    </Card>
  );
}

export function ContractEditor() {
  const { leagueId } = useLeague();
  const { contractId } = useParams();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const c = useQuery({ queryKey: ['contract', contractId], queryFn: () => get(`/leagues/${leagueId}/studio/contracts/${contractId}`) });
  const [body, setBody] = useState<string | null>(null);
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [note, setNote] = useState('');
  const [clauses, setClauses] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  useEffect(() => { if (c.data && (body === null || c.data.version !== loadedVersion)) { setBody(c.data.body); setLoadedVersion(c.data.version); } }, [c.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { qc.invalidateQueries({ queryKey: ['contract', contractId] }); qc.invalidateQueries({ queryKey: ['contracts', leagueId] }); qc.invalidateQueries({ queryKey: ['approvals', contractId] }); };
  const save = useMutation({ mutationFn: (extra: object = {}) => patch(`/leagues/${leagueId}/studio/contracts/${contractId}`, extra), onSuccess: () => { setNote(''); refresh(); } });
  const submit = useMutation({ mutationFn: async () => { if (body !== c.data.body) await patch(`/leagues/${leagueId}/studio/contracts/${contractId}`, { body, note: 'Saved before submitting' }); return post(`/leagues/${leagueId}/legal/contracts/${contractId}/submit`, {}); }, onSuccess: refresh });
  if (c.isLoading || body === null) return <Spinner />;
  const ct = c.data;
  const draft = ct.status === 'DRAFT';
  const dirty = body !== ct.body;
  const ack = !!ct.acknowledgedAt;
  const placeholders = [...new Set(body.match(/\[[A-Z ]{3,}\]/g) ?? [])];
  const full = `${ct.disclaimer}\n\n${'-'.repeat(60)}\n\n${body}\n\n${'-'.repeat(60)}\n${ct.disclaimer}`;
  const esc = (t: string) => t.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[x]!);
  const docHtml = `<html><head><meta charset="utf-8"><title>${esc(ct.title)}</title></head><body style="font-family:Arial;font-size:12pt;line-height:1.5"><p style="border:1px solid #d97706;background:#fffbeb;padding:8px;font-size:10pt"><b>${esc(ct.disclaimer)}</b></p><pre style="white-space:pre-wrap;font-family:Arial">${esc(body)}</pre><p style="font-size:9pt;color:#666">${esc(ct.disclaimer)}</p></body></html>`;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([docHtml], { type: 'application/msword' })); a.download = `${ct.title.replace(/[^\w]+/g, '_')}_v${ct.version}.doc`; a.click(); };
  const print = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(docHtml); w.document.close(); setTimeout(() => w.print(), 300); };
  const insert = (text: string) => {
    const pos = caret.current ?? body.length;
    setBody(`${body.slice(0, pos)}${pos ? '\n\n' : ''}${text}\n\n${body.slice(pos)}`);
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/contracts`} className="hover:underline">Legal Contracts</Link>} title={<span className="flex items-center gap-3">{ct.title}<StatusBadge status={ct.status} /></span>}
        subtitle={`Version ${ct.version}${dirty ? ' · unsaved changes' : ''}`}
        actions={<>
          <Button variant="secondary" onClick={() => openVendors('sports-lawyer', leagueId)}><Store className="h-4 w-4" />Get it reviewed by a lawyer</Button>
          {draft && <Button variant="secondary" onClick={() => setClauses(true)}><Library className="h-4 w-4" />Insert clause</Button>}
          {draft && <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ body, note: note || undefined })}><Save className="h-4 w-4" />Save v{ct.version + 1}</Button>}
        </>} />
      <LegalNotice text={ct.disclaimer} />
      <ErrorText error={save.error || submit.error} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {draft && dirty && <Input placeholder="What changed? (optional note for the version history)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <Card padded={false}><Textarea ref={ref} onSelect={(e) => { caret.current = e.currentTarget.selectionStart; }} readOnly={!draft} value={body} onChange={(e) => setBody(e.target.value)} className={`min-h-[65vh] rounded-xl border-0 font-mono text-[13px] leading-relaxed shadow-none focus:ring-0 ${draft ? '' : 'bg-ink-50 text-ink-700'}`} /></Card>
          {!draft && <p className="text-xs text-ink-500">{ct.status === 'SIGNED' ? 'Signed contracts are locked.' : 'Withdraw to draft to make changes — this restarts approvals.'}</p>}
        </div>
        <div className="space-y-4">
          <Card title="Workflow">
            <ol className="mb-3 flex flex-wrap gap-1 text-[11px]">
              {['DRAFT', 'UNDER_LEGAL_REVIEW', 'APPROVED', 'SENT', 'SIGNED'].map((s) => <li key={s} className={`rounded px-1.5 py-0.5 ${ct.status === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{s.replace(/_/g, ' ').toLowerCase()}</li>)}
            </ol>
            {draft && placeholders.length > 0 && <p className="mb-2 text-xs text-amber-700">Fill {placeholders.length} placeholder(s) before submitting: {placeholders.slice(0, 4).join(', ')}{placeholders.length > 4 ? '…' : ''}</p>}
            <div className="space-y-2">
              {draft && <Button className="w-full" disabled={placeholders.length > 0} loading={submit.isPending} onClick={() => submit.mutate()}><Send className="h-4 w-4" />Submit for approval</Button>}
              {['UNDER_LEGAL_REVIEW', 'APPROVED', 'SENT'].includes(ct.status) && <Button className="w-full" variant="secondary" onClick={() => confirm('Withdraw to draft? Approvals will need to be repeated.') && save.mutate({ status: 'DRAFT' })}><Undo2 className="h-4 w-4" />Withdraw to draft</Button>}
              {ct.status === 'APPROVED' && <Button className="w-full" disabled={!ack} onClick={() => save.mutate({ status: 'SENT' })}><Send className="h-4 w-4" />Mark as sent to {ct.counterparty ?? 'counterparty'}</Button>}
              {ct.status !== 'ARCHIVED' && <Button className="w-full" variant="ghost" onClick={() => confirm('Archive this contract?') && save.mutate({ status: 'ARCHIVED' })}><Archive className="h-4 w-4" />Archive</Button>}
            </div>
          </Card>
          <ApprovalPanel contract={ct} onChange={refresh} />
          <SignedPanel key={`${ct.status}-${ct.signedCopies.length}`} contract={ct} onChange={refresh} />
          <VersionsPanel contract={ct} current={body} onRestored={refresh} />
          <Comments leagueId={leagueId} type="Contract" id={ct.id} title="Review comments" />
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
      <ClausePicker open={clauses} onClose={() => setClauses(false)} onInsert={insert} />
    </>
  );
}
