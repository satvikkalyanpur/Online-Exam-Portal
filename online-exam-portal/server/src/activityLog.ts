// US21: activity log of logins, exam starts, submissions and other key actions.
import type { Request, Response } from 'express';
import { ActivityAction } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError } from './http.js';

/** Writes one log entry. A logging failure never stops the action being logged. */
export async function logActivity(userId: string | null, action: ActivityAction, details: string) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, details: details.slice(0, 500) },
    });
  } catch (error) {
    console.error('Could not write activity log:', error);
  }
}

/** GET /api/activity?action=LOGIN&search=text — newest first, at most 300 entries. */
export async function listActivity(req: Request, res: Response) {
  const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
  if (action && !Object.hasOwn(ActivityAction, action)) {
    throw new HttpError(400, 'Unknown activity type.');
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const logs = await prisma.activityLog.findMany({
    where: {
      ...(action ? { action: action as ActivityAction } : {}),
      ...(search
        ? {
            OR: [
              { details: { contains: search } },
              { user: { email: { contains: search } } },
              { user: { name: { contains: search } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      user: { select: { name: true, email: true, role: true } },
    },
  });

  res.json({ actions: Object.keys(ActivityAction), logs });
}
