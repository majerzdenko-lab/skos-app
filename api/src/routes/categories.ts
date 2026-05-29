import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1),
  plotDimensions: z.string().min(1),
  plotCount: z.number().int().positive(),
  scored: z.boolean().optional().default(true),
  categoryType: z.enum(['INDIVIDUAL', 'TEAM']).optional().default('INDIVIDUAL'),
  order: z.number().int().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string()),
});

router.get('/:id/categories', async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { eventId: req.params.id },
    orderBy: { order: 'asc' },
  });
  res.json(categories);
});

router.post('/:id/categories', authenticate, requireEventRole('ADMIN'), validate(categorySchema), async (req, res) => {
  const maxOrder = await prisma.category.aggregate({
    where: { eventId: req.params.id },
    _max: { order: true },
  });
  const order = req.body.order ?? (maxOrder._max.order ?? -1) + 1;

  const category = await prisma.category.create({
    data: {
      eventId: req.params.id,
      name: req.body.name,
      plotDimensions: req.body.plotDimensions,
      plotCount: req.body.plotCount,
      scored: req.body.scored,
      categoryType: req.body.categoryType,
      order,
    },
  });
  res.status(201).json(category);
});

router.put('/:id/categories/:catId', authenticate, requireEventRole('ADMIN'), validate(categorySchema.partial()), async (req, res) => {
  const category = await prisma.category.findFirst({
    where: { id: req.params.catId, eventId: req.params.id },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  const updated = await prisma.category.update({
    where: { id: req.params.catId },
    data: req.body,
  });
  res.json(updated);
});

router.delete('/:id/categories/:catId', authenticate, requireEventRole('ADMIN'), async (req, res) => {
  const category = await prisma.category.findFirst({
    where: { id: req.params.catId, eventId: req.params.id },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  await prisma.category.delete({ where: { id: req.params.catId } });
  res.json({ ok: true });
});

router.post('/:id/categories/reorder', authenticate, requireEventRole('ADMIN'), validate(reorderSchema), async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  await prisma.$transaction(
    ids.map((catId: string, index: number) =>
      prisma.category.update({ where: { id: catId }, data: { order: index } })
    )
  );
  res.json({ ok: true });
});

export default router;
