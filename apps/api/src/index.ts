import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './lib/http.js';
import auth from './routes/auth.js';
import leagues from './routes/leagues.js';
import vendors from './routes/vendors.js';
import sponsors from './routes/sponsors.js';
import players from './routes/players.js';
import finance from './routes/finance.js';
import messages from './routes/messages.js';
import notifications from './routes/notifications.js';
import admin from './routes/admin.js';
import studio from './routes/studio.js';
import fixtures from './routes/fixtures.js';
import auction from './routes/auction.js';
import trials from './routes/trials.js';
import logistics from './routes/logistics.js';
import ticketing, { publicTickets } from './routes/ticketing.js';
import payments, { qrRouter } from './routes/payments.js';
import publicRoutes from './routes/public.js';
import accreditation, { publicAccreditation } from './routes/accreditation.js';
import { PLAYBOOK } from './data/playbook.js';
import { subscribe } from './lib/realtime.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '5mb' })); // logos/attachments as data URLs (move to object storage later)
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sportsiq-api' }));
app.get('/api/playbook', (_req, res) => res.json(PLAYBOOK));
app.use('/api/auth', auth);
// Live streams (SSE). EventSource cannot send auth headers; streams only signal "something changed" —
// clients then refetch through authenticated endpoints, so no private data is pushed here.
app.get('/api/leagues/:leagueId/auction/stream', (req, res) => subscribe(req, res, `auction:${req.params.leagueId}`));
app.get('/api/leagues/:leagueId/matches/:mid/stream', (req, res) => subscribe(req, res, `match:${req.params.mid}`));
app.use('/api/leagues', leagues);
app.use('/api/leagues/:leagueId/finance', finance);
app.use('/api/leagues/:leagueId/studio', studio);
app.use('/api/leagues/:leagueId/auction', auction);
app.use('/api/leagues/:leagueId/trials', trials);
app.use('/api/leagues/:leagueId/logistics', logistics);
app.use('/api/leagues/:leagueId/tickets', ticketing);
app.use('/api/leagues/:leagueId/accreditation', accreditation);
app.use('/api/leagues/:leagueId', fixtures);
app.use('/api/public/tickets', publicTickets);
app.use('/api/public/accreditation', publicAccreditation);
app.use('/api/public', publicRoutes);
app.use('/api/payments', payments);
app.use('/api/qr', qrRouter);
app.use('/api/vendors', vendors);
app.use('/api/sponsors', sponsors);
app.use('/api/players', players);
app.use('/api/messages', messages);
app.use('/api/notifications', notifications);
app.use('/api/admin', admin);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`SportsIQ API on http://localhost:${port}`));
