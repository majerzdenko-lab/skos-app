import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import categoryRoutes from './routes/categories';
import participantRoutes from './routes/participants';
import entryRoutes from './routes/entries';
import teamRoutes from './routes/teams';
import userRoutes from './routes/users';
import exportRoutes from './routes/export';
import publicRoutes from './routes/public';
import { defaultCategories } from './data/defaultCategories';
import { authenticate } from './middleware/authenticate';
import { requireEventRole } from './middleware/requireRole';
import { prisma } from './prisma';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Rate limits
  const generalLimit = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
  const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
  const publicRegLimit = rateLimit({ windowMs: 60 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

  app.use('/api', generalLimit);
  app.use('/api/auth/login', loginLimit);
  app.use('/api/events/:id/register-public', publicRegLimit);

  // Health check (no auth)
  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  // Default category template endpoint
  app.post(
    '/api/events/:id/categories/load-template',
    authenticate,
    requireEventRole('ADMIN'),
    async (req, res) => {
      const existing = await prisma.category.count({ where: { eventId: req.params.id } });
      const created = await prisma.$transaction(
        defaultCategories.map((cat, i) =>
          prisma.category.create({
            data: { ...cat, eventId: req.params.id, order: existing + i },
          })
        )
      );
      res.status(201).json(created);
    }
  );

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/events', categoryRoutes);
  app.use('/api/events', participantRoutes);
  app.use('/api/events', userRoutes);
  app.use('/api/events', exportRoutes);
  app.use('/api', entryRoutes);
  app.use('/api', teamRoutes);
  app.use('/api', publicRoutes);

  return app;
}
