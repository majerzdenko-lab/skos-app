import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { getIo } from '../socket';
import { computeRankings } from '../services/ranking';
import { sendCategoryResults } from '../services/email';

const router = Router();

const drawAllSchema = z.object({}).optional();

const plotSchema = z.object({
  plotNumber: z.number().int().positive(),
});

const entryUpdateSchema = z.object({
  time1: z.number().int().nonnegative().optional(),
  time2: z.number().int().nonnegative().optional(),
  baseTime: z.number().int().nonnegative().nullable().optional(),
  penalty: z.number().int().nonnegative().optional(),
  penaltyNote: z.string().optional(),
  dnr: z.boolean().optional(),
});

// Helper: look up event role for an entry
async function getEventRoleForEntry(userId: string, entryId: string): Promise<Role | null> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { category: { select: { eventId: true } } },
  });
  if (!entry) return null;
  const eu = await prisma.eventUser.findUnique({
    where: { userId_eventId: { userId, eventId: entry.category.eventId } },
  });
  return eu?.role ?? null;
}

const judgeInclude = {
  include: { user: { select: { id: true, firstName: true, lastName: true } } },
  orderBy: { assignedAt: 'asc' as const },
};

// GET /api/events/:id/categories/:catId/entries
router.get('/events/:id/categories/:catId/entries', authenticate, requireEventRole('ADMIN', 'REGISTRAR', 'JUDGE', 'COMPETITOR'), async (req, res) => {
  const entries = await prisma.entry.findMany({
    where: { categoryId: req.params.catId, category: { eventId: req.params.id } },
    include: { participant: true, judges: judgeInclude },
    orderBy: { plotNumber: 'asc' },
  });
  res.json(entries);
});

// POST /api/events/:id/categories/:catId/draw-all
router.post('/events/:id/categories/:catId/draw-all', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const category = await prisma.category.findFirst({
    where: { id: req.params.catId, eventId: req.params.id },
    include: { entries: true },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const plotPool = Array.from({ length: category.plotCount }, (_, i) => i + 1);
  const usedPlots = new Set(category.entries.map((e) => e.plotNumber).filter(Boolean));
  const undrawnEntries = category.entries.filter((e) => !e.plotNumber);
  const available = plotPool.filter((n) => !usedPlots.has(n));

  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const updates = await prisma.$transaction(
    undrawnEntries.slice(0, available.length).map((entry, i) =>
      prisma.entry.update({
        where: { id: entry.id },
        data: { plotNumber: available[i] },
      })
    )
  );

  const io = getIo();
  for (const entry of updates) {
    io.to(`event:${req.params.id}`).emit('entry:drawn', { entryId: entry.id, plotNumber: entry.plotNumber });
  }

  res.json(updates);
});

// PATCH /api/entries/:entryId/plot
router.patch('/entries/:entryId/plot', authenticate, validate(plotSchema), async (req, res) => {
  const { plotNumber } = req.body as { plotNumber: number };
  const role = await getEventRoleForEntry(req.user!.id, req.params.entryId);
  if (!role || !['ADMIN', 'REGISTRAR'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const entry = await prisma.entry.findUnique({
    where: { id: req.params.entryId },
    include: { category: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  if (plotNumber > entry.category.plotCount) {
    res.status(400).json({ error: `Plot number exceeds category maximum (${entry.category.plotCount})` });
    return;
  }

  // Check uniqueness within category
  const conflict = await prisma.entry.findFirst({
    where: { categoryId: entry.categoryId, plotNumber, id: { not: entry.id } },
  });
  if (conflict) {
    res.status(409).json({ error: 'Plot number already assigned in this category' });
    return;
  }

  const updated = await prisma.entry.update({
    where: { id: req.params.entryId },
    data: { plotNumber },
  });

  getIo().to(`event:${entry.category.eventId}`).emit('entry:drawn', { entryId: updated.id, plotNumber: updated.plotNumber });
  res.json(updated);
});

// PATCH /api/entries/:entryId
router.patch('/entries/:entryId', authenticate, validate(entryUpdateSchema), async (req, res) => {
  const role = await getEventRoleForEntry(req.user!.id, req.params.entryId);
  if (!role || !['ADMIN', 'JUDGE'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const entry = await prisma.entry.findUnique({
    where: { id: req.params.entryId },
    include: { category: true },
  });
  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  const updated = await prisma.entry.update({
    where: { id: req.params.entryId },
    data: req.body,
  });

  const totalTime = updated.dnr ? null : updated.baseTime != null ? updated.baseTime + updated.penalty : null;
  getIo()
    .to(`event:${entry.category.eventId}`)
    .emit('entry:updated', { entryId: updated.id, baseTime: updated.baseTime, penalty: updated.penalty, totalTime });

  res.json({ ...updated, totalTime });
});

// POST /api/entries/:entryId/claim
router.post('/entries/:entryId/claim', authenticate, async (req, res) => {
  const role = await getEventRoleForEntry(req.user!.id, req.params.entryId);
  if (!role || !['ADMIN', 'JUDGE'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    await prisma.entryJudge.create({ data: { entryId: req.params.entryId, userId: req.user!.id } });
  } catch {
    res.status(409).json({ error: 'Already claimed' });
    return;
  }
  const entry = await prisma.entry.findUnique({
    where: { id: req.params.entryId },
    include: { category: true, judges: judgeInclude },
  });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, firstName: true, lastName: true } });
  getIo().to(`event:${entry!.category.eventId}`).emit('entry:claimed', { entryId: req.params.entryId, judge: user });
  res.json({ ok: true, judges: entry!.judges });
});

// DELETE /api/entries/:entryId/claim
router.delete('/entries/:entryId/claim', authenticate, async (req, res) => {
  const role = await getEventRoleForEntry(req.user!.id, req.params.entryId);
  if (!role || !['ADMIN', 'JUDGE'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const targetUserId = role === 'ADMIN' && req.query.userId ? (req.query.userId as string) : req.user!.id;
  await prisma.entryJudge.deleteMany({ where: { entryId: req.params.entryId, userId: targetUserId } });
  const entry = await prisma.entry.findUnique({ where: { id: req.params.entryId }, include: { category: true } });
  getIo().to(`event:${entry!.category.eventId}`).emit('entry:unclaimed', { entryId: req.params.entryId, userId: targetUserId });
  res.json({ ok: true });
});

// POST /api/events/:id/categories/:catId/assign-judges
router.post('/events/:id/categories/:catId/assign-judges', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const judges = await prisma.eventUser.findMany({
    where: { eventId: req.params.id, role: 'JUDGE' },
    select: { userId: true },
  });
  if (judges.length === 0) {
    res.status(400).json({ error: 'Žiadni rozhodcovia nie sú priradení k tejto súťaži.' });
    return;
  }
  const entries = await prisma.entry.findMany({
    where: { categoryId: req.params.catId, category: { eventId: req.params.id } },
    select: { id: true },
    orderBy: { plotNumber: 'asc' },
  });
  await prisma.entryJudge.deleteMany({
    where: { entry: { categoryId: req.params.catId, category: { eventId: req.params.id } } },
  });
  await prisma.entryJudge.createMany({
    data: entries.map((e, i) => ({ entryId: e.id, userId: judges[i % judges.length].userId })),
  });
  res.json({ ok: true, assigned: entries.length, judges: judges.length });
});

// POST /api/entries/:entryId/save-judge-time — judge saves their measured time
const saveJudgeTimeSchema = z.object({
  centiseconds: z.number().int().nonnegative(),
  penalty: z.number().int().nonnegative().default(0),
});

router.post('/entries/:entryId/save-judge-time', authenticate, validate(saveJudgeTimeSchema), async (req, res) => {
  const role = await getEventRoleForEntry(req.user!.id, req.params.entryId);
  if (!role || !['ADMIN', 'JUDGE'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const judgeRecord = await prisma.entryJudge.findUnique({
    where: { entryId_userId: { entryId: req.params.entryId, userId: req.user!.id } },
  });
  if (!judgeRecord) {
    res.status(404).json({ error: 'You have not claimed this entry' });
    return;
  }
  if (judgeRecord.completedAt) {
    res.status(409).json({ error: 'Already saved' });
    return;
  }

  const allJudges = await prisma.entryJudge.findMany({
    where: { entryId: req.params.entryId },
    orderBy: { assignedAt: 'asc' },
  });
  const judgeIndex = allJudges.findIndex((j) => j.userId === req.user!.id);
  const timeField = judgeIndex === 0 ? 'time1' : 'time2';

  const { centiseconds, penalty } = req.body as { centiseconds: number; penalty: number };

  const [updatedEntry, updatedJudge] = await prisma.$transaction([
    prisma.entry.update({
      where: { id: req.params.entryId },
      data: { [timeField]: centiseconds, penalty },
    }),
    prisma.entryJudge.update({
      where: { entryId_userId: { entryId: req.params.entryId, userId: req.user!.id } },
      data: { completedAt: new Date(), centiseconds },
    }),
  ]);

  const entry = await prisma.entry.findUnique({
    where: { id: req.params.entryId },
    include: { category: true },
  });

  const totalTime = updatedEntry.baseTime != null ? updatedEntry.baseTime + penalty : null;
  getIo()
    .to(`event:${entry!.category.eventId}`)
    .emit('entry:updated', { entryId: req.params.entryId, [timeField]: centiseconds, penalty, baseTime: updatedEntry.baseTime, totalTime });

  res.json({ ok: true, timeField, entry: updatedEntry, judgeRecord: updatedJudge });
});

// POST /api/events/:id/categories/:catId/close
router.post('/events/:id/categories/:catId/close', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const entries = await prisma.entry.findMany({
    where: { categoryId: req.params.catId, category: { eventId: req.params.id } },
  });

  const incomplete = entries.filter((e) => !e.dnr && e.baseTime == null);
  if (incomplete.length > 0) {
    res.status(400).json({ error: 'All entries must have a base time or be marked DNR', count: incomplete.length });
    return;
  }

  const ranked = computeRankings(entries);

  await prisma.$transaction(
    ranked.map((r) =>
      prisma.entry.update({
        where: { id: r.id },
        data: { rank: r.rank },
      })
    )
  );

  const results = ranked.map((r) => ({ entryId: r.id, rank: r.rank, totalTime: r.totalTime }));
  getIo().to(`event:${req.params.id}`).emit('category:closed', { categoryId: req.params.catId, results });

  // Fire-and-forget email notifications
  setImmediate(() => sendCategoryResults(req.params.catId, req.params.id));

  res.json({ ok: true, results });
});

export default router;
