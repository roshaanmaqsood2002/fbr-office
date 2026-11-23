import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { errorHandler, notFound } from './middlewares/error';
import { teamRouter } from './modules/team/team.routes';
import { requireRole } from './middlewares/rbac';
import { authenticate } from './middlewares/auth';
import { businessRouter } from './modules/business/business.routes';
import { firmRouter } from './modules/firms/firms.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { PROVINCES, SALE_TYPES, SCENARIOS } from './modules/fbr/fbr.reference';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));  
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true }), authRouter);
app.use('/api/team', authenticate, requireRole('owner', 'admin'), teamRouter);  
app.use('/api/businesses', authenticate, businessRouter);
app.use('/api/firm', authenticate, firmRouter);
app.use('/api/dashboard', authenticate, dashboardRouter);
app.get('/api/reference/fbr', authenticate, (_req, res) => {
  res.json({ scenarios: SCENARIOS, saleTypes: SALE_TYPES, provinces: PROVINCES });
});

app.use(notFound);
app.use(errorHandler  );