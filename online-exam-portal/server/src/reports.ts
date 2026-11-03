// US16 student performance reports and US17 examination statistics (administrators).
import type { Request, Response } from 'express';
import { AttemptStatus, ExamStatus } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { percentage } from './http.js';
import { submitExpiredAttempts } from './grading.js';

/** GET /api/reports/performance?examId=... — one row per submitted attempt. */
export async function performanceReport(req: Request, res: Response) {
  await submitExpiredAttempts();
  const examId = typeof req.query.examId === 'string' && req.query.examId ? req.query.examId : undefined;

  const attempts = await prisma.attempt.findMany({
    where: { status: AttemptStatus.SUBMITTED, ...(examId ? { examId } : {}) },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      autoSubmitted: true,
      student: { select: { id: true, name: true, email: true } },
      exam: { select: { id: true, title: true, subject: true } },
    },
  });

  res.json(
    attempts.map((a) => ({
      ...a,
      score: a.score ?? 0,
      maxScore: a.maxScore ?? 0,
      percentage: percentage(a.score ?? 0, a.maxScore ?? 0),
    }))
  );
}

/** GET /api/reports/statistics — figures per exam, worked out from the stored results. */
export async function examStatistics(_req: Request, res: Response) {
  await submitExpiredAttempts();

  const exams = await prisma.exam.findMany({
    where: { OR: [{ status: ExamStatus.PUBLISHED }, { attempts: { some: {} } }] },
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      title: true,
      subject: true,
      status: true,
      startAt: true,
      endAt: true,
      attempts: { select: { status: true, score: true, maxScore: true } },
    },
  });

  const everyPercent: number[] = [];
  const rows = exams.map(({ attempts, ...exam }) => {
    const submitted = attempts.filter((a) => a.status === AttemptStatus.SUBMITTED);
    const percents = submitted.map((a) => percentage(a.score ?? 0, a.maxScore ?? 0));
    everyPercent.push(...percents);
    const average = percents.length ? percents.reduce((sum, p) => sum + p, 0) / percents.length : null;
    return {
      ...exam,
      submittedCount: submitted.length,
      inProgressCount: attempts.length - submitted.length,
      averagePercentage: average === null ? null : Math.round(average * 10) / 10,
      highestPercentage: percents.length ? Math.max(...percents) : null,
      lowestPercentage: percents.length ? Math.min(...percents) : null,
      // A score of 40% or more counts as a pass in these statistics.
      passCount: percents.filter((p) => p >= 40).length,
    };
  });

  const overallAverage = everyPercent.length
    ? everyPercent.reduce((sum, p) => sum + p, 0) / everyPercent.length
    : null;

  res.json({
    summary: {
      examCount: rows.length,
      submittedCount: everyPercent.length,
      inProgressCount: rows.reduce((sum, r) => sum + r.inProgressCount, 0),
      averagePercentage: overallAverage === null ? null : Math.round(overallAverage * 10) / 10,
      passCount: everyPercent.filter((p) => p >= 40).length,
    },
    exams: rows,
  });
}
