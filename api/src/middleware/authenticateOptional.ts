import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from './authenticate';

export function authenticateOptional(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as AuthUser;
      req.user = { id: payload.id, email: payload.email };
    } catch {
      // invalid token — treat as anonymous
    }
  }
  next();
}
