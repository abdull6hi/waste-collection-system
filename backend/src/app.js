import 'express-async-errors'; // Patches Express to catch thrown errors in async handlers
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import healthRouter    from './routes/health.routes.js';
import authRouter      from './routes/auth.routes.js';
import collectorRouter from './routes/collector.routes.js';
import zoneRouter      from './routes/zone.routes.js';
import scheduleRouter  from './routes/schedule.routes.js';
import pickupRouter    from './routes/pickup.routes.js';
import userRouter      from './routes/user.routes.js';
import complaintRouter from './routes/complaint.routes.js';
import reportRouter    from './routes/report.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

const app = express();

// Trust the first proxy hop so IP-based rate limiting is correct behind a reverse proxy
app.set('trust proxy', 1);

app.use(helmet());
// CORS_ORIGIN is validated as a required env var at startup (see config/validateEnv.js)
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Global rate limiter — applied before all routes to protect every endpoint.
// Auth routes have their own tighter per-route limit (10 req / 15 min) in addition.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests — please try again later.' } },
});
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));

app.use('/api/health',     healthRouter);
app.use('/api/auth',       authRouter);
app.use('/api/collectors', collectorRouter);
app.use('/api/zones',      zoneRouter);
app.use('/api/schedules',  scheduleRouter);
app.use('/api/pickups',    pickupRouter);
app.use('/api/users',      userRouter);
app.use('/api/complaints', complaintRouter);
app.use('/api/reports',    reportRouter);

// 404 for any unmatched /api route
app.use('/api', notFound);

// Central error handler (must be last)
app.use(errorHandler);

export default app;
