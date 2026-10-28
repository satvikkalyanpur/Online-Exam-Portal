import type { Response } from 'express';
import prisma from './prisma.js';
import type { AuthRequest } from './middleware.js';

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth?.id ?? '' },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Failed to load user:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}