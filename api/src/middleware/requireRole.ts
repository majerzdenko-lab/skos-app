import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';

export function requireEventRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const eventId = req.params.id ?? req.params.eventId;
    if (!eventId) {
      res.status(400).json({ error: 'Missing eventId' });
      return;
    }
    const eventUser = await prisma.eventUser.findUnique({
      where: { userId_eventId: { userId: req.user.id, eventId } },
    });
    if (!eventUser || !roles.includes(eventUser.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
