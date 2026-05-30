import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const userCount = await prisma.user.count();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, systemRole: userCount === 0 ? 'ADMIN' : 'USER' },
  });

  res.status(201).json({ id: user.id, email: user.email });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const payload = { id: user.id, email: user.email };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, systemRole: user.systemRole },
  });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string; email: string };
    const accessToken = jwt.sign(
      { id: payload.id, email: payload.email },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ ok: true });
});

export default router;
