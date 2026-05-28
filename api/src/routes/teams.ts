import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { getIo } from '../socket';

const router = Router();

const teamSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string()).optional(),
});

const teamResultSchema = z.object({
  plotNumber: z.number().int().positive().optional(),
  time1: z.number().int().nonnegative().optional(),
  time2: z.number().int().nonnegative().optional(),
  baseTime: z.number().int().nonnegative().nullable().optional(),
  penalty: z.number().int().nonnegative().optional(),
  penaltyNote: z.string().optional(),
});

async function getEventRoleForTeam(userId: string, teamId: string): Promise<Role | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { category: { select: { eventId: true } } },
  });
  if (!team) return null;
  const eu = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId, eventId: team.category.eventId } },
  });
  return eu?.role ?? null;
}

router.get('/events/:id/categories/:catId/teams', authenticate, requireEventRole('ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR'), async (req, res) => {
  const teams = await prisma.team.findMany({
    where: { categoryId: req.params.catId, category: { eventId: req.params.id } },
    include: { members: { include: { participant: true } } },
    orderBy: { plotNumber: 'asc' },
  });
  res.json(teams);
});

router.post('/events/:id/categories/:catId/teams', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), validate(teamSchema), async (req, res) => {
  const { name, memberIds } = req.body;
  const team = await prisma.team.create({
    data: {
      categoryId: req.params.catId,
      name,
      members: memberIds
        ? { create: memberIds.map((participantId: string) => ({ participantId })) }
        : undefined,
    },
    include: { members: { include: { participant: true } } },
  });
  res.status(201).json(team);
});

router.put('/teams/:teamId', authenticate, validate(teamSchema.partial()), async (req, res) => {
  const role = await getEventRoleForTeam(req.user!.id, req.params.teamId);
  if (!role || !['ADMIN', 'REGISTRAR'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { name, memberIds } = req.body;
  const team = await prisma.team.update({
    where: { id: req.params.teamId },
    data: {
      name,
      members: memberIds
        ? {
            deleteMany: {},
            create: memberIds.map((participantId: string) => ({ participantId })),
          }
        : undefined,
    },
    include: { members: { include: { participant: true } } },
  });
  res.json(team);
});

router.patch('/teams/:teamId/result', authenticate, validate(teamResultSchema), async (req, res) => {
  const role = await getEventRoleForTeam(req.user!.id, req.params.teamId);
  if (!role || !['ADMIN', 'JUDGE'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const team = await prisma.team.findUnique({
    where: { id: req.params.teamId },
    include: { category: { select: { eventId: true } } },
  });
  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }
  const updated = await prisma.team.update({ where: { id: req.params.teamId }, data: req.body });
  const totalTime = updated.baseTime != null ? updated.baseTime + updated.penalty : null;
  getIo().to(`event:${team.category.eventId}`).emit('entry:updated', {
    entryId: updated.id,
    baseTime: updated.baseTime,
    penalty: updated.penalty,
    totalTime,
    isTeam: true,
  });
  res.json({ ...updated, totalTime });
});

export default router;
