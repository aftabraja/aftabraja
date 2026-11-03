import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { del, patch } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { dateInput, fileToDataUrl } from '../../lib/format';
import { Avatar, Button, Card, ErrorText, Field, Input, PageHeader, Select, Spinner, Textarea } from '../../components/ui';
import { AiLogoStudio } from '../../components/AiLogoStudio';
import { SeasonsCard } from '../../components/Seasons';

export default function Settings() {
  const { leagueId, league, isAdmin } = useLeague();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState<any>(null);
  const [ai, setAi] = useState(false);
  useEffect(() => { if (league && !f) setF({ ...league, startDate: dateInput(league.startDate), endDate: dateInput(league.endDate), teamPurse: league.teamPurse ?? '' }); }, [league, f]);
  const save = useMutation({
    mutationFn: () => patch(`/leagues/${leagueId}`, {
      name: f.name, shortCode: f.shortCode || null, sport: f.sport, format: f.format, category: f.category, city: f.city, description: f.description,
      logoUrl: f.logoUrl || null, startDate: f.startDate || null, endDate: f.endDate || null, teamPurse: f.teamPurse || null, status: f.status, isPublic: f.isPublic,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['league', leagueId] }); qc.invalidateQueries({ queryKey: ['playbook', leagueId] }); },
  });
  const remove = useMutation({ mutationFn: () => del(`/leagues/${leagueId}`), onSuccess: () => nav('/leagues') });
  if (!f) return <Spinner />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-4xl">
      <PageHeader title="League Settings" subtitle="Identity, dates, visibility and status." actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>} />
      {save.isSuccess && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved.</div>}
      <ErrorText error={save.error} />
      <div className="space-y-6">
        <Card title="Identity">
          <div className="grid gap-6 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Avatar name={f.name} src={f.logoUrl} size={120} />
              <label className="block cursor-pointer text-center text-xs font-semibold text-brand-700 hover:underline">Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, logoUrl: await fileToDataUrl(x) }); }} /></label>
              <button onClick={() => setAi(true)} className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-amber-600 hover:underline"><Sparkles className="h-3 w-3" />AI logo</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="League name" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
              <Field label="Short code"><Input value={f.shortCode ?? ''} onChange={set('shortCode')} /></Field>
              <Field label="Sport"><Input value={f.sport} onChange={set('sport')} /></Field>
              <Field label="Format"><Input value={f.format ?? ''} onChange={set('format')} /></Field>
              <Field label="Category"><Input value={f.category ?? ''} onChange={set('category')} /></Field>
              <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea value={f.description ?? ''} onChange={set('description')} /></Field>
            </div>
          </div>
        </Card>
        <Card title="Season & status">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start date"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
            <Field label="End date"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
            <Field label="Team purse (₹)"><Input type="number" value={f.teamPurse} onChange={set('teamPurse')} /></Field>
            <Field label="Status"><Select value={f.status} onChange={set('status')} options={['DRAFT', 'PLANNING', 'REGISTRATION_OPEN', 'LIVE', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} /></Field>
            <Field label="Visibility" hint="Public leagues appear to sponsors and players"><Select value={f.isPublic ? 'yes' : 'no'} onChange={(e) => setF({ ...f, isPublic: e.target.value === 'yes' })} options={[{ value: 'yes', label: 'Public' }, { value: 'no', label: 'Private' }]} /></Field>
          </div>
        </Card>
        {league && <SeasonsCard leagueId={leagueId} league={league} isAdmin={isAdmin} />}
        {isAdmin && (
          <Card title={<span className="text-red-600">Danger zone</span>}>
            <div className="flex items-center justify-between gap-4"><p className="text-sm text-ink-500">Permanently delete this league and all its data.</p><Button variant="danger" loading={remove.isPending} onClick={() => confirm(`Type OK to delete ${league.name}`) && remove.mutate()}>Delete league</Button></div>
          </Card>
        )}
      </div>
      <AiLogoStudio open={ai} onClose={() => setAi(false)} defaultName={f.name} defaultCode={f.shortCode ?? ''} onSelect={(u) => setF({ ...f, logoUrl: u })} />
    </div>
  );
}
