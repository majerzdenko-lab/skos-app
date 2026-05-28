import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR']),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR']),
});

router.get('/:id/users', authenticate, requireEventRole('ADMIN'), async (req, res) => {
  const eventUsers = await prisma.eventUser.findMany({
    where: { eventId: req.params.id },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  res.json(eventUsers);
});

router.post('/:id/users', authenticate, requireEventRole('ADMIN'), validate(inviteSchema), async (req, res) => {
  const { email, role } = req.body;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email } });
  }

  const existing = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId: user.id, eventId: req.params.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'User already has access to this event' });
    return;
  }

  const eventUser = await prisma.eventUser.create({
    data: { userId: user.id, eventId: req.params.id, role },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(eventUser);
});

router.patch('/:id/users/:userId', authenticate, requireEventRole('ADMIN'), validate(updateRoleSchema), async (req, res) => {
  const eventUser = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId: req.params.userId, eventId: req.params.id } },
  });
  if (!eventUser) {
    res.status(404).json({ error: 'User not found on this event' });
    return;
  }
  const updated = await prisma.eventUser.update({
    where: { userId_eventId: { userId: req.params.userId, eventId: req.params.id } },
    data: { role: req.body.role },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  res.json(updated);
});

router.delete('/:id/users/:userId', authenticate, requireEventRole('ADMIN'), async (req, res) => {
  const eventUser = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId: req.params.userId, eventId: req.params.id } },
  });
  if (!eventUser) {
    res.status(404).json({ error: 'User not found on this event' });
    return;
  }
  // Prevent removing last admin
  if (eventUser.role === 'ADMIN') {
    const adminCount = await prisma.eventUser.count({ where: { eventId: req.params.id, role: 'ADMIN' } });
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Cannot remove the last admin from this event' });
      return;
    }
  }
  await prisma.eventUser.delete({
    where: { userId_eventId: { userId: req.params.userId, eventId: req.params.id } },
  });
  res.json({ ok: true });
});

export default router;
