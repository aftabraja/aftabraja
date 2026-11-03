import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Circle, CircleDot, ExternalLink, Lightbulb, Paperclip, Sparkles, Store, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get, patch } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { fileToDataUrl } from '../../lib/format';
import { Badge, Button, Card, PageHeader, Progress, Spinner, StatusBadge, Textarea, cx } from '../../components/ui';
import { useVendorPanel } from '../../components/VendorPanel';
import { AiLogoStudio } from '../../components/AiLogoStudio';

export default function Playbook() {
  const { leagueId, league, isStaff } = useLeague();
  const qc = useQueryClient();
  const { openVendors } = useVendorPanel();
  const pb = useQuery({ queryKey: ['playbook', leagueId], queryFn: () => get(`/leagues/${leagueId}/playbook`) });
  const [openPhase, setOpenPhase] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [aiLogo, setAiLogo] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical'>('all');

  const refresh = () => { qc.invalidateQueries({ queryKey: ['playbook', leagueId] }); qc.invalidateQueries({ queryKey: ['league', leagueId] }); qc.invalidateQueries({ queryKey: ['dashboard', leagueId] }); };
  const update = useMutation({ mutationFn: ({ key, ...body }: any) => patch(`/leagues/${leagueId}/playbook/${key}`, body), onSuccess: refresh });
  const setLogo = useMutation({ mutationFn: (logoUrl: string) => patch(`/leagues/${leagueId}`, { logoUrl }), onSuccess: refresh });

  // Open the phase/step targeted by URL hash, else the first unfinished phase
  useEffect(() => {
    if (!pb.data || openPhase) return;
    const hash = window.location.hash.slice(1);
    const target = pb.data.phases.find((p: any) => p.steps.some((s: any) => s.key === hash)) ?? pb.data.phases.find((p: any) => p.done < p.steps.length) ?? pb.data.phases[0];
    setOpenPhase(target.key);
    if (hash) { setOpenStep(hash); setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }
  }, [pb.data, openPhase]);

  if (pb.isLoading || !league) return <Spinner />;
  const { progress, phases } = pb.data;

  const runAction = (a: any, step: any) => {
    if (a.type === 'vendor') openVendors(a.category, leagueId);
    if (a.type === 'ai' && a.tool === 'logo') setAiLogo(true);
    if (a.type === 'page' || a.type === 'upload' || (a.type === 'ai' && a.tool !== 'logo')) setOpenStep(step.key);
  };

  return (
    <>
      <PageHeader title="Execution Playbook" subtitle="The proven step-by-step path from idea to closing ceremony. Complete each step — SportsIQ connects you to the right module or vendor." />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 flex items-end justify-between"><span className="text-sm font-semibold">Overall progress</span><span className="text-2xl font-extrabold text-brand-700">{progress.percent}%</span></div>
            <Progress value={progress.percent} className="h-3" />
            <p className="mt-2 text-xs text-ink-500">{progress.done} of {progress.total} steps done · {progress.criticalDone} of {progress.criticalTotal} critical steps</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1 text-xs font-semibold">
            {(['all', 'pending', 'critical'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cx('rounded-md px-3 py-1.5 capitalize', filter === f ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}>{f}</button>)}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {phases.map((p: any, pi: number) => {
          const isOpen = openPhase === p.key;
          const complete = p.done === p.steps.length;
          const steps = p.steps.filter((s: any) => filter === 'all' || (filter === 'pending' ? !['DONE', 'SKIPPED'].includes(s.status) : s.critical));
          if (!steps.length) return null;
          return (
            <div key={p.key} className="card overflow-hidden">
              <button onClick={() => setOpenPhase(isOpen ? null : p.key)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-ink-50/60">
                <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', complete ? 'bg-emerald-500 text-white' : 'bg-brand-50 text-brand-700')}>{complete ? <Check className="h-4 w-4" /> : pi + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.title}</p>
                  <p className="truncate text-xs text-ink-500">{p.summary}</p>
                </div>
                <div className="hidden w-40 sm:block"><Progress value={(p.done / p.steps.length) * 100} tone={complete ? 'green' : 'brand'} /></div>
                <span className="w-10 text-right text-xs font-semibold text-ink-500">{p.done}/{p.steps.length}</span>
                <ChevronDown className={cx('h-4 w-4 text-ink-400 transition', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="divide-y divide-ink-100 border-t border-ink-100">
                  {steps.map((s: any) => (
                    <StepRow key={s.key} s={s} leagueId={leagueId} expanded={openStep === s.key} onToggle={() => setOpenStep(openStep === s.key ? null : s.key)}
                      canEdit={isStaff} onAction={(a) => runAction(a, s)} onUpdate={(body) => update.mutate({ key: s.key, ...body })} saving={update.isPending} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AiLogoStudio open={aiLogo} onClose={() => setAiLogo(false)} defaultName={league.name} defaultCode={league.shortCode ?? ''} onSelect={(u) => setLogo.mutate(u)} />
    </>
  );
}

function StepRow({ s, leagueId, expanded, onToggle, canEdit, onAction, onUpdate, saving }: { s: any; leagueId: string; expanded: boolean; onToggle: () => void; canEdit: boolean; onAction: (a: any) => void; onUpdate: (b: any) => void; saving: boolean }) {
  const [notes, setNotes] = useState(s.notes ?? '');
  const Icon = s.status === 'DONE' ? Check : s.status === 'IN_PROGRESS' ? CircleDot : Circle;
  const routeFor = (a: any) => `/leagues/${leagueId}${a.route ? `/${a.route}` : ''}`;
  return (
    <div id={s.key} className={cx('px-5 py-4', expanded && 'bg-ink-50/50')}>
      <div className="flex items-start gap-3">
        <button disabled={!canEdit} onClick={() => onUpdate({ status: s.status === 'DONE' ? 'NOT_STARTED' : 'DONE' })} aria-label="Toggle done"
          className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition', s.status === 'DONE' ? 'border-emerald-500 bg-emerald-500 text-white' : s.status === 'IN_PROGRESS' ? 'border-amber-400 text-amber-500' : 'border-ink-300 text-transparent hover:border-brand-500')}>
          <Icon className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 text-left">
            <span className={cx('font-medium', s.status === 'DONE' && 'text-ink-500 line-through decoration-ink-300')}>{s.title}</span>
            {s.critical && <Badge color="red">Critical</Badge>}
            <Badge>{s.owner}</Badge>
            {s.status !== 'NOT_STARTED' && s.status !== 'DONE' && <StatusBadge status={s.status} />}
            {s.attachments.length > 0 && <span className="flex items-center gap-0.5 text-xs text-ink-500"><Paperclip className="h-3 w-3" />{s.attachments.length}</span>}
          </button>
          <p className="mt-1 text-sm text-ink-500">{s.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.actions.map((a: any, i: number) => {
              const icon = a.type === 'vendor' ? <Store className="h-3.5 w-3.5" /> : a.type === 'ai' ? <Sparkles className="h-3.5 w-3.5 text-amber-500" /> : a.type === 'upload' ? <Upload className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />;
              if (a.type === 'page') return <Link key={i} to={routeFor(a)}><Button size="sm" variant="secondary">{icon}{a.label}</Button></Link>;
              if (a.type === 'upload') return canEdit && (
                <label key={i} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 shadow-sm hover:bg-ink-50">
                  {icon}{a.label}
                  <input type="file" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onUpdate({ attachment: await fileToDataUrl(f), status: s.status === 'NOT_STARTED' ? 'IN_PROGRESS' : s.status }); }} />
                </label>
              );
              return <Button key={i} size="sm" variant={a.type === 'vendor' ? 'primary' : 'secondary'} onClick={() => onAction(a)}>{icon}{a.label}</Button>;
            })}
          </div>
          {expanded && (
            <div className="mt-4 space-y-3">
              {s.tip && <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />{s.tip}</div>}
              {s.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {s.attachments.map((u: string, i: number) => <a key={i} href={u} download={`${s.key}-${i + 1}`} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs hover:bg-ink-50"><Paperclip className="h-3 w-3" />Attachment {i + 1}</a>)}
                </div>
              )}
              {canEdit && (
                <>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes, decisions, owner, deadlines…" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" loading={saving} onClick={() => onUpdate({ notes })}>Save notes</Button>
                    {s.status !== 'IN_PROGRESS' && <Button size="sm" variant="secondary" onClick={() => onUpdate({ status: 'IN_PROGRESS' })}>Mark in progress</Button>}
                    {s.status !== 'DONE' && <Button size="sm" variant="success" onClick={() => onUpdate({ status: 'DONE', notes })}><Check className="h-3.5 w-3.5" />Mark done</Button>}
                    {!s.critical && s.status !== 'SKIPPED' && <Button size="sm" variant="ghost" onClick={() => onUpdate({ status: 'SKIPPED' })}>Not applicable</Button>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
