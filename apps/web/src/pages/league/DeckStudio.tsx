import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, FileDown, Plus, Presentation, Save, Store, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { ago } from '../../lib/format';
import { Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, cx } from '../../components/ui';
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
  useEffect(() => { if (deck.data && !slides) { setSlides(deck.data.slides); setTitle(deck.data.title); } }, [deck.data, slides]);
  const save = useMutation({ mutationFn: () => patch(`/leagues/${leagueId}/studio/decks/${deckId}`, { title, slides }), onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['decks', leagueId] }); } });
  if (!slides || !league) return <Spinner />;

  const brand = { name: league.name, logoUrl: league.logoUrl, color: league.primaryColor };
  const s = slides[cur];
  const upd = (patchObj: Partial<SlideData>) => { setSlides(slides.map((x, i) => (i === cur ? { ...x, ...patchObj } : x))); setDirty(true); };
  const move = (dir: -1 | 1) => { const j = cur + dir; if (j < 0 || j >= slides.length) return; const n = [...slides]; [n[cur], n[j]] = [n[j], n[cur]]; setSlides(n); setCur(j); setDirty(true); };
  const add = (layout: SlideData['layout']) => { const n = [...slides]; n.splice(cur + 1, 0, { layout, title: 'New slide', bullets: layout === 'bullets' ? ['First point'] : undefined, stats: layout === 'stats' ? [{ label: 'Label', value: '0' }] : undefined, rows: layout === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined }); setSlides(n); setCur(cur + 1); setDirty(true); };

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
        actions={<><Button variant="secondary" onClick={exportPdf}><FileDown className="h-4 w-4" />Export PDF</Button><Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}><Save className="h-4 w-4" />{dirty ? 'Save' : 'Saved'}</Button></>} />
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
            {s.layout === 'bullets' && <Field label="Bullet points" hint="One per line"><Textarea rows={8} value={(s.bullets ?? []).join('\n')} onChange={(e) => upd({ bullets: e.target.value.split('\n') })} /></Field>}
            {s.layout === 'stats' && <Field label="Stats" hint="One per line: value | label"><Textarea rows={6} value={(s.stats ?? []).map((x) => `${x.value} | ${x.label}`).join('\n')} onChange={(e) => upd({ stats: e.target.value.split('\n').map((l) => { const [value, ...rest] = l.split('|'); return { value: value.trim(), label: rest.join('|').trim() }; }) })} /></Field>}
            {s.layout === 'table' && <Field label="Table" hint="One row per line, cells separated by |  (first row = header)"><Textarea rows={8} value={(s.rows ?? []).map((r) => r.join(' | ')).join('\n')} onChange={(e) => upd({ rows: e.target.value.split('\n').map((l) => l.split('|').map((c) => c.trim())) })} /></Field>}
            <div className="border-t border-ink-100 pt-3">
              <p className="label">Add slide after this</p>
              <div className="flex flex-wrap gap-2">{(['bullets', 'stats', 'table', 'cover', 'closing'] as const).map((l) => <Button key={l} size="sm" variant="secondary" onClick={() => add(l)}><Plus className="h-3 w-3" />{l}</Button>)}</div>
            </div>
            <Field label="Layout"><Select value={s.layout} onChange={(e) => upd({ layout: e.target.value as SlideData['layout'] })} options={['cover', 'bullets', 'stats', 'table', 'closing']} /></Field>
          </div>
        </Card>
      </div>
    </>
  );
}
