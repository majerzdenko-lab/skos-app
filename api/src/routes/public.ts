import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { validate } from '../middleware/validate';

const router = Router();

const publicRegisterSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  city: z.string().min(1),
  dateOfBirth: z.string().optional(),
  email: z.string().email().optional(),
  emailConsent: z.boolean().optional().default(false),
  categoryId: z.string().min(1),
});

router.get('/events/:id/public', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, date: true, location: true, edition: true, status: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

router.get('/events/:id/registration-open', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    select: { status: true },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ open: event.status === 'REGISTRATION' });
});

router.post('/events/:id/register-public', validate(publicRegisterSchema), async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { status: true } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (event.status !== 'REGISTRATION') {
    res.status(403).json({ error: 'Registration is not open' });
    return;
  }

  const { categoryId, email, emailConsent, ...rest } = req.body;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId: req.params.id },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  let unsubscribeToken: string | undefined;
  if (email && emailConsent) {
    unsubscribeToken = crypto.randomUUID();
  }

  const result = await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({
      data: {
        ...rest,
        eventId: req.params.id,
        email: email || null,
        emailConsent: emailConsent ?? false,
        unsubscribeToken: unsubscribeToken ?? null,
      },
    });
    await tx.entry.create({ data: { participantId: participant.id, categoryId } });
    return participant;
  });

  res.status(201).json({
    id: result.id,
    firstName: result.firstName,
    lastName: result.lastName,
    city: result.city,
  });
});

router.get('/events/:id/results', async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { eventId: req.params.id },
    include: {
      entries: {
        include: { participant: { select: { firstName: true, lastName: true, city: true, dateOfBirth: true } } },
        orderBy: { rank: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });
  res.json(categories);
});

router.get('/unsubscribe/:token', async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { unsubscribeToken: req.params.token },
  });
  if (!participant) {
    res.status(404).json({ error: 'Invalid unsubscribe token' });
    return;
  }
  await prisma.participant.update({
    where: { id: participant.id },
    data: { emailConsent: false },
  });
  res.json({ ok: true, message: 'Úspešne ste sa odhlásili z odberu správ.' });
});

router.post('/events/:id/send-announcement', async (req, res) => {
  res.status(501).json({ error: 'Announcement endpoint requires authentication — use the admin API' });
});

export default router;
