import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, FileDown, ImagePlus, Link2, Plus, Presentation, Save, Store, Trash2 } from 'lucide-react';
import { exportPptx } from '../../lib/pptx';
import { fileToDataUrl } from '../../lib/format';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago, date } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, cx } from '../../components/ui';
import { ScaledSlide, SlideCanvas, type SlideData } from '../../components/Slide';
import { useVendorPanel } from '../../components/VendorPanel';

export function DeckList() {
  const { leagueId } = useLeague();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const types = useQuery({ queryKey: ['deck-types'], queryFn: () => get<any[]>(`/leagues/${leagueId}/studio/decks/types`) });
  const decks = useQuery({ queryKey: ['decks', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/studio/decks`) });
  const [pick, setPick] = useState<any>(null);
  const [audience, setAudience] = useState('');
  const create = useMutation({ mutationFn: () => post(`/leagues/${leagueId}/studio/decks`, { type: pick.key, audience: audience || undefined }), onSuccess: (d) => nav(`/leagues/${leagueId}/decks/${d.id}`) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/studio/decks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['decks', leagueId] }) });

  return (
    <>
      <PageHeader title="Deck Studio" subtitle="Start from a SportsIQ sample deck — filled automatically with your league's data — then edit every slide and export to PDF."
        actions={<Button variant="secondary" onClick={() => openVendors('presentation-design', leagueId)}><Store className="h-4 w-4" />Hire a deck designer</Button>} />
      <p className="label">Sample decks</p>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {types.data?.map((t) => (
          <button key={t.key} onClick={() => { setPick(t); setAudience(''); }} className="card p-5 text-left transition hover:border-brand-200 hover:shadow-pop">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Presentation className="h-5 w-5" /></div>
            <p className="font-semibold">{t.title}</p>
            <p className="mt-1 text-xs text-ink-500">{t.description}</p>
            <p className="mt-3 text-xs font-semibold text-brand-700">Use template →</p>
          </button>
        ))}
      </div>
      <Card title="My decks" padded={false}>
        {decks.isLoading ? <Spinner /> : (
          <Table head={['Deck', 'Type', 'Updated', '']} empty={!decks.data?.length && <Empty icon={<Presentation className="h-5 w-5" />} title="No decks yet" text="Pick a sample deck above to get started." />}>
            {decks.data?.map((d) => (
              <tr key={d.id}>
                <td className="td"><Link to={`/leagues/${leagueId}/decks/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">{d.title}</Link></td>
                <td className="td capitalize">{d.type}</td>
                <td className="td">{ago(d.updatedAt)}</td>
                <td className="td text-right"><div className="flex justify-end gap-1"><Link to={`/leagues/${leagueId}/decks/${d.id}`}><Button size="sm" variant="secondary">Open</Button></Link><button onClick={() => confirm('Delete deck?') && remove.mutate(d.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!pick} onClose={() => setPick(null)} title={pick?.title} footer={<><Button variant="secondary" onClick={() => setPick(null)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create deck</Button></>}>
        <ErrorText error={create.error} />
        <p className="mb-4 text-sm text-ink-500">{pick?.description} Slides are pre-filled from your league, teams and sponsorship inventory.</p>
        <Field label="Prepared for (optional)" hint="Creates a personalised version, e.g. for a specific sponsor"><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="FreshBrew Beverages" /></Field>
      </Modal>
    </>
  );
}

export function DeckEditor() {
  const { leagueId, league } = useLeague();
  const { deckId } = useParams();
  const qc = useQueryClient();
  const deck = useQuery({ queryKey: ['deck', deckId], queryFn: () => get(`/leagues/${leagueId}/studio/decks/${deckId}`) });
  const [slides, setSlides] = useState<SlideData[] | null>(null);
  const [title, setTitle] = useState('');
  const [cur, setCur] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  useEffect(() => { if (deck.data && !slides) { setSlides(deck.data.slides); setTitle(deck.data.title); } }, [deck.data, slides]);
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/studio/decks/${deckId}`, { title, slides }), onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['decks', leagueId] }); } });
  if (!slides || !league) return <Spinner />;

  const brand = { name: league.name, logoUrl: league.logoUrl, color: league.primaryColor };
  const s = slides[cur];
  const upd = (patchObj: Partial<SlideData>) => { setSlides(slides.map((x, i) => (i === cur ? { ...x, ...patchObj } : x))); setDirty(true); };
  const move = (dir: -1 | 1) => { const j = cur + dir; if (j < 0 || j >= slides.length) return; const n = [...slides]; [n[cur], n[j]] = [n[j], n[cur]]; setSlides(n); setCur(j); setDirty(true); };
  const add = (layout: SlideData['layout']) => { const n = [...slides]; n.splice(cur + 1, 0, { layout, title: 'New slide', bullets: layout === 'bullets' ? ['First point'] : undefined, stats: layout === 'stats' ? [{ label: 'Label', value: '0' }] : undefined, rows: layout === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined }); setSlides(n); setCur(cur + 1); setDirty(true); };

  const readImages = async (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (list.some((f) => f.size > 5e6)) { alert('Each image must be under 5 MB'); return []; }
    return Promise.all(list.map(fileToDataUrl));
  };
  const addImageSlides = async (files: FileList | null) => {
    const urls = await readImages(files);
    if (!urls.length) return;
    const n = [...slides];
    n.splice(cur + 1, 0, ...urls.map((u, k) => ({ layout: 'image' as const, title: urls.length > 1 ? `Image ${k + 1}` : 'Image', imageUrl: u })));
    setSlides(n); setCur(cur + 1); setDirty(true);
  };
  const pptx = async () => { setPptxBusy(true); try { await exportPptx(title, slides, brand); } catch (e) { alert(`PowerPoint export failed: ${(e as Error).message}`); } finally { setPptxBusy(false); } };

  const exportPdf = () => {
    const html = slides.map((x, i) => `<div class="pg">${renderToStaticMarkup(<SlideCanvas s={x} brand={brand} index={i} total={slides.length} />)}</div>`).join('');
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${title}</title>${styles}<style>@page{size:960px 540px;margin:0}body{margin:0}.pg{width:960px;height:540px;page-break-after:always;overflow:hidden}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to={`/leagues/${leagueId}/decks`} className="hover:underline">Deck Studio</Link>}
        title={<input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="w-full rounded-lg border border-transparent bg-transparent px-1 hover:border-ink-200 focus:border-brand-500 focus:outline-none" />}
        actions={<><Button variant="secondary" onClick={() => setSharing(true)}><Link2 className="h-4 w-4" />Share link</Button><Button variant="secondary" loading={pptxBusy} onClick={pptx}><FileDown className="h-4 w-4" />PowerPoint</Button><Button variant="secondary" onClick={exportPdf}><FileDown className="h-4 w-4" />PDF</Button><Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}><Save className="h-4 w-4" />{dirty ? 'Save' : 'Saved'}</Button></>} />
      <div className="grid gap-6 xl:grid-cols-[180px_1fr_340px]">
        <div className="flex gap-3 overflow-x-auto xl:max-h-[calc(100vh-12rem)] xl:flex-col xl:overflow-y-auto xl:pr-1">
          {slides.map((x, i) => (
            <button key={i} onClick={() => setCur(i)} className={cx('w-40 shrink-0 rounded-lg p-1 text-left ring-2 transition xl:w-full', i === cur ? 'ring-brand-600' : 'ring-transparent hover:ring-ink-200')}>
              <ScaledSlide s={x} brand={brand} index={i} total={slides.length} />
              <p className="mt-1 truncate px-1 text-[11px] text-ink-500">{i + 1}. {x.title}</p>
            </button>
          ))}
        </div>
        <div><ScaledSlide s={s} brand={brand} index={cur} total={slides.length} /></div>
        <Card title={`Slide ${cur + 1} — ${s.layout}`} action={<div className="flex gap-1">
          <button onClick={() => move(-1)} className="rounded p-1 hover:bg-ink-100" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
          <button onClick={() => move(1)} className="rounded p-1 hover:bg-ink-100" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
          <button onClick={() => { const n = [...slides]; n.splice(cur + 1, 0, structuredClone(s)); setSlides(n); setDirty(true); }} className="rounded p-1 hover:bg-ink-100" aria-label="Duplicate"><Copy className="h-4 w-4" /></button>
          <button disabled={slides.length < 2} onClick={() => { setSlides(slides.filter((_, i) => i !== cur)); setCur(Math.max(0, cur - 1)); setDirty(true); }} className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>}>
          <div className="space-y-3">
            <Field label="Title"><Input value={s.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
            <Field label="Subtitle"><Input value={s.subtitle ?? ''} onChange={(e) => upd({ subtitle: e.target.value })} /></Field>
            {s.layout === 'image' && <>
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 text-sm font-semibold text-ink-700 hover:bg-ink-50"><ImagePlus className="h-4 w-4" />{s.imageUrl ? 'Replace image' : 'Upload image'}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const [u] = await readImages(e.target.files); if (u) upd({ imageUrl: u }); e.target.value = ''; }} /></label>
              <Field label="Caption"><Input value={s.caption ?? ''} onChange={(e) => upd({ caption: e.target.value })} /></Field>
            </>}
            {s.layout === 'bullets' && <Field label="Bullet points" hint="One per line"><Textarea rows={8} value={(s.bullets ?? []).join('\n')} onChange={(e) => upd({ bullets: e.target.value.split('\n') })} /></Field>}
            {s.layout === 'stats' && <Field label="Stats" hint="One per line: value | label"><Textarea rows={6} value={(s.stats ?? []).map((x) => `${x.value} | ${x.label}`).join('\n')} onChange={(e) => upd({ stats: e.target.value.split('\n').map((l) => { const [value, ...rest] = l.split('|'); return { value: value.trim(), label: rest.join('|').trim() }; }) })} /></Field>}
            {s.layout === 'table' && <Field label="Table" hint="One row per line, cells separated by |  (first row = header)"><Textarea rows={8} value={(s.rows ?? []).map((r) => r.join(' | ')).join('\n')} onChange={(e) => upd({ rows: e.target.value.split('\n').map((l) => l.split('|').map((c) => c.trim())) })} /></Field>}
            <Field label="Speaker notes" hint="Exported to PowerPoint; never shown on share links"><Textarea rows={3} value={s.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} /></Field>
            <div className="border-t border-ink-100 pt-3">
              <p className="label">Add slide after this</p>
              <div className="flex flex-wrap gap-2">{(['bullets', 'stats', 'table', 'cover', 'closing'] as const).map((l) => <Button key={l} size="sm" variant="secondary" onClick={() => add(l)}><Plus className="h-3 w-3" />{l}</Button>)}
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-xs font-semibold hover:bg-ink-50"><ImagePlus className="h-3 w-3" />image slides<input type="file" multiple accept="image/*" className="hidden" onChange={(e) => { addImageSlides(e.target.files); e.target.value = ''; }} /></label></div>
            </div>
            <Field label="Layout"><Select value={s.layout} onChange={(e) => upd({ layout: e.target.value as SlideData['layout'] })} options={['cover', 'bullets', 'stats', 'table', 'image', 'closing']} /></Field>
          </div>
        </Card>
      </div>
      {sharing && <ShareModal deckId={deckId!} dirty={dirty} onClose={() => setSharing(false)} />}
    </>
  );
}

function ShareModal({ deckId, dirty, onClose }: { deckId: string; dirty: boolean; onClose: () => void }) {
  const { leagueId } = useLeague();
  const base = `/leagues/${leagueId}/studio/decks/${deckId}/shares`;
  const list = useQuery({ queryKey: ['deck-shares', deckId], queryFn: () => get<any[]>(base) });
  const [f, setF] = useState({ label: '', watermark: '', expiresInDays: 14, allowDownload: false });
  const [copied, setCopied] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => post(base, { ...f, watermark: f.watermark || undefined }), onSuccess: (sh: any) => { setF({ ...f, label: '', watermark: '' }); list.refetch(); copy(sh.token); } });
  const revoke = useMutation({ mutationFn: (id: string) => post(`${base}/${id}/revoke`, {}), onSuccess: () => list.refetch() });
  const url = (t: string) => `${window.location.origin}/d/${t}`;
  const copy = (t: string) => { navigator.clipboard?.writeText(url(t)); setCopied(t); setTimeout(() => setCopied(null), 2000); };
  const state = (x: any) => (x.revokedAt ? ['revoked', 'gray'] : x.expiresAt && new Date(x.expiresAt) < new Date() ? ['expired', 'amber'] : ['active', 'green']);
  return (
    <Modal open onClose={onClose} size="lg" title="Share a view-only link" footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      {dirty && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">You have unsaved changes — save first so the link shows the latest version.</p>}
      <p className="mb-3 text-sm text-ink-500">Each link is personal: it carries a watermark with the recipient's name, expires automatically and can be revoked. Speaker notes are never shared.</p>
      <ErrorText error={create.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shared with"><Input value={f.label} placeholder="FreshBrew Beverages — Anita (Marketing)" onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Watermark" hint="Defaults to 'Confidential — prepared for …'"><Input value={f.watermark} onChange={(e) => setF({ ...f, watermark: e.target.value })} /></Field>
        <Field label="Expires after"><Select value={String(f.expiresInDays)} onChange={(e) => setF({ ...f, expiresInDays: Number(e.target.value) })} options={[1, 3, 7, 14, 30, 90].map((d) => ({ value: String(d), label: `${d} day${d > 1 ? 's' : ''}` }))} /></Field>
        <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allowDownload} onChange={(e) => setF({ ...f, allowDownload: e.target.checked })} />Allow PDF download (watermarked)</label>
      </div>
      <Button className="mt-3" disabled={f.label.length < 2} loading={create.isPending} onClick={() => create.mutate()}><Link2 className="h-4 w-4" />Create link & copy</Button>
      <div className="mt-5">
        <p className="label">Links</p>
        {list.isLoading ? <Spinner /> : !list.data?.length ? <p className="text-sm text-ink-500">No links yet.</p> : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {list.data.map((x) => { const [st, col] = state(x); return (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{x.label}</p><p className="text-xs text-ink-500">{x.views} view{x.views === 1 ? '' : 's'}{x.lastViewedAt ? ` · last ${ago(x.lastViewedAt)}` : ''} · {x.expiresAt ? `expires ${date(x.expiresAt)}` : 'no expiry'}{x.allowDownload ? ' · download on' : ''}</p></div>
                <Badge color={col}>{st}</Badge>
                {st === 'active' && <><Button size="sm" variant="secondary" onClick={() => copy(x.token)}>{copied === x.token ? 'Copied!' : 'Copy'}</Button><Button size="sm" variant="ghost" onClick={() => revoke.mutate(x.id)}>Revoke</Button></>}
              </li>
            ); })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
