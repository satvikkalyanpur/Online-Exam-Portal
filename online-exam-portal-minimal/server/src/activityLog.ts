import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from './prisma.js';

type AuthedRequest = Request & { user?: { id: string; role: string } };

export type ActivityAction = 'LOGIN' | 'EXAM_START' | 'EXAM_SUBMIT';

const ACTIONS: ActivityAction[] = ['LOGIN', 'EXAM_START', 'EXAM_SUBMIT'];

// Logging must never break the action being logged, so errors are only printed.
export async function logActivity(
  userId: string,
  action: ActivityAction,
  details?: Prisma.InputJsonValue,
) {
  try {
    await prisma.activityLog.create({ data: { userId, action, details } });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export async function recordExamStart(req: Request, res: Response) {
  const user = (req as AuthedRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { examRef, examTitle } = req.body ?? {};
  if (!Number.isInteger(examRef) || typeof examTitle !== 'string') {
    return res.status(400).json({ error: 'Invalid exam start.' });
  }

  await logActivity(user.id, 'EXAM_START', {
    examRef,
    examTitle: examTitle.slice(0, 200),
  });
  return res.status(201).json({ message: 'Exam start logged.' });
}

export async function getActivityLogs(req: Request, res: Response) {
  try {
    const { action } = req.query;
    if (action !== undefined && !ACTIONS.includes(action as ActivityAction)) {
      return res.status(400).json({ error: 'Unknown activity type.' });
    }

    const requested = Number(req.query.limit);
    const limit = Number.isInteger(requested)
      ? Math.min(Math.max(requested, 1), 500)
      : 100;

    const logs = await prisma.activityLog.findMany({
      where: action ? { action: action as ActivityAction } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return res.json(logs);
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    return res.status(500).json({ error: 'Unable to fetch activity logs.' });
  }
}
