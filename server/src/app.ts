import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { farmsRouter, zonesRouter } from './routes/farms.js';
import { measurementsRouter } from './routes/measurements.js';
import { devicesRouter, deviceRouter } from './routes/devices.js';
import { deviceIngestRouter } from './routes/deviceIngest.js';
import { cropsRouter, farmAgronomyRouter } from './routes/agronomy.js';
import { aiRouter } from './routes/ai.js';
import { fertilizerRouter } from './routes/fertilizer.js';
import { biopodRouter } from './routes/biopod.js';
import { farmFinanceRouter, seasonRouter } from './routes/finance.js';
import { insightsRouter } from './routes/insights.js';
import { demoRouter } from './routes/demo.js';
import { reportsRouter } from './routes/reports.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  const limit = (windowMin: number, max: number) => rateLimit({ windowMs: windowMin * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests, please try again later' } });

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Devices authenticate with their own key, not the user session.
  app.use('/api/device/v1', limit(1, 120), deviceIngestRouter);

  app.use('/api/auth', limit(15, config.isProd ? 30 : 300), authRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/farms/:farmId/measurements', measurementsRouter);
  api.use('/farms/:farmId/devices', devicesRouter);
  api.use('/farms/:farmId/fertilizer', fertilizerRouter);
  api.use('/farms/:farmId/finance', farmFinanceRouter);
  api.use('/farms/:farmId', farmAgronomyRouter);
  api.use('/farms/:farmId', insightsRouter);
  api.use('/farms', farmsRouter);
  api.use('/zones', zonesRouter);
  api.use('/devices', deviceRouter);
  api.use('/crops', cropsRouter);
  api.use('/ai', limit(15, 60), aiRouter);
  api.use('/biopod', biopodRouter);
  api.use('/seasons', seasonRouter);
  api.use('/demo', demoRouter);
  api.use('/reports', reportsRouter);
  app.use('/api', limit(1, 600), api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the API also serves the built frontend.
  const webDist = path.resolve(process.cwd(), '../web/dist');
  if (config.isProd && fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
