import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { notify } from '../lib/notify.js';
import { teamSel } from '../lib/matchView.js';

/** Hotels, room allocation, travel bookings and per-team itineraries. /api/leagues/:leagueId/logistics */
const r = Router({ mergeParams: true });
r.use(requireAuth);
const dt = z.coerce.date().nullable().optional();

// ---------- Hotels & rooms ----------
const hotelSchema = z.object({ name: z.string().min(2), city: z.string().nullable().optional(), address: z.string().nullable().optional(), contact: z.string().nullable().optional(), checkIn: dt, checkOut: dt });
r.get('/hotels', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.hotel.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { name: 'asc' }, include: { rooms: { orderBy: { roomNo: 'asc' } } } }));
}));
r.post('/hotels', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.status(201).json(await prisma.hotel.create({ data: { ...hotelSchema.parse(req.body), leagueId: req.params.leagueId } })); }));
r.patch('/hotels/:hid', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.hotel.update({ where: { id: req.params.hid, leagueId: req.params.leagueId }, data: hotelSchema.partial().parse(req.body) })); }));
r.delete('/hotels/:hid', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.hotel.delete({ where: { id: req.params.hid, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

const roomSchema = z.object({ roomNo: z.string().nullable().optional(), roomType: z.string().default('Twin'), teamId: z.string().nullable().optional(), group: z.string().nullable().optional(), occupants: z.array(z.string()).default([]), checkIn: dt, checkOut: dt });
r.post('/hotels/:hid/rooms', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const hotel = await prisma.hotel.findFirstOrThrow({ where: { id: req.params.hid, leagueId: req.params.leagueId } });
  const d = roomSchema.parse(req.body);
  res.status(201).json(await prisma.roomAllocation.create({ data: { ...d, hotelId: hotel.id, checkIn: d.checkIn ?? hotel.checkIn, checkOut: d.checkOut ?? hotel.checkOut } }));
}));
r.patch('/rooms/:rid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.roomAllocation.findFirstOrThrow({ where: { id: req.params.rid, hotel: { leagueId: req.params.leagueId } } });
  res.json(await prisma.roomAllocation.update({ where: { id: req.params.rid }, data: roomSchema.partial().parse(req.body) }));
}));
r.delete('/rooms/:rid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.roomAllocation.deleteMany({ where: { id: req.params.rid, hotel: { leagueId: req.params.leagueId } } });
  res.json({ ok: true });
}));

// ---------- Travel ----------
const travelSchema = z.object({
  mode: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR']), teamId: z.string().nullable().optional(), group: z.string().nullable().optional(),
  travellers: z.array(z.string()).default([]), fromPlace: z.string().min(1), toPlace: z.string().min(1), departAt: z.coerce.date(), arriveAt: dt,
  carrier: z.string().nullable().optional(), reference: z.string().nullable().optional(), status: z.enum(['PLANNED', 'BOOKED', 'CANCELLED']).optional(), cost: z.coerce.number().int().nullable().optional(),
});
r.get('/travel', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.travelBooking.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { departAt: 'asc' } }));
}));
r.post('/travel', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const t = await prisma.travelBooking.create({ data: { ...travelSchema.parse(req.body), leagueId } });
  if (t.teamId) {
    const owners = await prisma.teamOwner.findMany({ where: { teamId: t.teamId } });
    await notify(owners.map((o) => o.userId), `Travel added: ${t.fromPlace} → ${t.toPlace}`, { body: t.departAt.toLocaleString('en-IN'), link: `/leagues/${leagueId}/logistics`, type: 'info' });
  }
  res.status(201).json(t);
}));
r.patch('/travel/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.travelBooking.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: travelSchema.partial().parse(req.body) })); }));
r.delete('/travel/:id', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); await prisma.travelBooking.delete({ where: { id: req.params.id, leagueId: req.params.leagueId } }); res.json({ ok: true }); }));

// ---------- Itinerary (team owners can see their own team's) ----------
r.get('/itinerary/:teamId', ah(async (req, res) => {
  const { leagueId, teamId } = req.params;
  const access = await assertLeague(me(req), leagueId);
  if (access === 'team' && !(await prisma.teamOwner.findFirst({ where: { teamId, userId: me(req).id } }))) return res.status(403).json({ error: 'Not your team' });
  const [team, travel, rooms, matches] = await Promise.all([
    prisma.team.findFirstOrThrow({ where: { id: teamId, leagueId }, select: { id: true, name: true, logoUrl: true } }),
    prisma.travelBooking.findMany({ where: { leagueId, teamId, status: { not: 'CANCELLED' } }, orderBy: { departAt: 'asc' } }),
    prisma.roomAllocation.findMany({ where: { teamId, hotel: { leagueId } }, include: { hotel: true } }),
    prisma.match.findMany({ where: { leagueId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }, orderBy: { startsAt: 'asc' }, include: { homeTeam: teamSel, awayTeam: teamSel, venue: true } }),
  ]);
  type Item = { at: string; kind: 'TRAVEL' | 'HOTEL' | 'MATCH'; title: string; detail: string };
  const items: Item[] = [
    ...travel.map((t): Item => ({ at: t.departAt.toISOString(), kind: 'TRAVEL', title: `${t.mode[0] + t.mode.slice(1).toLowerCase()}: ${t.fromPlace} → ${t.toPlace}`, detail: [t.carrier, t.reference && `Ref ${t.reference}`, t.arriveAt && `arrives ${t.arriveAt.toLocaleString('en-IN')}`].filter(Boolean).join(' · ') })),
    ...[...new Map(rooms.map((x) => [x.hotelId, x])).values()].map((x): Item => ({ at: (x.checkIn ?? x.hotel.checkIn ?? new Date()).toISOString(), kind: 'HOTEL', title: `Check in: ${x.hotel.name}`, detail: `${rooms.filter((y) => y.hotelId === x.hotelId).length} rooms · ${x.hotel.address ?? x.hotel.city ?? ''}` })),
    ...matches.filter((m) => m.startsAt).map((m): Item => ({ at: m.startsAt!.toISOString(), kind: 'MATCH', title: `Match ${m.number}: ${m.homeTeam?.name ?? m.homeLabel} vs ${m.awayTeam?.name ?? m.awayLabel}`, detail: [m.stage !== 'League' && m.stage, m.venue?.name].filter(Boolean).join(' · ') })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  res.json({ team, items, rooms });
}));

export default r;
