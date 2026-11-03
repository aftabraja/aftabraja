import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { standings } from '../lib/standings.js';
import { matchView, teamSel } from '../lib/matchView.js';
import { subscribe } from '../lib/realtime.js';

/** Public fan-facing data: league page, fixtures, live scores, points table, tickets. No auth. */
const r = Router();

r.get('/leagues/:slug', ah(async (req, res) => {
  const l = await prisma.league.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true, name: true, shortCode: true, slug: true, sport: true, format: true, category: true, city: true, description: true, logoUrl: true,
      primaryColor: true, startDate: true, endDate: true, isPublic: true, status: true,
      teams: { select: { id: true, name: true, shortName: true, logoUrl: true, color: true }, orderBy: { name: 'asc' } },
    },
  });
  if (!l || !l.isPublic) throw new HttpError(404, 'League not found');
  const [matches, table, tickets] = await Promise.all([
    prisma.match.findMany({ where: { leagueId: l.id, isPublished: true }, orderBy: [{ startsAt: 'asc' }, { number: 'asc' }], include: { homeTeam: teamSel, awayTeam: teamSel, venue: { select: { name: true, city: true } } } }),
    standings(l.id),
    prisma.ticketCategory.findMany({ where: { leagueId: l.id, isActive: true }, include: { match: { select: { id: true, number: true, startsAt: true, homeTeam: teamSel, awayTeam: teamSel } } }, orderBy: { price: 'asc' } }),
  ]);
  res.json({ league: l, matches, standings: table.rows, tickets: tickets.map((t) => ({ ...t, available: t.quantity - t.sold })) });
}));

r.get('/matches/:id', ah(async (req, res) => {
  const v = await matchView(req.params.id);
  if (!v.isPublished) throw new HttpError(404, 'Match not found');
  res.json(v);
}));

r.get('/matches/:id/stream', (req, res) => subscribe(req, res, `match:${req.params.id}`));

export default r;
