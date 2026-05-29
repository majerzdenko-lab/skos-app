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

  app.set('trust proxy', 1);

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

  // Preview template (no side effects)
  app.get(
    '/api/events/:id/categories/template-preview',
    authenticate,
    requireEventRole('ADMIN'),
    async (req, res) => {
      const setting = await prisma.setting.findUnique({ where: { key: 'category_template' } });
      const template = setting ? JSON.parse(setting.value) : defaultCategories;
      res.json(template);
    }
  );

  // Load category template
  app.post(
    '/api/events/:id/categories/load-template',
    authenticate,
    requireEventRole('ADMIN'),
    async (req, res) => {
      const setting = await prisma.setting.findUnique({ where: { key: 'category_template' } });
      const template = setting ? JSON.parse(setting.value) : defaultCategories;
      const existing = await prisma.category.count({ where: { eventId: req.params.id } });
      const created = await prisma.$transaction(
        template.map((cat: typeof defaultCategories[0], i: number) =>
          prisma.category.create({
            data: { ...cat, eventId: req.params.id, order: existing + i },
          })
        )
      );
      res.status(201).json(created);
    }
  );

  // Save current event's categories as template
  app.post(
    '/api/events/:id/categories/save-template',
    authenticate,
    requireEventRole('ADMIN'),
    async (req, res) => {
      const cats = await prisma.category.findMany({
        where: { eventId: req.params.id },
        orderBy: { order: 'asc' },
      });
      const template = cats.map(({ name, plotDimensions, plotCount, categoryType, scored }) => ({
        name, plotDimensions, plotCount, categoryType, scored,
      }));
      await prisma.setting.upsert({
        where: { key: 'category_template' },
        update: { value: JSON.stringify(template) },
        create: { key: 'category_template', value: JSON.stringify(template) },
      });
      res.json({ ok: true, count: template.length });
    }
  );

  // Cross-event participant search (for autocomplete in registration)
  app.get('/api/participants/search', authenticate, async (req, res) => {
    const q = ((req.query.q as string) ?? '').trim();
    if (q.length < 2) { res.json([]); return; }
    const userEvents = await prisma.eventUser.findMany({
      where: { userId: req.user!.id, role: { in: ['ADMIN', 'REGISTRAR'] } },
      select: { eventId: true },
    });
    const rows = await prisma.participant.findMany({
      where: {
        eventId: { in: userEvents.map((e) => e.eventId) },
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { firstName: true, lastName: true, city: true, dateOfBirth: true, email: true },
      distinct: ['firstName', 'lastName', 'city'],
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 8,
    });
    res.json(rows);
  });

  // Promote self to system admin (protected by secret token from env)
  app.post('/api/admin/promote', async (req, res) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_PROMOTE_SECRET) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { email } = req.body as { email: string };
    if (!email) { res.status(400).json({ error: 'email required' }); return; }
    const user = await prisma.user.update({ where: { email }, data: { systemRole: 'ADMIN' } });
    res.json({ ok: true, id: user.id, email: user.email, systemRole: user.systemRole });
  });

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
