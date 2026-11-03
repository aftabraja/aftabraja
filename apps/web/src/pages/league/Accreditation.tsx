import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Copy, ExternalLink, IdCard, Plus, Printer, ScanLine, ShieldAlert, Store, Trash2, Upload, Users, XCircle } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { fileToDataUrl } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Tabs, Textarea, cx } from '../../components/ui';
import { CardBack, CardFront, type CardData } from '../../components/AccredCard';
import { useVendorPanel } from '../../components/VendorPanel';

const STATUS_TONE: Record<string, string> = { APPLIED: 'gray', APPROVED: 'blue', PRINTED: 'violet', ISSUED: 'green', REJECTED: 'red', REVOKED: 'red' };
const ID_TYPES = ['Aadhaar', 'Passport', 'Driving licence', 'Voter ID', 'PAN', 'Press card'];
type Tab = 'apps' | 'print' | 'gate' | 'design' | 'zones' | 'rules';

/** Downscale photos before storing (keeps cards light and printing fast) */
async function photoFromFile(f: File) {
  const src = await fileToDataUrl(f);
  const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  const w = 360, h = 450, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const s = Math.max(w / img.width, h / img.height);
  c.getContext('2d')!.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  return c.toDataURL('image/jpeg', 0.85);
}

export default function Accreditation() {
  const { leagueId } = useLeague();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const key = ['accreditation', leagueId];
  const q = useQuery({ queryKey: key, queryFn: () => get(`/leagues/${leagueId}/accreditation`) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [tab, setTab] = useState<Tab>('apps');
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  const applyUrl = `${window.location.origin}/accreditation/apply/${d.league.slug}`;
  return (
    <>
      <PageHeader title="Accreditation" subtitle="Zones, categories, applications with photo & ID checks, card design, batch printing, issue/revoke/reprint and gate verification."
        actions={<><Button variant="secondary" onClick={() => openVendors('printing', leagueId)}><Store className="h-4 w-4" />Find card printers</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Total" value={d.summary.total} /><Stat label="Pending review" value={d.summary.applied} /><Stat label="Approved" value={d.summary.approved} />
        <Stat label="Printed" value={d.summary.printed} /><Stat label="Issued" value={d.summary.issued} tone="green" /><Stat label="Revoked" value={d.summary.revoked} tone={d.summary.revoked ? 'red' : undefined} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'apps', label: 'Applications' }, { value: 'print', label: 'Print cards' }, { value: 'gate', label: 'Gate check' }, { value: 'design', label: 'Card design' }, { value: 'zones', label: 'Zones & categories' }, { value: 'rules', label: 'Rules & applications' }]} />
      {tab === 'apps' && <Applications d={d} leagueId={leagueId} refresh={refresh} />}
      {tab === 'print' && <PrintCards d={d} leagueId={leagueId} refresh={refresh} />}
      {tab === 'gate' && <Gate d={d} leagueId={leagueId} />}
      {tab === 'design' && <Design d={d} leagueId={leagueId} refresh={refresh} />}
      {tab === 'zones' && <ZonesCats d={d} leagueId={leagueId} refresh={refresh} />}
      {tab === 'rules' && <Rules d={d} leagueId={leagueId} refresh={refresh} applyUrl={applyUrl} />}
    </>
  );
}

function Applications({ d, leagueId, refresh }: { d: any; leagueId: string; refresh: () => void }) {
  const [status, setStatus] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const rows = useMemo(() => d.accreditations.filter((a: any) => (!status || a.status === status) && (!cat || a.categoryId === cat) && (!q || `${a.name} ${a.organisation ?? ''} ${a.cardNo}`.toLowerCase().includes(q.toLowerCase()))), [d, status, cat, q]);
  const wf = useMutation({ mutationFn: (b: any) => post(`/leagues/${leagueId}/accreditation/workflow`, b), onSuccess: (r) => { setResult(r); setSel([]); refresh(); } });
  const bulk = useMutation({ mutationFn: (source: string) => post(`/leagues/${leagueId}/accreditation/bulk`, { source }), onSuccess: (r) => { alert(`${r.created} applications created${r.skipped ? `, ${r.skipped} already existed` : ''}.`); refresh(); } });
  const act = (action: string) => {
    const reason = ['REJECT', 'REVOKE', 'REPRINT'].includes(action) ? prompt(action === 'REPRINT' ? 'Reason for reprint (lost / damaged / details changed):' : 'Reason:') : undefined;
    if (reason === null) return;
    wf.mutate({ ids: sel, action, reason: reason || undefined });
  };
  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-4">
          <Input className="w-56" placeholder="Search name, organisation, no." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.keys(STATUS_TONE).map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{d.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="ml-auto flex flex-wrap gap-2">
            <select className="input w-auto" value="" onChange={(e) => e.target.value && bulk.mutate(e.target.value)}><option value="">Import from SportsIQ…</option><option value="SQUADS">Team squads (players)</option><option value="TEAM_OWNERS">Team owners</option><option value="MANAGEMENT">League management</option></select>
            <Button onClick={() => setEdit({ categoryId: d.categories[0]?.id, name: '', organisation: '', designation: '', email: '', phone: '', photoUrl: '', idType: '', idNumber: '', idVerified: false, teamId: '', zones: d.categories[0]?.zones ?? [], validFrom: d.league.startDate?.slice(0, 10) ?? '', validTo: d.league.endDate?.slice(0, 10) ?? '' })}><Plus className="h-4 w-4" />Add person</Button>
          </div>
        </div>
        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-brand-50/50 px-4 py-2.5 text-sm">
            <span className="font-semibold">{sel.length} selected</span>
            <Button size="sm" variant="success" onClick={() => act('APPROVE')}>Approve</Button>
            <Button size="sm" variant="secondary" onClick={() => act('ISSUE')}>Mark issued</Button>
            <Button size="sm" variant="secondary" onClick={() => act('REPRINT')}>Reprint (new version)</Button>
            <Button size="sm" variant="secondary" onClick={() => act('REJECT')}>Reject</Button>
            <Button size="sm" variant="danger" onClick={() => act('REVOKE')}>Revoke</Button>
            <Button size="sm" variant="ghost" onClick={() => act('RESTORE')}>Restore</Button>
          </div>
        )}
        <Table head={[<input key="all" type="checkbox" checked={!!rows.length && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((a: any) => a.id) : [])} />, 'No.', 'Person', 'Category', 'Zones', 'ID', 'Status', 'Checks', '']}
          empty={!rows.length && <Empty icon={<IdCard className="h-5 w-5" />} title="No accreditations yet" text="Import team squads and management, add people, or share the public application link with media and vendors." />}>
          {rows.map((a: any) => (
            <tr key={a.id} className={cx(sel.includes(a.id) && 'bg-brand-50/40')}>
              <td className="td"><input type="checkbox" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} /></td>
              <td className="td font-mono text-xs">{a.cardNo}{a.version > 1 && <span className="text-ink-400"> v{a.version}</span>}</td>
              <td className="td"><div className="flex items-center gap-3"><Avatar name={a.name} src={a.photoUrl} size={34} /><div><p className="font-medium text-ink-900">{a.name}</p><p className="text-xs text-ink-500">{[a.organisation, a.designation].filter(Boolean).join(' · ')}</p></div></div></td>
              <td className="td"><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: a.category.color }} />{a.category.name}</span></td>
              <td className="td font-mono text-xs">{a.zones.join(' ')}</td>
              <td className="td text-xs">{a.idType ? <span className={a.idVerified ? 'text-emerald-700' : 'text-amber-700'}>{a.idType} ••{a.idLast4 ?? ''} {a.idVerified ? '✓' : '(unverified)'}</span> : '—'}</td>
              <td className="td"><Badge color={STATUS_TONE[a.status]}>{a.status.toLowerCase()}</Badge>{a.source === 'SELF_APPLY' && <Badge className="ml-1">self-applied</Badge>}</td>
              <td className="td">{a.blockers.length && ['APPLIED', 'REJECTED'].includes(a.status) ? <span title={a.blockers.join('\n')} className="flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="h-3.5 w-3.5" />{a.blockers.length} to fix</span> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</td>
              <td className="td text-right"><Button size="sm" variant="secondary" onClick={() => setEdit({ ...a, email: a.email ?? '', phone: a.phone ?? '', organisation: a.organisation ?? '', designation: a.designation ?? '', idType: a.idType ?? '', idNumber: '', teamId: a.teamId ?? '', validFrom: a.validFrom?.slice(0, 10) ?? '', validTo: a.validTo?.slice(0, 10) ?? '' })}>Open</Button></td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <PersonModal d={d} leagueId={leagueId} a={edit} onClose={() => { setEdit(null); refresh(); }} />}
      <Modal open={!!result} onClose={() => setResult(null)} title="Done" size="sm" footer={<Button onClick={() => setResult(null)}>OK</Button>}>
        {result && <><p className="text-sm">{result.done} updated.</p>{result.skipped.length > 0 && <div className="mt-3"><p className="label">Skipped ({result.skipped.length})</p><ul className="space-y-1 text-sm">{result.skipped.map((s: any, i: number) => <li key={i}><b>{s.name}</b>: <span className="text-ink-500">{s.reason}</span></li>)}</ul></div>}</>}
      </Modal>
    </>
  );
}

function PersonModal({ d, leagueId, a, onClose }: { d: any; leagueId: string; a: any; onClose: () => void }) {
  const [f, setF] = useState(a);
  const cat = d.categories.find((c: any) => c.id === f.categoryId);
  const save = useMutation({
    mutationFn: () => {
      const b: any = { categoryId: f.categoryId, name: f.name, organisation: f.organisation || null, designation: f.designation || null, email: f.email || null, phone: f.phone || null, photoUrl: f.photoUrl || null, idType: f.idType || null, idVerified: f.idVerified, teamId: f.teamId || null, zones: f.zones, validFrom: f.validFrom || null, validTo: f.validTo || null };
      if (f.idNumber) b.idNumber = f.idNumber;
      return a.id ? patch(`/leagues/${leagueId}/accreditation/${a.id}`, b) : post(`/leagues/${leagueId}/accreditation`, b);
    },
    onSuccess: onClose,
  });
  const remove = useMutation({ mutationFn: () => del(`/leagues/${leagueId}/accreditation/${a.id}`), onSuccess: onClose });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const preview: CardData = { ...f, cardNo: a.cardNo ?? 0, code: a.code ?? 'PREVIEW', version: a.version ?? 1, category: cat ?? { name: '', letter: '', color: '#64748b' }, validFrom: f.validFrom, validTo: f.validTo };
  return (
    <Modal open onClose={onClose} size="xl" title={a.id ? `Accreditation #${a.cardNo}` : 'New accreditation'}
      footer={<>{a.id && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => confirm('Delete this record permanently?') && remove.mutate()}><Trash2 className="h-4 w-4" />Delete</Button>}<Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.name || !f.categoryId} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="grid gap-6 md:grid-cols-[1fr_230px]">
        <div className="space-y-4">
          <ErrorText error={save.error || remove.error} />
          {a.id && ['PRINTED', 'ISSUED'].includes(a.status) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">This card is already printed. Changing printed details creates a new version — the old card stops working and the new one must be printed.</p>}
          <div className="flex items-center gap-4">
            <Avatar name={f.name || '?'} src={f.photoUrl} size={72} />
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-semibold hover:bg-ink-50"><Upload className="h-4 w-4" />{f.photoUrl ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/*" capture="user" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, photoUrl: await photoFromFile(x) }); }} /></label>
            <p className="text-xs text-ink-500">Passport-style, plain background, face clearly visible. Required for approval.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name (as on ID)" className="col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
            <Field label="Category"><Select value={f.categoryId} onChange={(e) => { const c = d.categories.find((x: any) => x.id === e.target.value); setF({ ...f, categoryId: e.target.value, zones: c?.zones ?? f.zones }); }} options={d.categories.map((c: any) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label="Team (optional)"><Select value={f.teamId} onChange={set('teamId')} placeholder="—" options={d.league.teams.map((t: any) => ({ value: t.id, label: t.name }))} /></Field>
            <Field label="Organisation"><Input value={f.organisation} onChange={set('organisation')} /></Field>
            <Field label="Designation / role"><Input value={f.designation} onChange={set('designation')} /></Field>
            <Field label="Email"><Input value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="ID type"><Select value={f.idType} onChange={set('idType')} placeholder="—" options={ID_TYPES} /></Field>
            <Field label="ID number" hint={a.idLast4 ? `Stored: ••${a.idLast4}. Only the last 4 digits are kept.` : 'Only the last 4 digits are stored'}><Input value={f.idNumber} onChange={set('idNumber')} placeholder={a.idLast4 ? `••••${a.idLast4}` : ''} /></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.idVerified} onChange={(e) => setF({ ...f, idVerified: e.target.checked })} />I have checked the original government photo ID against this person and photo{cat?.requiresIdCheck && <Badge color="amber">required for {cat.name}</Badge>}</label>
            <Field label="Valid from"><Input type="date" value={f.validFrom} onChange={set('validFrom')} /></Field>
            <Field label="Valid to"><Input type="date" value={f.validTo} onChange={set('validTo')} /></Field>
          </div>
          <div>
            <p className="label">Access zones</p>
            <div className="flex flex-wrap gap-2">{d.zones.map((z: any) => (
              <label key={z.code} title={z.description ?? ''} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm', f.zones.includes(z.code) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200')}>
                <input type="checkbox" className="hidden" checked={f.zones.includes(z.code)} onChange={(e) => setF({ ...f, zones: e.target.checked ? [...f.zones, z.code] : f.zones.filter((x: string) => x !== z.code) })} /><b>{z.code}</b>{z.name}
              </label>
            ))}</div>
          </div>
        </div>
        <div>
          <p className="label">Card preview</p>
          <div className="origin-top-left scale-[1.0]"><CardFront a={preview} brand={d.league} zones={d.zones} sponsorLogoUrl={d.config.sponsorLogoUrl} showIdLast4={d.config.showIdLast4} /></div>
        </div>
      </div>
    </Modal>
  );
}

function PrintCards({ d, leagueId, refresh }: { d: any; leagueId: string; refresh: () => void }) {
  const ready = d.accreditations.filter((a: any) => a.status === 'APPROVED');
  const reprintable = d.accreditations.filter((a: any) => ['PRINTED', 'ISSUED'].includes(a.status));
  const [sel, setSel] = useState<string[]>(ready.map((a: any) => a.id));
  const [mode, setMode] = useState<'A4' | 'CR80'>('A4');
  const [duplex, setDuplex] = useState(true);
  const mark = useMutation({ mutationFn: (ids: string[]) => post(`/leagues/${leagueId}/accreditation/workflow`, { ids, action: 'PRINTED' }), onSuccess: refresh });

  const doPrint = (cards: any[], markAfter: boolean) => {
    if (!cards.length) return;
    const origin = window.location.origin;
    const front = (a: any) => renderToStaticMarkup(<CardFront a={a} brand={d.league} zones={d.zones} sponsorLogoUrl={d.config.sponsorLogoUrl} showIdLast4={d.config.showIdLast4} origin={origin} />);
    const back = (a: any) => renderToStaticMarkup(<CardBack a={a} brand={d.league} zones={d.zones} backText={d.config.backText} />);
    let body = '';
    if (mode === 'CR80') {
      body = cards.map((a) => `<div class="pg">${front(a)}</div>${duplex ? `<div class="pg">${back(a)}</div>` : ''}`).join('');
    } else {
      for (let i = 0; i < cards.length; i += 9) {
        const page = cards.slice(i, i + 9);
        body += `<div class="sheet">${page.map((a) => `<div class="cell">${front(a)}</div>`).join('')}</div>`;
        // Backs are mirrored per row so they line up when printed double-sided (flip on long edge)
        if (duplex) {
          const rows: any[][] = [];
          for (let r = 0; r < page.length; r += 3) rows.push(page.slice(r, r + 3));
          body += `<div class="sheet">${rows.map((row) => { const pad = [...row, ...Array(3 - row.length).fill(null)].reverse(); return pad.map((a) => `<div class="cell">${a ? back(a) : ''}</div>`).join(''); }).join('')}</div>`;
        }
      }
    }
    const css = mode === 'CR80'
      ? '@page{size:54mm 85.6mm;margin:0}body{margin:0}.pg{width:54mm;height:85.6mm;page-break-after:always;overflow:hidden}'
      : '@page{size:A4;margin:10mm}body{margin:0}.sheet{display:grid;grid-template-columns:repeat(3,54mm);grid-auto-rows:85.6mm;gap:6mm 9mm;justify-content:center;page-break-after:always}.cell{width:54mm;height:85.6mm}';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Accreditation cards</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>${css}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${body}</body></html>`);
    w.document.close();
    const imgs = [...w.document.images];
    Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))).then(() => {
      w.print();
      if (markAfter && confirm(`Did all ${cards.length} cards print correctly? They will be marked as PRINTED.`)) mark.mutate(cards.map((c) => c.id));
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <Card title={`Ready to print (${ready.length} approved)`} padded={false}>
        {!ready.length ? <Empty icon={<Printer className="h-5 w-5" />} title="Nothing to print" text="Approve applications first. Only approved cards with a photo, zones, validity and verified ID can be printed." /> : (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {ready.map((a: any) => (
              <label key={a.id} className={cx('cursor-pointer rounded-xl border-2 p-2 transition', sel.includes(a.id) ? 'border-brand-600 bg-brand-50/50' : 'border-transparent hover:border-ink-200')}>
                <input type="checkbox" className="mb-1" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} />
                <div style={{ zoom: 0.62 }}><CardFront a={a} brand={d.league} zones={d.zones} sponsorLogoUrl={d.config.sponsorLogoUrl} showIdLast4={d.config.showIdLast4} /></div>
              </label>
            ))}
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card title="Print settings">
          <div className="space-y-3">
            <Field label="Output"><Select value={mode} onChange={(e) => setMode(e.target.value as 'A4' | 'CR80')} options={[{ value: 'A4', label: 'A4 sheet — 9 cards per page (cut out)' }, { value: 'CR80', label: 'PVC card printer — CR80 (54 × 86 mm)' }]} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />Print backs (double-sided)</label>
            <ul className="space-y-1 text-xs text-ink-500">
              <li>• Print at 100% / "Actual size" — do not "fit to page".</li>
              <li>• A4 duplex: flip on the long edge; backs are mirrored to line up.</li>
              <li>• Use 250–300 gsm card or PVC; laminate and punch a slot for the lanyard.</li>
              <li>• Each card carries a versioned QR — reprints automatically invalidate older copies.</li>
            </ul>
            <Button className="w-full" disabled={!sel.length} onClick={() => doPrint(ready.filter((a: any) => sel.includes(a.id)), true)}><Printer className="h-4 w-4" />Print {sel.length} cards</Button>
          </div>
        </Card>
        {reprintable.length > 0 && (
          <Card title="Already printed">
            <p className="text-sm text-ink-500">{reprintable.length} cards printed or issued. To replace a lost or damaged card use <b>Reprint</b> in Applications — that creates a new version and the old card stops working at the gate.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Gate({ d, leagueId }: { d: any; leagueId: string }) {
  const [zone, setZone] = useState(d.zones[0]?.code ?? '');
  const [payload, setPayload] = useState('');
  const verify = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/accreditation/verify`, { payload, zone }), onSuccess: () => setPayload('') });
  const scans = useQuery({ queryKey: ['accred-scans', leagueId, verify.data], queryFn: () => get<any[]>(`/leagues/${leagueId}/accreditation/scans`) });
  const r = verify.data;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); if (payload) verify.mutate(); }} className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <Field label="This gate is for zone"><Select value={zone} onChange={(e) => setZone(e.target.value)} options={d.zones.map((z: any) => ({ value: z.code, label: `${z.code} — ${z.name}` }))} /></Field>
          <Field label="Scan card QR" hint="USB / Bluetooth scanners type the code and press Enter"><Input autoFocus value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="AC… " /></Field>
          <Button size="lg" loading={verify.isPending}><ScanLine className="h-4 w-4" />Verify</Button>
        </form>
        <ErrorText error={verify.error} />
        {r && (
          <div className={cx('mt-6 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center', r.allowed ? 'bg-emerald-50 ring-2 ring-emerald-500' : 'bg-red-50 ring-2 ring-red-500')}>
            {r.card?.photoUrl ? <img src={r.card.photoUrl} alt="" className="h-36 w-28 rounded-lg object-cover" /> : <div className="flex h-36 w-28 items-center justify-center rounded-lg bg-white text-xs text-ink-400">No photo</div>}
            <div>
              <p className={cx('flex items-center gap-2 text-3xl font-extrabold', r.allowed ? 'text-emerald-700' : 'text-red-700')}>{r.allowed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}{r.allowed ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</p>
              {r.reason && <p className="mt-1 font-semibold text-red-700">{r.reason}</p>}
              {r.card && <><p className="mt-3 text-xl font-bold">{r.card.name}</p><p className="text-sm text-ink-700">{[r.card.organisation, r.card.designation].filter(Boolean).join(' · ')}</p><p className="mt-1 text-sm"><span className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: r.card.color }} /> {r.card.category} · Zones {r.card.zones.join(' ')} · No. {r.card.cardNo} v{r.card.version}</p><p className="mt-2 text-xs font-semibold text-ink-500">Always compare the face with the photo.</p></>}
            </div>
          </div>
        )}
      </Card>
      <Card title="Recent scans" padded={false}>
        <ul className="divide-y divide-ink-100">{(scans.data ?? []).slice(0, 15).map((s) => <li key={s.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm"><span className="truncate">{s.allowed ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" /> : <XCircle className="mr-1 inline h-4 w-4 text-red-600" />}{s.accreditation.name}</span><span className="shrink-0 text-xs text-ink-500">Zone {s.zone} · {new Date(s.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul>
      </Card>
    </div>
  );
}

function Design({ d, leagueId, refresh }: { d: any; leagueId: string; refresh: () => void }) {
  const [f, setF] = useState({ backText: d.config.backText, sponsorLogoUrl: d.config.sponsorLogoUrl ?? '', showIdLast4: d.config.showIdLast4 });
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/accreditation/config`, { ...f, sponsorLogoUrl: f.sponsorLogoUrl || null }), onSuccess: refresh });
  const [catId, setCatId] = useState(d.categories[0]?.id);
  const cat = d.categories.find((c: any) => c.id === catId) ?? d.categories[0];
  const sample: CardData = { name: 'Aarav Sharma', organisation: d.league.teams[0]?.name ?? d.league.name, designation: cat?.name === 'Player' ? 'All-rounder' : 'Manager', photoUrl: null, cardNo: 1001, code: 'SAMPLE', version: 1, zones: cat?.zones ?? [], validFrom: d.league.startDate, validTo: d.league.endDate, idLast4: '4321', category: cat };
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card title="Live preview">
        <div className="mb-4"><Select value={catId} onChange={(e) => setCatId(e.target.value)} options={d.categories.map((c: any) => ({ value: c.id, label: `Preview as: ${c.name}` }))} /></div>
        <div className="flex flex-wrap justify-center gap-8 rounded-xl bg-ink-50 p-8">
          <div style={{ zoom: 1.45 }}><CardFront a={sample} brand={d.league} zones={d.zones} sponsorLogoUrl={f.sponsorLogoUrl} showIdLast4={f.showIdLast4} /></div>
          <div style={{ zoom: 1.45 }}><CardBack a={sample} brand={d.league} zones={d.zones} backText={f.backText} /></div>
        </div>
        <p className="mt-3 text-xs text-ink-500">Standard CR80 / ID-1 size (54 × 85.6 mm, portrait). League logo and colour come from League Settings; category colours and letters from Zones & categories.</p>
      </Card>
      <Card title="Design settings" action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
        <div className="space-y-4">
          {save.isSuccess && <p className="text-sm text-emerald-700">Saved.</p>}
          <Field label="Card back text"><Textarea rows={5} value={f.backText} onChange={(e) => setF({ ...f, backText: e.target.value })} /></Field>
          <div>
            <p className="label">Sponsor logo on card (optional)</p>
            <div className="flex items-center gap-3">
              {f.sponsorLogoUrl && <img src={f.sponsorLogoUrl} alt="" className="h-10 rounded border border-ink-200 bg-white p-1" />}
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-semibold hover:bg-ink-50"><Upload className="h-4 w-4" />Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, sponsorLogoUrl: await fileToDataUrl(x) }); }} /></label>
              {f.sponsorLogoUrl && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, sponsorLogoUrl: '' })}>Remove</Button>}
            </div>
            <p className="mt-1 text-xs text-ink-500">Only if the sponsorship contract includes accreditation branding.</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.showIdLast4} onChange={(e) => setF({ ...f, showIdLast4: e.target.checked })} />Print last 4 digits of the ID on the card</label>
        </div>
      </Card>
    </div>
  );
}

function ZonesCats({ d, leagueId, refresh }: { d: any; leagueId: string; refresh: () => void }) {
  const [z, setZ] = useState({ code: '', name: '', description: '' });
  const addZone = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/accreditation/zones`, z), onSuccess: () => { setZ({ code: '', name: '', description: '' }); refresh(); } });
  const delZone = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/accreditation/zones/${id}`), onSuccess: refresh });
  const [cat, setCat] = useState<any>(null);
  const saveCat = useMutation({ mutationFn: () => { const { id, leagueId: _l, sort: _s, ...b } = cat; return id ? patch(`/leagues/${leagueId}/accreditation/categories/${id}`, b) : post(`/leagues/${leagueId}/accreditation/categories`, b); }, onSuccess: () => { setCat(null); refresh(); } });
  const delCat = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/accreditation/categories/${id}`), onSuccess: refresh });
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Access zones" padded={false}>
        <ul className="divide-y divide-ink-100">{d.zones.map((x: any) => <li key={x.id} className="flex items-center gap-3 px-5 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-sm font-black text-white">{x.code}</span><span className="min-w-0 flex-1"><span className="block font-medium">{x.name}</span><span className="block text-xs text-ink-500">{x.description}</span></span><button onClick={() => confirm(`Delete zone ${x.code}?`) && delZone.mutate(x.id)} className="text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></li>)}</ul>
        <div className="grid grid-cols-[70px_1fr_auto] gap-2 border-t border-ink-100 p-4"><Input placeholder="Code" maxLength={3} value={z.code} onChange={(e) => setZ({ ...z, code: e.target.value.toUpperCase() })} /><Input placeholder="Zone name" value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} /><Button disabled={!z.code || !z.name} onClick={() => addZone.mutate()}><Plus className="h-4 w-4" /></Button></div>
        <div className="px-4 pb-3"><ErrorText error={addZone.error} /></div>
      </Card>
      <Card title="Categories" padded={false} action={<Button size="sm" onClick={() => setCat({ name: '', letter: '', color: '#1d4ed8', zones: [], requiresIdCheck: true, selfApply: false })}><Plus className="h-3.5 w-3.5" />Category</Button>}>
        <ul className="divide-y divide-ink-100">{d.categories.map((c: any) => (
          <li key={c.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xs font-black text-white" style={{ background: c.color }}>{c.letter}</span>
            <span className="min-w-0 flex-1"><span className="block font-medium">{c.name}</span><span className="block text-xs text-ink-500">Zones {c.zones.join(' ')}{c.requiresIdCheck ? ' · ID check' : ''}{c.selfApply ? ' · public applications' : ''}</span></span>
            <Button size="sm" variant="ghost" onClick={() => setCat(c)}>Edit</Button>
            <button onClick={() => delCat.mutate(c.id)} className="text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}</ul>
        <div className="px-4 py-3"><ErrorText error={delCat.error} /></div>
      </Card>
      <Modal open={!!cat} onClose={() => setCat(null)} title={cat?.id ? 'Edit category' : 'New category'} footer={<><Button variant="secondary" onClick={() => setCat(null)}>Cancel</Button><Button loading={saveCat.isPending} onClick={() => saveCat.mutate()}>Save</Button></>}>
        {cat && <div className="space-y-3">
          <ErrorText error={saveCat.error} />
          <div className="grid grid-cols-[1fr_90px_90px] gap-3"><Field label="Name"><Input value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></Field><Field label="Letter"><Input maxLength={4} value={cat.letter} onChange={(e) => setCat({ ...cat, letter: e.target.value.toUpperCase() })} /></Field><Field label="Colour"><Input type="color" className="h-10 p-1" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} /></Field></div>
          <div><p className="label">Default zones</p><div className="flex flex-wrap gap-2">{d.zones.map((z: any) => <label key={z.code} className={cx('cursor-pointer rounded-md border px-2.5 py-1 text-sm font-bold', cat.zones.includes(z.code) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200')}><input type="checkbox" className="hidden" checked={cat.zones.includes(z.code)} onChange={(e) => setCat({ ...cat, zones: e.target.checked ? [...cat.zones, z.code] : cat.zones.filter((x: string) => x !== z.code) })} />{z.code}</label>)}</div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.requiresIdCheck} onChange={(e) => setCat({ ...cat, requiresIdCheck: e.target.checked })} />Government photo ID must be verified before approval</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.selfApply} onChange={(e) => setCat({ ...cat, selfApply: e.target.checked })} />Open for public applications</label>
        </div>}
      </Modal>
    </div>
  );
}

function Rules({ d, leagueId, refresh, applyUrl }: { d: any; leagueId: string; refresh: () => void; applyUrl: string }) {
  const [policy, setPolicy] = useState(d.config.policy);
  const save = useMutation({ mutationFn: (b: any) => patch(`/leagues/${leagueId}/accreditation/config`, b), onSuccess: refresh });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card title="Accreditation terms & regulations" action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate({ policy })}>Save</Button>}>
        <Textarea rows={18} value={policy} onChange={(e) => setPolicy(e.target.value)} className="font-mono text-[13px]" />
        <p className="mt-2 text-xs text-ink-500">Shown to every applicant, who must accept it before applying. Have your legal team review these terms for your venue and local regulations.</p>
      </Card>
      <div className="space-y-4">
        <Card title="Public applications">
          <p className="text-sm text-ink-700">Media, broadcast crews, vendors and volunteers can apply online with photo and ID. You review and approve every application.</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-50 p-2 text-xs"><span className="min-w-0 flex-1 truncate font-mono">{applyUrl}</span><button onClick={() => navigator.clipboard?.writeText(applyUrl)} aria-label="Copy" className="rounded p-1 hover:bg-ink-200"><Copy className="h-3.5 w-3.5" /></button><a href={applyUrl} target="_blank" rel="noreferrer" className="rounded p-1 hover:bg-ink-200" aria-label="Open"><ExternalLink className="h-3.5 w-3.5" /></a></div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={d.config.selfApplyOpen} onChange={(e) => save.mutate({ selfApplyOpen: e.target.checked })} />Applications open</label>
        </Card>
        <Card title="Rules SportsIQ enforces">
          <ul className="space-y-2 text-sm text-ink-700">
            {['Photo required before approval', 'Government ID verified in person for categories that need it', 'Only the last 4 digits of an ID number are stored', 'Validity dates required; expired cards are refused at the gate', 'Access only to zones printed on the card', 'Printed details changed → new version, old card invalid', 'Lost card → reprint with new version, old QR rejected', 'Revoked cards are refused and management is alerted', 'Every approval, print, issue, revoke and scan is logged'].map((t) => <li key={t} className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t}</li>)}
          </ul>
        </Card>
        <Card><p className="flex items-center gap-2 text-sm text-ink-500"><Users className="h-4 w-4" />Tip: import squads after the auction and management from the Applications tab.</p></Card>
      </div>
    </div>
  );
}
