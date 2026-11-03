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
import { PLAYBOOK } from './data/playbook.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '5mb' })); // logos/attachments as data URLs (move to object storage later)
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sportsiq-api' }));
app.get('/api/playbook', (_req, res) => res.json(PLAYBOOK));
app.use('/api/auth', auth);
app.use('/api/leagues', leagues);
app.use('/api/leagues/:leagueId/finance', finance);
app.use('/api/leagues/:leagueId/studio', studio);
app.use('/api/vendors', vendors);
app.use('/api/sponsors', sponsors);
app.use('/api/players', players);
app.use('/api/messages', messages);
app.use('/api/notifications', notifications);
app.use('/api/admin', admin);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`SportsIQ API on http://localhost:${port}`));
