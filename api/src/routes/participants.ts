import { Router } from 'express';
import { z } from 'zod';
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
  categoryId: z.string().min(1),
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

  const category = await prisma.category.findFirst({
    where: { id: categoryId, eventId: req.params.id },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({
      data: { ...participantData, eventId: req.params.id },
    });
    const entry = await tx.entry.create({
      data: { participantId: participant.id, categoryId },
    });
    return { participant, entry };
  });

  res.status(201).json(result.participant);
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
  const updated = await prisma.participant.update({
    where: { id: req.params.pid },
    data: updateData,
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
