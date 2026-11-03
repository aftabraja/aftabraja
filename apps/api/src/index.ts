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
import reports from './routes/reports.js';
import talent from './routes/talent.js';
import procurement, { vendorPortal } from './routes/procurement.js';
import { PLAYBOOK } from './data/playbook.js';
import { subscribe } from './lib/realtime.js';
import rateLimit from 'express-rate-limit';
import { persistUploads, UPLOAD_DIR } from './lib/storage.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use(express.json({ limit: '8mb' }));
// Rate limits: brute-force protection on auth, and a general ceiling per IP
const noLimits = process.env.DISABLE_RATE_LIMIT === 'true'; // automated tests only
const limiter = (windowMin: number, max: number, message: string, byEmail = false) => rateLimit({
  windowMs: windowMin * 60_000, max, standardHeaders: true, legacyHeaders: false, message: { error: message }, skip: () => noLimits,
  ...(byEmail && { keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase()}` }),
});
app.use('/api/auth/login', limiter(15, 10, 'Too many login attempts. Please wait 15 minutes and try again.', true));
app.use('/api/auth/forgot-password', limiter(60, 5, 'Too many reset requests. Please try again later.', true));
app.use('/api/auth/register', limiter(60, 20, 'Too many sign-ups from this network. Please try again later.'));
app.use('/api/public', limiter(10, 300, 'Too many requests. Please slow down.'));
app.use('/api', limiter(1, 1200, 'Too many requests. Please slow down.'));
// Uploaded files live in file storage, never in the database
app.use(persistUploads);
app.use('/files', (_req, res, next) => { res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); }, express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true }));
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
app.use('/api/leagues/:leagueId/reports', reports);
app.use('/api/leagues/:leagueId/procurement', procurement);
app.use('/api/vendor-portal', vendorPortal);
app.use('/api/leagues/:leagueId', fixtures);
app.use('/api/public/tickets', publicTickets);
app.use('/api/public/accreditation', publicAccreditation);
app.use('/api/public', publicRoutes);
app.use('/api/payments', payments);
app.use('/api/talent', talent);
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
