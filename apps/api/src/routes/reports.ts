import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit } from '../lib/notify.js';
import { REPORTS, reportByKey } from '../reports/registry.js';
import { toCsv, toPdf, toXlsx } from '../reports/export.js';

/** Reports centre. /api/leagues/:leagueId/reports */
const r = Router({ mergeParams: true });
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(REPORTS.map(({ run: _r, ...d }) => d));
}));

r.get('/:key', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const def = reportByKey(req.params.key);
  if (!def) throw new HttpError(404, 'Report not found');
  const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json') }).parse(req.query);
  const period = { from: q.from, to: q.to ? new Date(q.to.getTime() + 864e5 - 1) : undefined };
  const result = await def.run(leagueId, period);
  if (q.format === 'json') return res.json({ ...def, run: undefined, ...result });

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: { name: true, shortCode: true } });
  const periodText = def.usesPeriod && (q.from || q.to) ? `${q.from ? q.from.toLocaleDateString('en-IN') : 'start'} – ${q.to ? q.to.toLocaleDateString('en-IN') : 'today'}` : undefined;
  const meta = { title: def.title, league: league.name, period: periodText, generatedBy: me(req).name };
  const file = `${(league.shortCode ?? league.name).replace(/[^\w]+/g, '_')}_${def.key}_${new Date().toISOString().slice(0, 10)}`;
  await audit(me(req).id, `export-${q.format}`, 'Report', def.key, { leagueId });
  if (q.format === 'csv') {
    res.setHeader('Content-Disposition', `attachment; filename="${file}.csv"`);
    return res.type('text/csv; charset=utf-8').send(toCsv(result));
  }
  if (q.format === 'xlsx') {
    res.setHeader('Content-Disposition', `attachment; filename="${file}.xlsx"`);
    return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await toXlsx(result, meta));
  }
  res.setHeader('Content-Disposition', `attachment; filename="${file}.pdf"`);
  res.type('application/pdf').send(await toPdf(result, meta));
}));

export default r;
