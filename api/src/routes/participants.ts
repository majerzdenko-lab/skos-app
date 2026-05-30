import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';

const router = Router();

const participantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  city: z.string().min(1),
  dateOfBirth: z.string().optional(),
  email: z.string().email().optional(),
  emailConsent: z.boolean().optional().default(false),
  categoryId: z.string().optional(),
});

const makeJudgeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.get('/:id/participants', authenticate, requireEventRole('ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR'), async (req, res) => {
  const participants = await prisma.participant.findMany({
    where: { eventId: req.params.id },
    include: { entries: { include: { category: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(participants);
});

router.post('/:id/participants', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), validate(participantSchema), async (req, res) => {
  const { categoryId, ...participantData } = req.body;

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, eventId: req.params.id },
    });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({
      data: { ...participantData, eventId: req.params.id },
    });
    if (categoryId) {
      await tx.entry.create({ data: { participantId: participant.id, categoryId } });
    }
    return participant;
  });

  res.status(201).json(result);
});

// POST /:id/participants/:pid/make-judge — assign participant as judge with login
router.post('/:id/participants/:pid/make-judge', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), validate(makeJudgeSchema), async (req, res) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.pid, eventId: req.params.id },
  });
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };
  const passwordHash = await bcrypt.hash(password, 12);

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, firstName: participant.firstName, lastName: participant.lastName },
    });
  } else {
    user = await prisma.user.create({
      data: { email, passwordHash, firstName: participant.firstName, lastName: participant.lastName },
    });
  }

  await prisma.participant.update({ where: { id: participant.id }, data: { userId: user.id } });

  await prisma.eventUser.upsert({
    where: { userId_eventId: { userId: user.id, eventId: req.params.id } },
    update: { role: 'JUDGE' },
    create: { userId: user.id, eventId: req.params.id, role: 'JUDGE' },
  });

  res.json({ ok: true, email: user.email });
});

router.put('/:id/participants/:pid', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), validate(participantSchema.partial()), async (req, res) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.pid, eventId: req.params.id },
  });
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const { categoryId, ...updateData } = req.body;

  await prisma.$transaction(async (tx) => {
    await tx.participant.update({ where: { id: req.params.pid }, data: updateData });
    if (categoryId !== undefined) {
      await tx.entry.deleteMany({ where: { participantId: req.params.pid } });
      if (categoryId) {
        await tx.entry.create({ data: { participantId: req.params.pid, categoryId } });
      }
    }
  });

  const updated = await prisma.participant.findFirst({
    where: { id: req.params.pid },
    include: { entries: { include: { category: true } } },
  });
  res.json(updated);
});

router.delete('/:id/participants/:pid', authenticate, requireEventRole('ADMIN'), async (req, res) => {
  const participant = await prisma.participant.findFirst({
    where: { id: req.params.pid, eventId: req.params.id },
  });
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  await prisma.participant.delete({ where: { id: req.params.pid } });
  res.json({ ok: true });
});

export default router;
