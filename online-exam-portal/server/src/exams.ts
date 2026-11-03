// US03 view available exams, US04 create exam (and edit / publish).
import type { Request, Response } from 'express';
import { AttemptStatus, ExamStatus } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError, optionalText, percentage, requireDate, requireInt, requireText } from './http.js';
import { submitExpiredAttempts } from './grading.js';
import { logActivity } from './activityLog.js';

const examFields = {
  id: true,
  title: true,
  subject: true,
  description: true,
  status: true,
  startAt: true,
  endAt: true,
  durationMinutes: true,
  totalMarks: true,
  createdAt: true,
} as const;

/** GET /api/exams — every exam with its question count and marks (admins and teachers). */
export async function listAllExams(_req: Request, res: Response) {
  const exams = await prisma.exam.findMany({
    select: {
      ...examFields,
      questions: { select: { question: { select: { marks: true } } } },
      _count: { select: { attempts: { where: { status: AttemptStatus.SUBMITTED } } } },
    },
    orderBy: { startAt: 'asc' },
  });

  res.json(
    exams.map(({ questions, _count, ...exam }) => ({
      ...exam,
      questionCount: questions.length,
      questionMarks: questions.reduce((sum, link) => sum + link.question.marks, 0),
      submittedCount: _count.attempts,
    }))
  );
}

/**
 * GET /api/exams/available — published exams for the logged-in student, with
 * schedule details, number of questions and the student's own attempt.
 */
export async function listAvailableExams(req: Request, res: Response) {
  const studentId = req.user!.id;
  await submitExpiredAttempts({ studentId });

  const exams = await prisma.exam.findMany({
    where: { status: ExamStatus.PUBLISHED },
    select: {
      ...examFields,
      _count: { select: { questions: true } },
      attempts: {
        where: { studentId },
        select: { id: true, status: true, expiresAt: true, submittedAt: true, score: true, maxScore: true },
      },
    },
    orderBy: { startAt: 'asc' },
  });

  res.json({
    serverTime: new Date().toISOString(),
    exams: exams.map(({ _count, attempts, ...exam }) => {
      const attempt = attempts[0] ?? null;
      return {
        ...exam,
        questionCount: _count.questions,
        attempt: attempt && {
          ...attempt,
          percentage:
            attempt.score !== null && attempt.maxScore !== null
              ? percentage(attempt.score, attempt.maxScore)
              : null,
        },
      };
    }),
  });
}

function readExamInput(body: Record<string, unknown> = {}) {
  const title = requireText(body.title, 'Title', 150);
  const subject = requireText(body.subject, 'Subject', 100);
  const description = optionalText(body.description, 'Description', 2000);
  const durationMinutes = requireInt(body.durationMinutes, 'Duration (minutes)', 1, 1440);
  const totalMarks = requireInt(body.totalMarks, 'Total marks', 1, 100000);
  const startAt = requireDate(body.startAt, 'Start date and time');
  const endAt = requireDate(body.endAt, 'End date and time');

  if (endAt <= startAt) {
    throw new HttpError(400, 'The end of the schedule must be after the start.');
  }
  if (endAt.getTime() - startAt.getTime() < durationMinutes * 60_000) {
    throw new HttpError(400, 'The scheduled window must be at least as long as the exam duration.');
  }
  return { title, subject, description, durationMinutes, totalMarks, startAt, endAt };
}

async function findExamOr404(id: string) {
  const exam = await prisma.exam.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!exam) throw new HttpError(404, 'Examination not found.');
  return exam;
}

/** POST /api/exams */
export async function createExam(req: Request, res: Response) {
  const data = readExamInput(req.body);
  const status = req.body?.publish === true ? ExamStatus.PUBLISHED : ExamStatus.DRAFT;

  const exam = await prisma.exam.create({
    data: { ...data, status, createdById: req.user!.id },
    select: examFields,
  });
  await logActivity(
    req.user!.id,
    'EXAM_CREATED',
    `Created "${exam.title}" (${status === ExamStatus.PUBLISHED ? 'published' : 'draft'})`
  );

  res.status(201).json({ message: 'Examination created successfully.', exam });
}

/** PUT /api/exams/:id — change the details or schedule. Attempts already started keep their deadline. */
export async function updateExam(req: Request, res: Response) {
  const id = String(req.params.id);
  await findExamOr404(id);
  const data = readExamInput(req.body);

  const exam = await prisma.exam.update({ where: { id }, data, select: examFields });
  await logActivity(req.user!.id, 'EXAM_UPDATED', `Updated "${exam.title}"`);
  res.json({ message: 'Examination updated.', exam });
}

/** PATCH /api/exams/:id/status — publish an exam to students, or move it back to draft. */
export async function setExamStatus(req: Request, res: Response) {
  const status = req.body?.status;
  if (status !== ExamStatus.PUBLISHED && status !== ExamStatus.DRAFT) {
    throw new HttpError(400, 'Status must be PUBLISHED or DRAFT.');
  }
  const id = String(req.params.id);
  await findExamOr404(id);

  const exam = await prisma.exam.update({ where: { id }, data: { status }, select: examFields });
  const published = status === ExamStatus.PUBLISHED;
  await logActivity(
    req.user!.id,
    published ? 'EXAM_PUBLISHED' : 'EXAM_UNPUBLISHED',
    `${published ? 'Published' : 'Moved to draft'}: "${exam.title}"`
  );
  res.json({ message: published ? 'Examination published.' : 'Examination moved to draft.', exam });
}
