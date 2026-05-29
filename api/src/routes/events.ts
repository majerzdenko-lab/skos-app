import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { getIo } from '../socket';

const router = Router();

const createEventSchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime(),
  location: z.string().min(1),
  edition: z.number().int().positive().optional(),
});

const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().datetime().optional(),
  location: z.string().min(1).optional(),
  edition: z.number().int().positive().optional(),
});

const statusSchema = z.object({
  status: z.enum(['SETUP', 'REGISTRATION', 'DRAW', 'ACTIVE', 'CLOSED']),
});

router.get('/', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { systemRole: true } });
  if (user?.systemRole === 'ADMIN') {
    const events = await prisma.event.findMany({ orderBy: { date: 'desc' } });
    res.json(events);
    return;
  }
  const userEventIds = await prisma.eventUser.findMany({
    where: { userId: req.user!.id },
    select: { eventId: true },
  });
  const events = await prisma.event.findMany({
    where: { id: { in: userEventIds.map((e) => e.eventId) } },
    orderBy: { date: 'desc' },
  });
  res.json(events);
});

router.post('/', authenticate, validate(createEventSchema), async (req, res) => {
  const event = await prisma.event.create({
    data: {
      name: req.body.name,
      date: new Date(req.body.date),
      location: req.body.location,
      edition: req.body.edition,
      eventUsers: {
        create: { userId: req.user!.id, role: 'ADMIN' },
      },
    },
  });
  res.status(201).json(event);
});

router.get('/:id/my-role', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { systemRole: true } });
  if (user?.systemRole === 'ADMIN') {
    const eu = await prisma.eventUser.findUnique({
      where: { userId_eventId: { userId: req.user!.id, eventId: req.params.id } },
    });
    res.json({ role: eu?.role ?? 'ADMIN' });
    return;
  }
  const eu = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId: req.user!.id, eventId: req.params.id } },
  });
  if (!eu) { res.status(403).json({ error: 'Forbidden' }); return; }
  res.json({ role: eu.role });
});

router.get('/:id', authenticate, requireEventRole('ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR'), async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

router.patch('/:id', authenticate, requireEventRole('ADMIN'), validate(updateEventSchema), async (req, res) => {
  const data: Record<string, unknown> = { ...req.body };
  if (req.body.date) data.date = new Date(req.body.date as string);
  const event = await prisma.event.update({ where: { id: req.params.id }, data });
  res.json(event);
});

router.patch('/:id/status', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), validate(statusSchema), async (req, res) => {
  if (req.body.status === 'ACTIVE') {
    const cats = await prisma.category.findMany({
      where: { eventId: req.params.id, categoryType: 'INDIVIDUAL' },
      include: { entries: { select: { plotNumber: true } } },
    });
    const anyUndrawn = cats.some((c) => c.entries.some((e) => e.plotNumber == null));
    if (anyUndrawn) {
      res.status(400).json({ error: 'Všetky kategórie musia byť vyžrebované pred začatím súťaže.' });
      return;
    }
  }
  if (req.body.status === 'CLOSED') {
    const cats = await prisma.category.findMany({
      where: { eventId: req.params.id, scored: true },
      include: { entries: { select: { rank: true, dnr: true, baseTime: true } } },
    });
    const openCats = cats.filter((c) =>
      c.entries.length > 0 && c.entries.some((e) => !e.dnr && e.rank == null)
    );
    if (openCats.length > 0) {
      res.status(400).json({
        error: `Pred uzavretím súťaže musíte uzatvoriť všetky kategórie. Ešte otvorené: ${openCats.map((c) => c.name).join(', ')}.`,
      });
      return;
    }
  }
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });
  getIo().to(`event:${req.params.id}`).emit('event:status', { status: event.status });
  res.json(event);
});

export default router;
