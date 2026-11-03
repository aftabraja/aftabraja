import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileText, Plus, Save, Send, Settings2, Shirt, Trash2, Upload, X } from 'lucide-react';
import { del, get, patch, post, put } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, fileToDataUrl } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, cx } from '../../components/ui';
import { Comments } from '../../components/Comments';
import { JerseySvg, type JerseyColors } from '../../components/JerseySvg';

const STATUS: Record<string, { label: string; color: string }> = { DRAFT: { label: 'Draft', color: 'gray' }, SUBMITTED: { label: 'Awaiting approval', color: 'amber' }, CHANGES_REQUESTED: { label: 'Changes requested', color: 'red' }, APPROVED: { label: 'Approved', color: 'green' } };
const TEMPLATES = [['classic', 'Classic'], ['sash', 'Sash'], ['panels', 'Side panels'], ['hoops', 'Hoops'], ['gradient', 'Gradient'], ['chevron', 'Chevron']];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const DEFAULT_COLORS: JerseyColors = { body: '#1d4ed8', sleeves: '#1e3a8a', collar: '#f59e0b', accent: '#f59e0b', text: '#ffffff' };

export function JerseyList() {
  const { leagueId, isStaff } = useLeague();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['jerseys', leagueId], queryFn: () => get(`/leagues/${leagueId}/jerseys`) });
  const [rules, setRules] = useState(false);
  const create = useMutation({ mutationFn: (teamId: string | null) => { const t = q.data.teams.find((x: any) => x.id === teamId); return post(`/leagues/${leagueId}/jerseys`, { teamId, name: `${t?.name ?? q.data.league.name} — Home kit`, kit: 'HOME', template: 'classic', colors: t?.color ? { ...DEFAULT_COLORS, body: t.color } : DEFAULT_COLORS }); }, onSuccess: (d) => nav(`/leagues/${leagueId}/jerseys/${d.id}`) });
  const [newTeam, setNewTeam] = useState<string>('');
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  return (
    <>
      <PageHeader title="Jersey Studio" subtitle="Design kits within league branding rules, get them approved, and send production files straight to jersey printers."
        actions={<>{isStaff && <Button variant="secondary" onClick={() => setRules(true)}><Settings2 className="h-4 w-4" />Branding rules</Button>}
          <select className="input w-auto" value={newTeam} onChange={(e) => setNewTeam(e.target.value)}>{isStaff && <option value="">League-wide kit</option>}{d.teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <Button loading={create.isPending} onClick={() => create.mutate(newTeam || (isStaff ? null : d.teams[0]?.id))}><Plus className="h-4 w-4" />New design</Button></>} />
      {!d.designs.length ? <Card><Empty icon={<Shirt className="h-5 w-5" />} title="No jersey designs yet" text="Start a design for a team. The league logo and sponsor positions are applied automatically from the branding rules." /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {d.designs.map((j: any) => {
            const team = d.teams.find((t: any) => t.id === j.teamId);
            return (
              <Link key={j.id} to={`/leagues/${leagueId}/jerseys/${j.id}`} className="card p-4 transition hover:border-brand-200 hover:shadow-pop">
                <div className="rounded-xl bg-ink-50 p-3"><JerseySvg id={`l${j.id}`} side="front" template={j.template} colors={j.colors} sponsors={j.sponsors} leagueLogo={d.league.logoUrl} teamLogo={team?.logoUrl} leagueLogoSlot={d.rules.leagueLogoSlot} teamLogoSlot={d.rules.teamLogoSlot} teamShort={team?.shortName} /></div>
                <p className="mt-3 truncate font-semibold">{j.name}</p>
                <div className="mt-1 flex items-center justify-between text-xs"><Badge color={STATUS[j.status].color}>{STATUS[j.status].label}</Badge><span className="text-ink-500">v{j.version} · {ago(j.updatedAt)}</span></div>
              </Link>
            );
          })}
        </div>
      )}
      {rules && <RulesModal leagueId={leagueId} data={d} onClose={() => setRules(false)} />}
    </>
  );
}

function RulesModal({ leagueId, data, onClose }: { leagueId: string; data: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ ...data.rules, maxSizes: data.rules.maxSizes ?? {} });
  const save = useMutation({ mutationFn: () => put(`/leagues/${leagueId}/jerseys/rules`, { leagueLogoSlot: f.leagueLogoSlot, teamLogoSlot: f.teamLogoSlot, sponsorSlots: f.sponsorSlots, maxSizes: f.maxSizes, notes: f.notes }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['jerseys', leagueId] }); onClose(); } });
  const opts = data.slots.map((s: any) => ({ value: s.key, label: s.label }));
  return (
    <Modal open onClose={onClose} size="lg" title="Kit branding rules" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save rules</Button></>}>
      <div className="space-y-4">
        <ErrorText error={save.error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="League logo position (mandatory, can't be removed)"><Select value={f.leagueLogoSlot} onChange={(e) => setF({ ...f, leagueLogoSlot: e.target.value })} options={opts} /></Field>
          <Field label="Team logo position"><Select value={f.teamLogoSlot} onChange={(e) => setF({ ...f, teamLogoSlot: e.target.value })} options={opts} /></Field>
        </div>
        <div>
          <p className="label">Positions available to sponsors · maximum print size</p>
          <div className="space-y-2">{data.slots.filter((s: any) => s.key !== f.leagueLogoSlot && s.key !== f.teamLogoSlot).map((s: any) => (
            <div key={s.key} className="grid grid-cols-[1fr_160px] items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sponsorSlots.includes(s.key)} onChange={(e) => setF({ ...f, sponsorSlots: e.target.checked ? [...f.sponsorSlots, s.key] : f.sponsorSlots.filter((x: string) => x !== s.key) })} />{s.label}</label>
              <Input value={f.maxSizes[s.key] ?? ''} onChange={(e) => setF({ ...f, maxSizes: { ...f.maxSizes, [s.key]: e.target.value } })} placeholder="e.g. 25 × 10 cm" />
            </div>
          ))}</div>
        </div>
        <Field label="Notes for designers & printers"><Textarea value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Sponsor logos in white on dark kits; follow sponsor contracts for exact sizes." /></Field>
      </div>
    </Modal>
  );
}

/** Inline every <image> as a data URL so the SVG works as a standalone production file */
async function svgFile(el: SVGSVGElement | null) {
  if (!el) return '';
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', '1500'); clone.setAttribute('height', '1700'); clone.removeAttribute('style');
  clone.querySelectorAll('[stroke-dasharray]').forEach((n) => n.remove()); // empty-slot guides are for the designer only
  for (const img of [...clone.querySelectorAll('image')]) {
    const href = img.getAttribute('href');
    if (href && !href.startsWith('data:')) {
      try { const b = await (await fetch(href)).blob(); img.setAttribute('href', await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); })); } catch { /* keep link */ }
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
const saveText = (name: string, text: string, type = 'image/svg+xml') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };

export function JerseyEditor() {
  const { leagueId, isStaff } = useLeague();
  const { jid } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ['jerseys', leagueId], queryFn: () => get(`/leagues/${leagueId}/jerseys`) });
  const dq = useQuery({ queryKey: ['jersey', jid], queryFn: () => get(`/leagues/${leagueId}/jerseys/${jid}`) });
  const [f, setF] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [review, setReview] = useState<'APPROVE' | 'CHANGES' | null>(null);
  const [note, setNote] = useState('');
  const [send, setSend] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (dq.data && !dirty) setF(dq.data); }, [dq.data]); // eslint-disable-line
  const refresh = () => { qc.invalidateQueries({ queryKey: ['jersey', jid] }); qc.invalidateQueries({ queryKey: ['jerseys', leagueId] }); };
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/jerseys/${jid}`, { name: f.name, teamId: f.teamId, kit: f.kit, template: f.template, colors: f.colors, sponsors: f.sponsors, sampleName: f.sampleName, sampleNumber: f.sampleNumber, roster: f.roster, extraSizes: f.extraSizes }), onSuccess: () => { setDirty(false); refresh(); } });
  const submit = useMutation({ mutationFn: async () => { if (dirty) await save.mutateAsync(); return post(`/leagues/${leagueId}/jerseys/${jid}/submit`); }, onSuccess: refresh });
  const decide = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/jerseys/${jid}/review`, { decision: review, note: note || undefined }), onSuccess: () => { setReview(null); setNote(''); refresh(); } });
  const remove = useMutation({ mutationFn: () => del(`/leagues/${leagueId}/jerseys/${jid}`), onSuccess: () => nav(`/leagues/${leagueId}/jerseys`) });
  if (!f || all.isLoading) return <Spinner />;
  const d = all.data;
  const rules = d.rules;
  const team = d.teams.find((t: any) => t.id === f.teamId);
  const upd = (patchObj: any) => { setF({ ...f, ...patchObj }); setDirty(true); };
  const svgProps = { template: f.template, colors: f.colors, sponsors: f.sponsors, leagueLogo: d.league.logoUrl, teamLogo: team?.logoUrl, leagueLogoSlot: rules.leagueLogoSlot, teamLogoSlot: rules.teamLogoSlot, teamShort: team?.shortName ?? team?.name, showSlots: true, allowedSlots: rules.sponsorSlots };
  const usedSlots = new Set(f.sponsors.map((s: any) => s.slot));
  const freeSlots = rules.sponsorSlots.filter((s: string) => !usedSlots.has(s));
  const slotLabel = (k: string) => d.slots.find((s: any) => s.key === k)?.label ?? k;
  const sizeCount = SIZES.map((s) => ({ s, n: f.roster.filter((r: any) => r.size === s).length + (Number(f.extraSizes?.[s]) || 0) })).filter((x) => x.n);
  const issues = dq.data.issues ?? [];
  const errors = issues.filter((i: any) => i.level === 'error');

  const exportPack = async () => {
    const front = await svgFile(frontRef.current?.querySelector('svg') ?? null);
    const back = await svgFile(backRef.current?.querySelector('svg') ?? null);
    const slug = f.name.replace(/[^\w]+/g, '_');
    saveText(`${slug}_front.svg`, front); saveText(`${slug}_back.svg`, back);
    const rows = f.roster.map((r: any) => `<tr><td>${r.name}</td><td>${r.number}</td><td>${r.size}</td></tr>`).join('');
    const sponsorRows = [`<tr><td>${slotLabel(rules.leagueLogoSlot)}</td><td>League logo (mandatory)</td><td>${rules.maxSizes?.[rules.leagueLogoSlot] ?? ''}</td></tr>`, `<tr><td>${slotLabel(rules.teamLogoSlot)}</td><td>Team logo</td><td>${rules.maxSizes?.[rules.teamLogoSlot] ?? ''}</td></tr>`, ...f.sponsors.map((s: any) => `<tr><td>${slotLabel(s.slot)}</td><td>${s.name}</td><td>${rules.maxSizes?.[s.slot] ?? ''}</td></tr>`)].join('');
    const colorRows = Object.entries(f.colors).map(([k, v]) => `<tr><td>${k}</td><td><span style="display:inline-block;width:14px;height:14px;background:${v};border:1px solid #ccc;vertical-align:middle"></span> ${String(v).toUpperCase()}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${f.name} — production spec</title><style>body{font-family:Arial;padding:24px;color:#0f172a}h1{font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin:8px 0 18px;font-size:12px}td,th{border:1px solid #e2e8f0;padding:6px;text-align:left}th{background:#f1f5f9}.k{display:flex;gap:24px}.k div{flex:1}svg{width:100%;height:auto}</style></head><body>
      <h1>${f.name} — production spec (v${f.version})</h1><p style="font-size:12px;color:#64748b">${d.league.name}${team ? ` · ${team.name}` : ''} · Template: ${f.template} · Status: ${STATUS[f.status].label}${dq.data.approvedAt ? ` on ${new Date(dq.data.approvedAt).toLocaleDateString('en-IN')}` : ''}</p>
      <div class="k"><div>${front}</div><div>${back}</div></div>
      <h3>Colours</h3><table>${colorRows}</table>
      <h3>Logo placement map</h3><table><tr><th>Position</th><th>Logo</th><th>Max print size</th></tr>${sponsorRows}</table>
      <h3>Size breakup</h3><table><tr>${sizeCount.map((x) => `<th>${x.s}</th>`).join('')}<th>Total</th></tr><tr>${sizeCount.map((x) => `<td>${x.n}</td>`).join('')}<td><b>${sizeCount.reduce((a, x) => a + x.n, 0)}</b></td></tr></table>
      <h3>Name & number list</h3><table><tr><th>Name on back</th><th>No.</th><th>Size</th></tr>${rows}</table>
      ${rules.notes ? `<h3>League notes</h3><p style="font-size:12px">${rules.notes}</p>` : ''}
    </body></html>`.replace(/<\?xml[^>]*>/g, ''));
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/jerseys`} className="hover:underline">Jersey Studio</Link>}
        title={<input value={f.name} onChange={(e) => upd({ name: e.target.value })} className="w-full rounded-lg border border-transparent bg-transparent px-1 hover:border-ink-200 focus:border-brand-500 focus:outline-none" />}
        subtitle={<span className="flex items-center gap-2"><Badge color={STATUS[f.status].color}>{STATUS[f.status].label}</Badge>v{f.version}{team && ` · ${team.name}`}</span>}
        actions={<>
          <Button variant="secondary" onClick={exportPack}><Download className="h-4 w-4" />Production pack</Button>
          <Button variant="secondary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}><Save className="h-4 w-4" />{dirty ? 'Save' : 'Saved'}</Button>
          {['DRAFT', 'CHANGES_REQUESTED'].includes(f.status) && <Button loading={submit.isPending} disabled={errors.length > 0 && !dirty} onClick={() => submit.mutate()}><Send className="h-4 w-4" />Submit for approval</Button>}
          {isStaff && f.status === 'SUBMITTED' && <><Button variant="secondary" onClick={() => setReview('CHANGES')}>Request changes</Button><Button variant="success" onClick={() => setReview('APPROVE')}><CheckCircle2 className="h-4 w-4" />Approve</Button></>}
          {isStaff && f.status === 'APPROVED' && (dq.data.rfqId ? <Link to={`/leagues/${leagueId}/procurement/rfqs/${dq.data.rfqId}`}><Button>Open printing RFQ</Button></Link> : <Button onClick={() => setSend(true)}><Send className="h-4 w-4" />Send to jersey printers</Button>)}
        </>} />
      <ErrorText error={save.error || submit.error} />
      {f.reviewNote && <div className={cx('mb-4 rounded-lg border p-3 text-sm', f.status === 'CHANGES_REQUESTED' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}><b>{f.status === 'CHANGES_REQUESTED' ? 'Changes requested:' : 'Approval note:'}</b> {f.reviewNote}</div>}
      <div className="grid gap-6 xl:grid-cols-[320px_1fr_320px]">
        <Card title="Design">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Team"><Select value={f.teamId ?? ''} onChange={(e) => upd({ teamId: e.target.value || null })} placeholder={isStaff ? 'League-wide' : undefined} options={d.teams.map((t: any) => ({ value: t.id, label: t.name }))} /></Field>
              <Field label="Kit"><Select value={f.kit} onChange={(e) => upd({ kit: e.target.value })} options={['HOME', 'AWAY', 'ALTERNATE', 'TRAINING']} /></Field>
            </div>
            <div><p className="label">Template</p><div className="grid grid-cols-3 gap-2">{TEMPLATES.map(([k, l]) => <button key={k} onClick={() => upd({ template: k })} className={cx('rounded-lg border px-2 py-1.5 text-xs font-semibold', f.template === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 hover:bg-ink-50')}>{l}</button>)}</div></div>
            <div><p className="label">Colours</p><div className="grid grid-cols-2 gap-2">{(['body', 'sleeves', 'collar', 'accent', 'text'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-ink-200 px-2 py-1.5 text-xs capitalize"><input type="color" value={f.colors[k]} onChange={(e) => upd({ colors: { ...f.colors, [k]: e.target.value } })} className="h-6 w-8 cursor-pointer rounded border-0 p-0" />{k === 'text' ? 'name & no.' : k}<span className="ml-auto font-mono text-[10px] text-ink-400">{f.colors[k]}</span></label>
            ))}</div></div>
            <div className="grid grid-cols-[1fr_70px] gap-2">
              <Field label="Preview name"><Input value={f.sampleName} maxLength={14} onChange={(e) => upd({ sampleName: e.target.value.toUpperCase() })} /></Field>
              <Field label="No."><Input value={f.sampleNumber} maxLength={3} onChange={(e) => upd({ sampleNumber: e.target.value })} /></Field>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div ref={frontRef} className="card flex flex-col items-center p-4"><p className="label self-start">Front</p><JerseySvg id="ef" side="front" {...svgProps} /></div>
          <div ref={backRef} className="card flex flex-col items-center p-4"><p className="label self-start">Back</p><JerseySvg id="eb" side="back" {...svgProps} name={f.sampleName} number={f.sampleNumber} /></div>
          <Card title="Rule check" className="sm:col-span-2">
            {!issues.length ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Meets all league branding rules{dirty && ' (save to re-check)'}</p> : (
              <ul className="space-y-1.5 text-sm">{issues.map((i: any, k: number) => <li key={k} className={cx('flex gap-2', i.level === 'error' ? 'text-red-700' : 'text-amber-700')}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{i.message}</li>)}{dirty && <li className="text-xs text-ink-500">Save to re-check the latest changes.</li>}</ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Sponsor logos">
            <ul className="space-y-2">
              {f.sponsors.map((s: any, i: number) => (
                <li key={i} className="rounded-lg border border-ink-200 p-2.5">
                  <div className="flex items-center gap-2">
                    {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-8 w-12 rounded border border-ink-100 object-contain" /> : <div className="flex h-8 w-12 items-center justify-center rounded border border-dashed border-ink-300 text-[9px] text-ink-400">logo</div>}
                    <Input className="h-8 py-1 text-xs" value={s.name} onChange={(e) => upd({ sponsors: f.sponsors.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <button onClick={() => upd({ sponsors: f.sponsors.filter((_: any, j: number) => j !== i) })} className="text-ink-300 hover:text-red-600" aria-label="Remove"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select className="input h-8 flex-1 py-0 text-xs" value={s.slot} onChange={(e) => upd({ sponsors: f.sponsors.map((x: any, j: number) => (j === i ? { ...x, slot: e.target.value } : x)) })}>{[s.slot, ...freeSlots].map((k: string) => <option key={k} value={k}>{slotLabel(k)}</option>)}</select>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 px-2 text-xs font-semibold hover:bg-ink-50"><Upload className="h-3 w-3" />Logo<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const data = await fileToDataUrl(file); upd({ sponsors: f.sponsors.map((x: any, j: number) => (j === i ? { ...x, logoUrl: data } : x)) }); }} /></label>
                  </div>
                  {rules.maxSizes?.[s.slot] && <p className="mt-1 text-[11px] text-ink-500">Max print size {rules.maxSizes[s.slot]}</p>}
                </li>
              ))}
            </ul>
            {freeSlots.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.sponsorships.filter((o: any) => !f.sponsors.some((s: any) => s.opportunityId === o.id)).slice(0, 4).map((o: any) => <Button key={o.id} size="sm" variant="secondary" onClick={() => upd({ sponsors: [...f.sponsors, { slot: freeSlots[0], name: o.title.replace(/ (Sponsor|Partner)$/, ''), logoUrl: null, opportunityId: o.id }] })}><Plus className="h-3 w-3" />{o.title}</Button>)}
                <Button size="sm" variant="ghost" onClick={() => upd({ sponsors: [...f.sponsors, { slot: freeSlots[0], name: 'Sponsor', logoUrl: null }] })}><Plus className="h-3 w-3" />Other sponsor</Button>
              </div>
            ) : <p className="mt-3 text-xs text-ink-500">All sponsor positions are used.</p>}
          </Card>
          <Card title={`Roster & sizes (${f.roster.length})`}>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {f.roster.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[1fr_48px_64px_20px] items-center gap-1.5">
                  <Input className="h-8 py-1 text-xs" value={r.name} onChange={(e) => upd({ roster: f.roster.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value.toUpperCase() } : x)) })} />
                  <Input className="h-8 px-1 py-1 text-center text-xs" value={r.number} maxLength={3} onChange={(e) => upd({ roster: f.roster.map((x: any, j: number) => (j === i ? { ...x, number: e.target.value } : x)) })} />
                  <select className="input h-8 px-1 py-0 text-xs" value={r.size} onChange={(e) => upd({ roster: f.roster.map((x: any, j: number) => (j === i ? { ...x, size: e.target.value } : x)) })}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select>
                  <button onClick={() => upd({ roster: f.roster.filter((_: any, j: number) => j !== i) })} className="text-ink-300 hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => upd({ roster: [...f.roster, { name: '', number: '', size: 'M' }] })}><Plus className="h-3 w-3" />Player</Button>
              {team && <ImportSquad leagueId={leagueId} teamId={team.id} onImport={(names) => upd({ roster: [...f.roster, ...names.filter((n) => !f.roster.some((r: any) => r.name === n.toUpperCase())).map((n, k) => ({ name: n.split(' ').slice(-1)[0].toUpperCase(), number: String(f.roster.length + k + 1), size: 'M' }))] })} />}
            </div>
            <p className="label mt-4">Spare jerseys by size</p>
            <div className="grid grid-cols-7 gap-1">{SIZES.map((s) => <label key={s} className="text-center text-[10px] text-ink-500">{s}<Input className="h-8 px-1 py-1 text-center text-xs" type="number" min={0} value={f.extraSizes?.[s] ?? ''} onChange={(e) => upd({ extraSizes: { ...f.extraSizes, [s]: e.target.value } })} /></label>)}</div>
            <p className="mt-2 text-xs text-ink-500">Total: {sizeCount.map((x) => `${x.s} ${x.n}`).join(' · ') || '—'} = <b>{sizeCount.reduce((a, x) => a + x.n, 0)}</b></p>
          </Card>
          {['DRAFT', 'CHANGES_REQUESTED'].includes(f.status) && <button onClick={() => confirm('Delete this design?') && remove.mutate()} className="w-full text-center text-xs font-semibold text-red-600 hover:underline">Delete design</button>}
        </div>
      </div>
      <Modal open={!!review} onClose={() => setReview(null)} title={review === 'APPROVE' ? 'Approve design' : 'Request changes'} footer={<><Button variant="secondary" onClick={() => setReview(null)}>Cancel</Button><Button variant={review === 'APPROVE' ? 'success' : 'primary'} loading={decide.isPending} disabled={review === 'CHANGES' && !note} onClick={() => decide.mutate()}>{review === 'APPROVE' ? 'Approve' : 'Send back'}</Button></>}>
        <ErrorText error={decide.error} />
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder={review === 'APPROVE' ? 'Optional note for the designer and printer' : 'What needs to change?'} />
      </Modal>
      {send && <SendToVendors leagueId={leagueId} design={f} rules={rules} slotLabel={slotLabel} sizeCount={sizeCount} getFiles={async () => [await svgFile(frontRef.current?.querySelector('svg') ?? null), await svgFile(backRef.current?.querySelector('svg') ?? null)]} onClose={() => setSend(false)} onSent={(rfqId) => nav(`/leagues/${leagueId}/procurement/rfqs/${rfqId}`)} />}
      {jid && <Comments className="mt-6" leagueId={leagueId} type="JerseyDesign" id={jid} title="Design feedback" />}
    </>
  );
}

function ImportSquad({ leagueId, teamId, onImport }: { leagueId: string; teamId: string; onImport: (names: string[]) => void }) {
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  const t = teams.data?.find((x) => x.id === teamId);
  if (!t?.players?.length) return null;
  return <Button size="sm" variant="ghost" onClick={() => onImport(t.players.map((p: any) => p.player.user.name))}><FileText className="h-3 w-3" />Import squad ({t.players.length})</Button>;
}

function SendToVendors({ leagueId, design, rules, slotLabel, sizeCount, getFiles, onClose, onSent }: { leagueId: string; design: any; rules: any; slotLabel: (k: string) => string; sizeCount: { s: string; n: number }[]; getFiles: () => Promise<string[]>; onClose: () => void; onSent: (id: string) => void }) {
  const vendors = useQuery({ queryKey: ['vendors-cat', 'jersey-printing', ''], queryFn: () => get<any[]>('/vendors?category=jersey-printing') });
  const [sel, setSel] = useState<string[]>([]);
  const [all, setAll] = useState(true);
  const [neededBy, setNeededBy] = useState('');
  const total = sizeCount.reduce((a, x) => a + x.n, 0);
  const specs = `Approved kit design "${design.name}" (v${design.version}), template ${design.template}.\nColours: ${Object.entries(design.colors).map(([k, v]) => `${k} ${String(v).toUpperCase()}`).join(', ')}.\nLogo placement: league logo at ${slotLabel(rules.leagueLogoSlot)}, team logo at ${slotLabel(rules.teamLogoSlot)}${design.sponsors.map((s: any) => `, ${s.name} at ${slotLabel(s.slot)}${rules.maxSizes?.[s.slot] ? ` (max ${rules.maxSizes[s.slot]})` : ''}`).join('')}.\nSizes: ${sizeCount.map((x) => `${x.s} ${x.n}`).join(', ')} — total ${total}. Names & numbers as per the roster in the production pack.\nPlease quote for sample + bulk with delivery timeline.`;
  const [text, setText] = useState(specs);
  const go = useMutation({ mutationFn: async () => { const [front, back] = await getFiles(); return post(`/leagues/${leagueId}/jerseys/${design.id}/send-to-vendors`, { vendorIds: sel, inviteAll: all, neededBy: neededBy || null, specs: text, files: [front, back].map((svg) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`) }); }, onSuccess: (r) => onSent(r.rfqId) });
  return (
    <Modal open onClose={onClose} size="lg" title="Send to jersey printers" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={go.isPending} disabled={!all && !sel.length} onClick={() => go.mutate()}><Send className="h-4 w-4" />Request quotes</Button></>}>
      <div className="space-y-3">
        <ErrorText error={go.error} />
        <p className="text-sm text-ink-500">Front & back production SVGs are attached automatically. Quotes arrive in Procurement; the awarded printer gets milestones for sample, bulk production, dispatch and delivery.</p>
        <Field label="Specification sent to printers"><Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Field label="Needed by"><Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></Field>
        <label className="flex items-center gap-2 rounded-lg bg-brand-50 p-2.5 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Invite every jersey printer on SportsIQ</label>
        {!all && <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">{vendors.data?.map((v) => <label key={v.id} className="flex items-center gap-2 p-1.5 text-sm"><input type="checkbox" checked={sel.includes(v.id)} onChange={(e) => setSel(e.target.checked ? [...sel, v.id] : sel.filter((x) => x !== v.id))} />{v.companyName} <span className="text-xs text-ink-500">{v.city} · ★ {v.rating?.toFixed(1)}</span></label>)}</div>}
      </div>
    </Modal>
  );
}
