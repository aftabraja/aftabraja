import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, Bus, Car, Hotel as HotelIcon, Plane, Plus, Printer, Store, Train, Trash2, Trophy } from 'lucide-react';
import { del, get, patch, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { inr } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Tabs, Textarea, cx } from '../../components/ui';
import { useVendorPanel } from '../../components/VendorPanel';

const dt = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const MODE_ICON: Record<string, any> = { FLIGHT: Plane, TRAIN: Train, BUS: Bus, CAR: Car };

export default function Logistics() {
  const { leagueId, isStaff, league } = useLeague();
  const [tab, setTab] = useState<'hotels' | 'travel' | 'itinerary'>(league?.access === 'team' ? 'itinerary' : 'hotels');
  const { openVendors } = useVendorPanel();
  const teams = useQuery({ queryKey: ['teams', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/teams`) });
  return (
    <>
      <PageHeader title="Travel & Hotels" subtitle="Hotels and rooming lists, flights and transport, and a day-by-day itinerary for every team."
        actions={isStaff && <><Button variant="secondary" onClick={() => openVendors('hotels', leagueId)}><Store className="h-4 w-4" />Find hotels</Button><Button variant="secondary" onClick={() => openVendors('travel-agency', leagueId)}><Store className="h-4 w-4" />Find travel agents</Button></>} />
      <Tabs value={tab} onChange={setTab} tabs={[...(isStaff ? [{ value: 'hotels' as const, label: 'Hotels & rooming' }, { value: 'travel' as const, label: 'Travel' }] : []), { value: 'itinerary' as const, label: 'Team itineraries' }]} />
      {tab === 'hotels' && <Hotels leagueId={leagueId} teams={teams.data ?? []} />}
      {tab === 'travel' && <Travel leagueId={leagueId} teams={teams.data ?? []} />}
      {tab === 'itinerary' && <Itineraries leagueId={leagueId} teams={teams.data ?? []} />}
    </>
  );
}

function Hotels({ leagueId, teams }: { leagueId: string; teams: any[] }) {
  const qc = useQueryClient();
  const hotels = useQuery({ queryKey: ['hotels', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/logistics/hotels`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hotels', leagueId] });
  const [hotel, setHotel] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const saveHotel = useMutation({ mutationFn: () => { const b = { ...hotel, checkIn: hotel.checkIn || null, checkOut: hotel.checkOut || null }; delete b.id; delete b.rooms; delete b.leagueId; delete b.createdAt; return hotel.id ? patch(`/leagues/${leagueId}/logistics/hotels/${hotel.id}`, b) : post(`/leagues/${leagueId}/logistics/hotels`, b); }, onSuccess: () => { setHotel(null); refresh(); } });
  const delHotel = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/logistics/hotels/${id}`), onSuccess: refresh });
  const saveRoom = useMutation({
    mutationFn: () => { const b = { roomNo: room.roomNo || null, roomType: room.roomType, teamId: room.teamId || null, group: room.group || (teams.find((t) => t.id === room.teamId)?.name ?? null), occupants: room.occupants.split('\n').map((s: string) => s.trim()).filter(Boolean) }; return room.id ? patch(`/leagues/${leagueId}/logistics/rooms/${room.id}`, b) : post(`/leagues/${leagueId}/logistics/hotels/${room.hotelId}/rooms`, b); },
    onSuccess: () => { setRoom(null); refresh(); },
  });
  const delRoom = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/logistics/rooms/${id}`), onSuccess: refresh });
  if (hotels.isLoading) return <Spinner />;
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setHotel({ name: '', city: '', address: '', contact: '', checkIn: '', checkOut: '' })}><Plus className="h-4 w-4" />Add hotel</Button></div>
      {!hotels.data!.length ? <Card><Empty icon={<HotelIcon className="h-5 w-5" />} title="No hotels yet" text="Add the team and officials hotels, then allocate rooms." /></Card> : (
        <div className="space-y-6">
          {hotels.data!.map((h) => (
            <Card key={h.id} padded={false} title={<span>{h.name} <span className="font-normal text-ink-500">· {[h.city, h.contact].filter(Boolean).join(' · ')}</span></span>}
              action={<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setRoom({ hotelId: h.id, roomNo: '', roomType: 'Twin', teamId: '', group: '', occupants: '' })}><BedDouble className="h-3.5 w-3.5" />Allocate room</Button><Button size="sm" variant="ghost" onClick={() => setHotel({ ...h, checkIn: h.checkIn?.slice(0, 10) ?? '', checkOut: h.checkOut?.slice(0, 10) ?? '' })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => confirm('Delete hotel and its rooming list?') && delHotel.mutate(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>}>
              <p className="border-b border-ink-100 px-5 py-2 text-xs text-ink-500">{h.address ?? ''} · Check-in {h.checkIn ? new Date(h.checkIn).toLocaleDateString('en-IN') : '—'} · Check-out {h.checkOut ? new Date(h.checkOut).toLocaleDateString('en-IN') : '—'} · {h.rooms.length} rooms · {h.rooms.reduce((s: number, r: any) => s + r.occupants.length, 0)} guests</p>
              <Table head={['Room', 'Type', 'Group / team', 'Occupants', '']} empty={!h.rooms.length && <Empty title="No rooms allocated" />}>
                {h.rooms.map((r: any) => (
                  <tr key={r.id}>
                    <td className="td font-semibold text-ink-900">{r.roomNo ?? '—'}</td><td className="td">{r.roomType}</td><td className="td">{r.group ?? '—'}</td>
                    <td className="td whitespace-normal">{r.occupants.join(', ') || '—'}</td>
                    <td className="td text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setRoom({ ...r, hotelId: h.id, teamId: r.teamId ?? '', occupants: r.occupants.join('\n') })}>Edit</Button><button onClick={() => delRoom.mutate(r.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </Table>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!hotel} onClose={() => setHotel(null)} title={hotel?.id ? 'Edit hotel' : 'Add hotel'} footer={<><Button variant="secondary" onClick={() => setHotel(null)}>Cancel</Button><Button disabled={!hotel?.name} loading={saveHotel.isPending} onClick={() => saveHotel.mutate()}>Save</Button></>}>
        {hotel && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={saveHotel.error} /></div>
          <Field label="Hotel name" className="col-span-2"><Input value={hotel.name} onChange={(e) => setHotel({ ...hotel, name: e.target.value })} /></Field>
          <Field label="City"><Input value={hotel.city ?? ''} onChange={(e) => setHotel({ ...hotel, city: e.target.value })} /></Field>
          <Field label="Contact"><Input value={hotel.contact ?? ''} onChange={(e) => setHotel({ ...hotel, contact: e.target.value })} /></Field>
          <Field label="Address" className="col-span-2"><Input value={hotel.address ?? ''} onChange={(e) => setHotel({ ...hotel, address: e.target.value })} /></Field>
          <Field label="Check-in"><Input type="date" value={hotel.checkIn} onChange={(e) => setHotel({ ...hotel, checkIn: e.target.value })} /></Field>
          <Field label="Check-out"><Input type="date" value={hotel.checkOut} onChange={(e) => setHotel({ ...hotel, checkOut: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!room} onClose={() => setRoom(null)} title="Room allocation" footer={<><Button variant="secondary" onClick={() => setRoom(null)}>Cancel</Button><Button loading={saveRoom.isPending} onClick={() => saveRoom.mutate()}>Save</Button></>}>
        {room && <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><ErrorText error={saveRoom.error} /></div>
          <Field label="Room no."><Input value={room.roomNo ?? ''} onChange={(e) => setRoom({ ...room, roomNo: e.target.value })} /></Field>
          <Field label="Type"><Select value={room.roomType} onChange={(e) => setRoom({ ...room, roomType: e.target.value })} options={['Single', 'Twin', 'Double', 'Triple', 'Suite']} /></Field>
          <Field label="Team"><Select value={room.teamId} onChange={(e) => setRoom({ ...room, teamId: e.target.value })} placeholder="— not a team —" options={teams.map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="Or group"><Input value={room.group ?? ''} onChange={(e) => setRoom({ ...room, group: e.target.value })} placeholder="Officials, Broadcast crew…" /></Field>
          <Field label="Occupants" hint="One per line" className="col-span-2"><Textarea rows={3} value={room.occupants} onChange={(e) => setRoom({ ...room, occupants: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  );
}

function Travel({ leagueId, teams }: { leagueId: string; teams: any[] }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['travel', leagueId], queryFn: () => get<any[]>(`/leagues/${leagueId}/logistics/travel`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['travel', leagueId] });
  const [f, setF] = useState<any>(null);
  const save = useMutation({
    mutationFn: () => { const b = { mode: f.mode, teamId: f.teamId || null, group: f.group || null, travellers: f.travellers.split('\n').map((s: string) => s.trim()).filter(Boolean), fromPlace: f.fromPlace, toPlace: f.toPlace, departAt: new Date(f.departAt).toISOString(), arriveAt: f.arriveAt ? new Date(f.arriveAt).toISOString() : null, carrier: f.carrier || null, reference: f.reference || null, status: f.status, cost: f.cost || null }; return f.id ? patch(`/leagues/${leagueId}/logistics/travel/${f.id}`, b) : post(`/leagues/${leagueId}/logistics/travel`, b); },
    onSuccess: () => { setF(null); refresh(); },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/leagues/${leagueId}/logistics/travel/${id}`), onSuccess: refresh });
  const local = (d?: string | null) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const total = (list.data ?? []).filter((t) => t.status !== 'CANCELLED').reduce((s, t) => s + (t.cost ?? 0), 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between"><p className="text-sm text-ink-500">Total travel cost: <b className="text-ink-900">{inr(total)}</b> — record it under Finance → Travel.</p><Button onClick={() => setF({ mode: 'FLIGHT', teamId: '', group: '', travellers: '', fromPlace: '', toPlace: '', departAt: '', arriveAt: '', carrier: '', reference: '', status: 'PLANNED', cost: '' })}><Plus className="h-4 w-4" />Add travel</Button></div>
      <Card padded={false}>
        {list.isLoading ? <Spinner /> : (
          <Table head={['Mode', 'Route', 'Departs', 'Arrives', 'Team / group', 'Pax', 'Carrier · Ref', 'Cost', 'Status', '']} empty={!list.data!.length && <Empty icon={<Plane className="h-5 w-5" />} title="No travel planned" />}>
            {list.data!.map((t) => { const I = MODE_ICON[t.mode]; return (
              <tr key={t.id}>
                <td className="td"><I className="h-4 w-4 text-brand-700" /></td>
                <td className="td font-medium text-ink-900">{t.fromPlace} → {t.toPlace}</td><td className="td">{dt(t.departAt)}</td><td className="td">{dt(t.arriveAt)}</td>
                <td className="td">{teams.find((x) => x.id === t.teamId)?.name ?? t.group ?? '—'}</td><td className="td">{t.travellers.length}</td>
                <td className="td">{[t.carrier, t.reference].filter(Boolean).join(' · ') || '—'}</td><td className="td">{inr(t.cost)}</td><td className="td"><StatusBadge status={t.status === 'BOOKED' ? 'PAID' : t.status === 'PLANNED' ? 'PENDING' : 'CANCELLED'} /></td>
                <td className="td text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setF({ ...t, teamId: t.teamId ?? '', group: t.group ?? '', travellers: t.travellers.join('\n'), departAt: local(t.departAt), arriveAt: local(t.arriveAt), carrier: t.carrier ?? '', reference: t.reference ?? '', cost: t.cost ?? '' })}>Edit</Button><button onClick={() => remove.mutate(t.id)} className="p-1.5 text-ink-300 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
              </tr>
            ); })}
          </Table>
        )}
      </Card>
      <Modal open={!!f} onClose={() => setF(null)} size="lg" title={f?.id ? 'Edit travel' : 'Add travel'} footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancel</Button><Button disabled={!f?.fromPlace || !f?.toPlace || !f?.departAt} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        {f && <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3"><ErrorText error={save.error} /></div>
          <Field label="Mode"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[{ value: 'FLIGHT', label: 'Flight' }, { value: 'TRAIN', label: 'Train' }, { value: 'BUS', label: 'Bus' }, { value: 'CAR', label: 'Car / cab' }]} /></Field>
          <Field label="From"><Input value={f.fromPlace} onChange={(e) => setF({ ...f, fromPlace: e.target.value })} /></Field>
          <Field label="To"><Input value={f.toPlace} onChange={(e) => setF({ ...f, toPlace: e.target.value })} /></Field>
          <Field label="Departs"><Input type="datetime-local" value={f.departAt} onChange={(e) => setF({ ...f, departAt: e.target.value })} /></Field>
          <Field label="Arrives"><Input type="datetime-local" value={f.arriveAt} onChange={(e) => setF({ ...f, arriveAt: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={['PLANNED', 'BOOKED', 'CANCELLED']} /></Field>
          <Field label="Team"><Select value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })} placeholder="— not a team —" options={teams.map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="Or group"><Input value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} placeholder="Officials…" /></Field>
          <Field label="Cost (₹)"><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label="Carrier / flight no."><Input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
          <Field label="PNR / booking ref" className="sm:col-span-2"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="Travellers" hint="One per line" className="sm:col-span-3"><Textarea rows={3} value={f.travellers} onChange={(e) => setF({ ...f, travellers: e.target.value })} /></Field>
        </div>}
      </Modal>
    </>
  );
}

function Itineraries({ leagueId, teams }: { leagueId: string; teams: any[] }) {
  const [teamId, setTeamId] = useState('');
  const tid = teamId || teams[0]?.id;
  const it = useQuery({ queryKey: ['itinerary', tid], queryFn: () => get(`/leagues/${leagueId}/logistics/itinerary/${tid}`), enabled: !!tid });
  const icon = { TRAVEL: Plane, HOTEL: HotelIcon, MATCH: Trophy } as Record<string, any>;
  const tone = { TRAVEL: 'bg-brand-50 text-brand-700', HOTEL: 'bg-amber-50 text-amber-700', MATCH: 'bg-emerald-50 text-emerald-700' } as Record<string, string>;
  if (!teams.length) return <Card><Empty title="No teams" /></Card>;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <select className="input w-auto" value={tid} onChange={(e) => setTeamId(e.target.value)}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / save PDF</Button>
      </div>
      {it.isLoading || !it.data ? <Spinner /> : (
        <Card title={<span className="flex items-center gap-2"><Avatar name={it.data.team.name} src={it.data.team.logoUrl} size={28} />{it.data.team.name} — itinerary</span>}>
          {!it.data.items.length ? <Empty title="Nothing scheduled yet" text="Matches, travel and hotel check-ins for this team will appear here." /> : (
            <ol className="relative space-y-4 border-l-2 border-ink-100 pl-6">
              {it.data.items.map((x: any, i: number) => { const I = icon[x.kind]; return (
                <li key={i} className="relative">
                  <span className={cx('absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white', tone[x.kind])}><I className="h-3.5 w-3.5" /></span>
                  <p className="text-xs font-semibold text-ink-500">{new Date(x.at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="font-semibold">{x.title}</p>
                  {x.detail && <p className="text-sm text-ink-500">{x.detail}</p>}
                </li>
              ); })}
            </ol>
          )}
          {it.data.rooms.length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <p className="label">Rooming list</p>
              <div className="flex flex-wrap gap-2">{it.data.rooms.map((r: any) => <Badge key={r.id}>{r.hotel.name} · {r.roomNo ?? r.roomType}: {r.occupants.join(', ') || '—'}</Badge>)}</div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
