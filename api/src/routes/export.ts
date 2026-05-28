import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/authenticate';
import { requireEventRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { generateResultsPdf } from '../services/pdf';
import { secondsToMmSs } from '../utils/time';

const router = Router();

const BOM = '﻿';

// GET /api/events/:id/export/participants
router.get('/:id/export/participants', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { eventId: req.params.id },
    include: {
      entries: {
        include: { participant: true },
        orderBy: { plotNumber: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  const rows = ['Kategória;Meno;Priezvisko;Bydlisko;Dátum narodenia;Číslo políčka'];
  for (const cat of categories) {
    for (const entry of cat.entries) {
      const p = entry.participant;
      rows.push(
        [cat.name, p.firstName, p.lastName, p.city, p.dateOfBirth ?? '', entry.plotNumber ?? ''].join(';')
      );
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="participants.csv"`);
  res.send(BOM + rows.join('\r\n'));
});

// GET /api/events/:id/export/results
router.get('/:id/export/results', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const categories = await prisma.category.findMany({
    where: { eventId: req.params.id },
    include: {
      entries: {
        include: { participant: true },
        orderBy: { rank: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  const rows = ['Kategória;Políčko;Meno;Priezvisko;Bydlisko;Dátum narodenia;Základný čas;Penalizácia;Výsledný čas;Poradie'];
  for (const cat of categories) {
    for (const entry of cat.entries) {
      const p = entry.participant;
      const totalTime = entry.baseTime != null ? entry.baseTime + entry.penalty : null;
      rows.push(
        [
          cat.name,
          entry.plotNumber ?? '',
          p.firstName,
          p.lastName,
          p.city,
          p.dateOfBirth ?? '',
          entry.baseTime != null ? secondsToMmSs(entry.baseTime) : '',
          secondsToMmSs(entry.penalty),
          totalTime != null ? secondsToMmSs(totalTime) : '',
          entry.rank ?? '',
        ].join(';')
      );
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="results.csv"`);
  res.send(BOM + rows.join('\r\n'));
});

// GET /api/events/:id/categories/:catId/export
router.get('/:id/categories/:catId/export', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const category = await prisma.category.findFirst({
    where: { id: req.params.catId, eventId: req.params.id },
    include: {
      entries: {
        include: { participant: true },
        orderBy: { rank: 'asc' },
      },
    },
  });
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const rows = ['Kategória;Políčko;Meno;Priezvisko;Bydlisko;Dátum narodenia;Základný čas;Penalizácia;Výsledný čas;Poradie'];
  for (const entry of category.entries) {
    const p = entry.participant;
    const totalTime = entry.baseTime != null ? entry.baseTime + entry.penalty : null;
    rows.push(
      [
        category.name,
        entry.plotNumber ?? '',
        p.firstName,
        p.lastName,
        p.city,
        p.dateOfBirth ?? '',
        entry.baseTime != null ? secondsToMmSs(entry.baseTime) : '',
        secondsToMmSs(entry.penalty),
        totalTime != null ? secondsToMmSs(totalTime) : '',
        entry.rank ?? '',
      ].join(';')
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${category.name}.csv"`);
  res.send(BOM + rows.join('\r\n'));
});

// POST /api/events/:id/import/results  — import from CSV backup
const importSchema = z.object({
  rows: z.array(
    z.object({
      plotNumber: z.number().int().positive(),
      categoryName: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      baseTime: z.number().int().nonnegative(),
      penalty: z.number().int().nonnegative(),
    })
  ),
  force: z.boolean().optional().default(false),
});

router.post('/:id/import/results', authenticate, requireEventRole('ADMIN'), validate(importSchema), async (req, res) => {
  const { rows, force } = req.body;

  const categories = await prisma.category.findMany({ where: { eventId: req.params.id } });
  const catByName = new Map(categories.map((c) => [c.name, c]));

  const conflicts: unknown[] = [];
  const valid: unknown[] = [];

  for (const row of rows) {
    const cat = catByName.get(row.categoryName);
    if (!cat) {
      conflicts.push({ ...row, error: `Category "${row.categoryName}" not found` });
      continue;
    }
    if (row.plotNumber > cat.plotCount) {
      conflicts.push({ ...row, error: `Plot ${row.plotNumber} exceeds category max (${cat.plotCount})` });
      continue;
    }
    const existing = await prisma.entry.findFirst({
      where: { categoryId: cat.id, plotNumber: row.plotNumber, baseTime: { not: null } },
    });
    if (existing && !force) {
      conflicts.push({ ...row, error: `Plot ${row.plotNumber} already has a time recorded` });
      continue;
    }
    valid.push({ ...row, categoryId: cat.id });
  }

  if (conflicts.length > 0 && !force) {
    res.status(409).json({ conflicts, validCount: valid.length });
    return;
  }

  let applied = 0;
  for (const row of valid as Array<{ plotNumber: number; categoryId: string; baseTime: number; penalty: number }>) {
    const entry = await prisma.entry.findFirst({
      where: { categoryId: row.categoryId, plotNumber: row.plotNumber },
    });
    if (entry) {
      await prisma.entry.update({
        where: { id: entry.id },
        data: { baseTime: row.baseTime, penalty: row.penalty },
      });
      applied++;
    }
  }

  res.json({ ok: true, applied });
});

// PDF export
router.get('/:id/pdf', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      categories: {
        include: {
          entries: {
            include: { participant: true },
            orderBy: { rank: 'asc' },
          },
          teams: {
            include: { members: { include: { participant: true } } },
            orderBy: { rank: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  try {
    const pdfBuffer = await generateResultsPdf(event);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name}-results.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

router.get('/:id/categories/:catId/pdf', authenticate, requireEventRole('ADMIN', 'REGISTRAR'), async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      categories: {
        where: { id: req.params.catId },
        include: {
          entries: {
            include: { participant: true },
            orderBy: { rank: 'asc' },
          },
          teams: {
            include: { members: { include: { participant: true } } },
            orderBy: { rank: 'asc' },
          },
        },
      },
    },
  });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  try {
    const pdfBuffer = await generateResultsPdf(event);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${event.name}-category.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

// Announcement (admin-authenticated)
router.post('/:id/send-announcement', authenticate, requireEventRole('ADMIN'), async (req, res) => {
  const { sendEventAnnouncement } = await import('../services/email');
  setImmediate(() => sendEventAnnouncement(req.params.id));
  res.json({ ok: true, message: 'Announcement queued' });
});

export default router;
