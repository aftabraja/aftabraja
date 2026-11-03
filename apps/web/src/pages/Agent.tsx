import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Crown, Eye, EyeOff, Pencil, Plus, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { del, get, patch, post } from '../lib/api';
import { ago, fileToDataUrl, inrShort } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Tabs, Textarea, cx } from '../components/ui';
import { PURPOSE_LABEL } from './Talent';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function AgentHome() {
  const qc = useQueryClient();
  const ws = useQuery({ queryKey: ['agent'], queryFn: () => get('/talent/me/workspace') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['agent'] });
  const [tab, setTab] = useState<'roster' | 'enquiries' | 'agency'>('roster');
  const [edit, setEdit] = useState<any>(null);
  const [publishing, setPublishing] = useState<any>(null);
  const [agree, setAgree] = useState(false);
  const pub = useMutation({ mutationFn: ({ id, publish, authorised }: any) => post(`/talent/me/talents/${id}/publish`, { publish, authorised }), onSuccess: () => { setPublishing(null); setAgree(false); refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/talent/me/talents/${id}`), onSuccess: refresh });
  const setStatus = useMutation({ mutationFn: ({ id, status }: any) => patch(`/talent/enquiries/${id}`, { status }), onSuccess: refresh });
  if (ws.isLoading) return <Spinner />;
  const { agency, enquiries, authorisationText } = ws.data;
  const open = enquiries.filter((e: any) => ['NEW', 'IN_DISCUSSION'].includes(e.status)).length;

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{agency.agencyName}{agency.verified && <BadgeCheck className="h-6 w-6 text-brand-600" />}</span>} subtitle="List the cricketers you represent. Brands find them for endorsements; leagues sign legends and book appearances."
        actions={<Button onClick={() => setEdit({ name: '', status: 'ACTIVE', playingRole: 'Batter', country: 'India', highlights: '', teamsPlayed: '', levels: '', languages: '', forEndorsement: true, forLeagues: false, forAppearances: true, matches: 0, runs: 0, wickets: 0 })}><Plus className="h-4 w-4" />Add player</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Players listed" value={agency.talents.length} icon={<Users className="h-4 w-4" />} />
        <Stat label="Live on marketplace" value={agency.talents.filter((t: any) => t.isPublished).length} />
        <Stat label="Open enquiries" value={open} />
        <Stat label="Confirmed deals" value={enquiries.filter((e: any) => e.status === 'CONFIRMED').length} tone="green" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'roster', label: 'Roster' }, { value: 'enquiries', label: `Enquiries (${enquiries.length})` }, { value: 'agency', label: 'Agency profile' }]} />

      {tab === 'roster' && (!agency.talents.length ? <Card><Empty icon={<Users className="h-5 w-5" />} title="No players yet" text="Add the active players and legends you represent." /></Card> : (
        <Card padded={false}>
          <Table head={['Player', 'Status', 'Available for', 'Indicative fees', 'Listing', '']}>
            {agency.talents.map((t: any) => (
              <tr key={t.id}>
                <td className="td"><div className="flex items-center gap-3"><Avatar name={t.name} src={t.photoUrl} size={38} /><div><p className="flex items-center gap-1 font-medium text-ink-900">{t.name}{t.verified && <BadgeCheck className="h-4 w-4 text-brand-600" />}</p><p className="text-xs text-ink-500">{[t.playingRole, t.state].filter(Boolean).join(' · ')}</p></div></div></td>
                <td className="td">{t.status === 'RETIRED' ? <Badge color="amber"><Crown className="h-3 w-3" />Legend</Badge> : <Badge color="green">Active</Badge>}</td>
                <td className="td text-xs">{[t.forEndorsement && 'Endorsements', t.forLeagues && 'Leagues', t.forAppearances && 'Appearances'].filter(Boolean).join(', ')}</td>
                <td className="td text-xs">{[t.forEndorsement && `E ${inrShort(t.endorseFeeMin)}`, t.forLeagues && `L ${inrShort(t.leagueFeeMin)}`, t.forAppearances && `A ${inrShort(t.appearanceFeeMin)}`].filter(Boolean).join(' · ')}</td>
                <td className="td">{t.isPublished ? <Badge color="green">Live</Badge> : <Badge>Draft</Badge>}{t.isPublished && !t.verified && <Badge color="amber" className="ml-1">Verification pending</Badge>}</td>
                <td className="td text-right"><div className="flex justify-end gap-1">
                  {t.isPublished ? <Button size="sm" variant="secondary" onClick={() => pub.mutate({ id: t.id, publish: false })}><EyeOff className="h-3.5 w-3.5" />Unpublish</Button> : <Button size="sm" onClick={() => setPublishing(t)}><Eye className="h-3.5 w-3.5" />Publish</Button>}
                  <button onClick={() => setEdit({ ...t, highlights: t.highlights.join('\n'), teamsPlayed: t.teamsPlayed.join(', '), levels: t.levels.join(', '), languages: t.languages.join(', ') })} className="p-1.5 text-ink-400 hover:text-ink-900" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => confirm(`Remove ${t.name}?`) && remove.mutate(t.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
          <div className="px-5 py-3"><ErrorText error={pub.error} /></div>
        </Card>
      ))}

      {tab === 'enquiries' && (
        <Card padded={false}>
          <Table head={['When', 'Player', 'From', 'Purpose', 'Budget', 'Status', '']} empty={!enquiries.length && <Empty title="No enquiries yet" text="Published, verified profiles get the most enquiries." />}>
            {enquiries.map((e: any) => (
              <tr key={e.id}>
                <td className="td">{ago(e.createdAt)}</td><td className="td font-medium text-ink-900">{e.talent.name}</td>
                <td className="td">{e.organisation || e.fromUser.sponsorProfile?.companyName || e.fromUser.name}</td><td className="td">{PURPOSE_LABEL[e.purpose]}</td>
                <td className="td">{e.budget ? inrShort(e.budget) : '—'}</td>
                <td className="td"><select className="input h-8 w-auto py-0 text-xs" value={e.status} onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value })}><option value="NEW">New</option><option value="IN_DISCUSSION">In discussion</option><option value="CONFIRMED">Confirmed</option><option value="DECLINED">Declined</option></select></td>
                <td className="td text-right">{e.conversationId && <Link to={`/messages/${e.conversationId}`}><Button size="sm" variant="secondary">Reply</Button></Link>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === 'agency' && <AgencyForm agency={agency} onSaved={refresh} />}

      {edit && <TalentForm t={edit} onClose={() => { setEdit(null); refresh(); }} />}
      <Modal open={!!publishing} onClose={() => { setPublishing(null); setAgree(false); }} title={`Publish ${publishing?.name}`} footer={<><Button variant="secondary" onClick={() => setPublishing(null)}>Cancel</Button><Button disabled={!publishing?.authorisedAt && !agree} loading={pub.isPending} onClick={() => pub.mutate({ id: publishing.id, publish: true, authorised: agree || undefined })}>Publish profile</Button></>}>
        <ErrorText error={pub.error} />
        {publishing?.authorisedAt ? <p className="text-sm text-ink-700">Authorisation already confirmed. The profile will go live on the marketplace.</p> : (
          <label className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span><ShieldCheck className="mr-1 inline h-4 w-4" />{authorisationText}</span>
          </label>
        )}
        <p className="mt-3 text-xs text-ink-500">SportsIQ verifies representation before showing the verified badge, and may remove profiles that are reported or cannot be verified.</p>
      </Modal>
    </>
  );
}

function AgencyForm({ agency, onSaved }: { agency: any; onSaved: () => void }) {
  const [f, setF] = useState({ agencyName: agency.agencyName, kind: agency.kind, city: agency.city ?? '', website: agency.website ?? '', description: agency.description ?? '' });
  const save = useMutation({ mutationFn: () => patch('/talent/me/agency', f), onSuccess: onSaved });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Agency profile" action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        <Field label="Agency / manager name" className="sm:col-span-2"><Input value={f.agencyName} onChange={set('agencyName')} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={set('kind')} options={['Agency', 'Personal manager']} /></Field>
        <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
        <Field label="Website" className="sm:col-span-2"><Input value={f.website} onChange={set('website')} /></Field>
        <Field label="About" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} /></Field>
      </div>
    </Card>
  );
}

function TalentForm({ t, onClose }: { t: any; onClose: () => void }) {
  const [f, setF] = useState(t);
  const save = useMutation({
    mutationFn: () => {
      const n = (v: any) => (v === '' || v == null ? null : Number(v));
      const b = {
        name: f.name, photoUrl: f.photoUrl || null, status: f.status, playingRole: f.playingRole || null, battingStyle: f.battingStyle || null, bowlingStyle: f.bowlingStyle || null,
        country: f.country || 'India', state: f.state || null, bornYear: n(f.bornYear), bio: f.bio || null, highlights: lines(f.highlights), teamsPlayed: csv(f.teamsPlayed), levels: csv(f.levels), languages: csv(f.languages),
        matches: Number(f.matches) || 0, runs: Number(f.runs) || 0, wickets: Number(f.wickets) || 0, followers: n(f.followers),
        forEndorsement: f.forEndorsement, forLeagues: f.forLeagues, forAppearances: f.forAppearances,
        endorseFeeMin: n(f.endorseFeeMin), endorseFeeMax: n(f.endorseFeeMax), leagueFeeMin: n(f.leagueFeeMin), leagueFeeMax: n(f.leagueFeeMax), appearanceFeeMin: n(f.appearanceFeeMin), appearanceFeeMax: n(f.appearanceFeeMax), brandRestrictions: f.brandRestrictions || null,
      };
      return t.id ? patch(`/talent/me/talents/${t.id}`, b) : post('/talent/me/talents', b);
    },
    onSuccess: onClose,
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const chk = (k: string) => (e: any) => setF({ ...f, [k]: e.target.checked });
  return (
    <Modal open onClose={onClose} size="xl" title={t.id ? `Edit ${t.name}` : 'Add player'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.name} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="space-y-5">
        <ErrorText error={save.error} />
        {t.id && t.verified && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Saving changes sends this profile back for verification.</p>}
        <div className="flex items-center gap-4">
          <Avatar name={f.name || '?'} src={f.photoUrl} size={72} />
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-semibold hover:bg-ink-50"><Upload className="h-4 w-4" />Photo<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) { if (x.size > 3e6) return alert('Use an image under 3 MB'); setF({ ...f, photoUrl: await fileToDataUrl(x) }); } }} /></label>
          <p className="text-xs text-ink-500">Use only photos you have the rights to publish.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'RETIRED', label: 'Retired / legend' }]} /></Field>
          <Field label="Role"><Select value={f.playingRole ?? ''} onChange={set('playingRole')} options={['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper']} /></Field>
          <Field label="Batting"><Input value={f.battingStyle ?? ''} onChange={set('battingStyle')} placeholder="Right-hand bat" /></Field>
          <Field label="Bowling"><Input value={f.bowlingStyle ?? ''} onChange={set('bowlingStyle')} /></Field>
          <Field label="State"><Input value={f.state ?? ''} onChange={set('state')} /></Field>
          <Field label="Born (year)"><Input type="number" value={f.bornYear ?? ''} onChange={set('bornYear')} /></Field>
          <Field label="Matches"><Input type="number" value={f.matches} onChange={set('matches')} /></Field>
          <Field label="Runs"><Input type="number" value={f.runs} onChange={set('runs')} /></Field>
          <Field label="Wickets"><Input type="number" value={f.wickets} onChange={set('wickets')} /></Field>
          <Field label="Social followers"><Input type="number" value={f.followers ?? ''} onChange={set('followers')} /></Field>
          <Field label="Levels played" hint="Comma separated" className="sm:col-span-2"><Input value={f.levels} onChange={set('levels')} placeholder="International, Franchise T20, Domestic, Legends leagues" /></Field>
          <Field label="Teams played for" hint="Comma separated" className="sm:col-span-2"><Input value={f.teamsPlayed} onChange={set('teamsPlayed')} /></Field>
          <Field label="Career highlights" hint="One per line" className="sm:col-span-2"><Textarea rows={3} value={f.highlights} onChange={set('highlights')} /></Field>
          <Field label="Bio" className="sm:col-span-2"><Textarea rows={3} value={f.bio ?? ''} onChange={set('bio')} /></Field>
          <Field label="Languages" hint="Comma separated" className="sm:col-span-2"><Input value={f.languages} onChange={set('languages')} /></Field>
          <Field label="Brand restrictions" className="sm:col-span-2"><Input value={f.brandRestrictions ?? ''} onChange={set('brandRestrictions')} placeholder="e.g. No alcohol, tobacco or betting" /></Field>
        </div>
        <div>
          <p className="label">Availability & indicative fees (₹)</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[['forEndorsement', 'Brand endorsements', 'endorseFeeMin', 'endorseFeeMax'], ['forLeagues', 'League seasons (playing legend / mentor)', 'leagueFeeMin', 'leagueFeeMax'], ['forAppearances', 'Guest appearances / events', 'appearanceFeeMin', 'appearanceFeeMax']].map(([k, label, mn, mx]) => (
              <div key={k} className={cx('rounded-xl border p-3', f[k] ? 'border-brand-300 bg-brand-50/40' : 'border-ink-200')}>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f[k]} onChange={chk(k)} />{label}</label>
                {f[k] && <div className="mt-2 grid grid-cols-2 gap-2"><Input type="number" placeholder="From" value={f[mn] ?? ''} onChange={set(mn)} /><Input type="number" placeholder="To" value={f[mx] ?? ''} onChange={set(mx)} /></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
