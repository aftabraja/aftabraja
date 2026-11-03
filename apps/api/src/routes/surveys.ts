import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit } from '../lib/notify.js';
import { nps } from '../lib/promo.js';
import { appUrl, layout, sendEmail } from '../lib/mailer.js';

/** NPS surveys for fans, players, teams, sponsors and vendors. League side: /api/leagues/:leagueId/surveys */
const r = Router({ mergeParams: true });
r.use(requireAuth);

export const AUDIENCES = ['FANS', 'PLAYERS', 'TEAMS', 'SPONSORS', 'VENDORS', 'STAFF'];

r.get('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const surveys = await prisma.survey.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { createdAt: 'desc' }, include: { responses: { select: { score: true } } } });
  res.json(surveys.map(({ responses, ...s }) => ({ ...s, url: `${appUrl()}/s/${s.token}`, nps: nps(responses.map((x) => x.score)) })));
}));

r.post('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: req.params.leagueId } });
  const d = z.object({ title: z.string().min(3).max(100), audience: z.enum(AUDIENCES as [string, ...string[]]), matchId: z.string().nullable().optional(), question: z.string().min(10).max(200).optional(), followUp: z.string().max(200).optional(), closesAt: z.coerce.date().nullable().optional() }).parse(req.body);
  if (d.matchId && !(await prisma.match.findFirst({ where: { id: d.matchId, leagueId: l.id } }))) throw new HttpError(400, 'Unknown match');
  res.status(201).json(await prisma.survey.create({ data: { ...d, question: d.question ?? `How likely are you to recommend ${l.name} to a friend or colleague?`, leagueId: l.id, token: crypto.randomBytes(12).toString('base64url') } }));
}));

r.patch('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ active: z.boolean().optional(), closesAt: z.coerce.date().nullable().optional() }).parse(req.body);
  res.json(await prisma.survey.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: d }));
}));

r.get('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const s = await prisma.survey.findFirst({ where: { id: req.params.id, leagueId: req.params.leagueId }, include: { responses: { orderBy: { createdAt: 'desc' } } } });
  if (!s) throw new HttpError(404, 'Survey not found');
  const { responses, ...rest } = s;
  res.json({ ...rest, url: `${appUrl()}/s/${s.token}`, nps: nps(responses.map((x) => x.score)), responses });
}));

// Email the survey link to ticket buyers (all paid orders, or for the survey's match)
r.post('/:id/send-to-ticket-buyers', ah(async (req, res) => {
  const u = me(req);
  await assertLeague(u, req.params.leagueId, 'staff');
  const s = await prisma.survey.findFirst({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  if (!s) throw new HttpError(404, 'Survey not found');
  if (s.audience !== 'FANS') throw new HttpError(400, 'Only fan surveys can be sent to ticket buyers');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: s.leagueId } });
  const orders = await prisma.ticketOrder.findMany({ where: { status: 'PAID', email: { contains: '@' }, category: { leagueId: s.leagueId, ...(s.matchId && { matchId: s.matchId }) } }, select: { email: true, buyerName: true } });
  const seen = new Set<string>();
  let sent = 0;
  for (const o of orders) {
    const e = o.email.toLowerCase();
    if (seen.has(e)) continue;
    seen.add(e);
    await sendEmail(o.email, `${l.name}: how did we do?`, layout(`Hi ${o.buyerName.split(' ')[0]}, thanks for coming!`, `<p>${s.question}</p><p>It takes 20 seconds and helps us make the next match better.</p>`, { label: 'Rate us 0–10', url: `${appUrl()}/s/${s.token}` }));
    sent++;
  }
  await audit(u.id, 'send-survey', 'Survey', s.id, { sent });
  res.json({ sent });
}));

export default r;

/** Public survey: /api/public/surveys/:token */
export const publicSurveys = Router();
const openSurvey = async (token: string) => {
  const s = await prisma.survey.findUnique({ where: { token } });
  if (!s) throw new HttpError(404, 'Survey not found');
  if (!s.active || (s.closesAt && s.closesAt < new Date())) throw new HttpError(410, 'This survey is closed. Thank you!');
  return s;
};
publicSurveys.get('/:token', ah(async (req, res) => {
  const s = await openSurvey(req.params.token);
  const l = await prisma.league.findUniqueOrThrow({ where: { id: s.leagueId }, select: { name: true, logoUrl: true, primaryColor: true } });
  res.json({ title: s.title, question: s.question, followUp: s.followUp, league: l });
}));
publicSurveys.post('/:token', ah(async (req, res) => {
  const s = await openSurvey(req.params.token);
  const d = z.object({ score: z.coerce.number().int().min(0).max(10), comment: z.string().max(1000).optional(), name: z.string().max(80).optional(), email: z.string().email().optional().or(z.literal('')) }).parse(req.body);
  if (d.email && (await prisma.surveyResponse.findFirst({ where: { surveyId: s.id, email: d.email.toLowerCase() } }))) throw new HttpError(409, 'You have already answered this survey — thank you!');
  await prisma.surveyResponse.create({ data: { surveyId: s.id, score: d.score, comment: d.comment || null, name: d.name || null, email: d.email ? d.email.toLowerCase() : null } });
  res.status(201).json({ ok: true });
}));
