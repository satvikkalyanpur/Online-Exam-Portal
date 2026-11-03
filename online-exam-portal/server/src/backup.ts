// US20: backup and recovery of exam and result data (administrators only).
//
// A backup is one JSON file with every user, exam, question, attempt and answer.
// Restoring checks the whole file first, then replaces the exam data in a single
// transaction: either everything is restored or nothing changes.
import type { Request, Response } from 'express';
import { AttemptStatus, ExamStatus, Role } from './generated/prisma/client.js';
import type { Prisma } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError } from './http.js';
import { logActivity } from './activityLog.js';

const FORMAT = 'online-exam-portal-backup';
const VERSION = 1;

/** GET /api/backup — download a backup file. */
export async function downloadBackup(req: Request, res: Response) {
  const [users, exams, questions, examQuestions, attempts, attemptAnswers] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.exam.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.question.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.examQuestion.findMany(),
    prisma.attempt.findMany({ orderBy: { startedAt: 'asc' } }),
    prisma.attemptAnswer.findMany(),
  ]);
  const data = { users, exams, questions, examQuestions, attempts, attemptAnswers };
  const counts = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length]));

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  res.setHeader('Content-Disposition', `attachment; filename="exam-portal-backup-${stamp}.json"`);
  res.json({ format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), counts, data });

  await logActivity(
    req.user!.id,
    'BACKUP_DOWNLOADED',
    `Downloaded a backup (${counts.exams} exams, ${counts.questions} questions, ${counts.attempts} attempts)`
  );
}

// ---------------------------------------------------------------------------
// Reading and checking a backup file

type FieldType = 'string' | 'string?' | 'int' | 'int?' | 'bool' | 'bool?' | 'date' | 'date?' | readonly string[];
type Row = Record<string, string | number | boolean | Date | null>;

function readRows(value: unknown, table: string, fields: Record<string, FieldType>): Row[] {
  if (!Array.isArray(value)) throw new HttpError(400, `Backup file is missing the "${table}" list.`);

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new HttpError(400, `Backup file: ${table} entry ${index + 1} is not valid.`);
    }
    const record = item as Record<string, unknown>;
    const row: Row = {};

    for (const [field, type] of Object.entries(fields)) {
      const v = record[field];
      const problem = () => new HttpError(400, `Backup file: ${table} entry ${index + 1} has an invalid "${field}".`);
      const optional = typeof type === 'string' && type.endsWith('?');
      if (optional && (v === null || v === undefined)) {
        row[field] = null;
        continue;
      }
      const base = typeof type === 'string' ? type.replace('?', '') : type;

      if (Array.isArray(base)) {
        if (typeof v !== 'string' || !base.includes(v)) throw problem();
        row[field] = v;
      } else if (base === 'string') {
        if (typeof v !== 'string') throw problem();
        row[field] = v;
      } else if (base === 'int') {
        if (typeof v !== 'number' || !Number.isInteger(v)) throw problem();
        row[field] = v;
      } else if (base === 'bool') {
        if (typeof v !== 'boolean') throw problem();
        row[field] = v;
      } else {
        const date = typeof v === 'string' ? new Date(v) : null;
        if (!date || Number.isNaN(date.getTime())) throw problem();
        row[field] = date;
      }
    }
    return row;
  });
}

function checkUnique(rows: Row[], key: (row: Row) => string, what: string) {
  const seen = new Set<string>();
  for (const row of rows) {
    const k = key(row);
    if (seen.has(k)) throw new HttpError(400, `Backup file contains the same ${what} twice.`);
    seen.add(k);
  }
}

function checkReferences(rows: Row[], field: string, ids: Set<string>, what: string) {
  for (const row of rows) {
    if (!ids.has(row[field] as string)) {
      throw new HttpError(400, `Backup file is inconsistent: it refers to a ${what} that is not in the file.`);
    }
  }
}

function readBackup(body: unknown) {
  const file = body as { format?: unknown; version?: unknown; data?: Record<string, unknown> } | null;
  if (!file || file.format !== FORMAT || !file.data) {
    throw new HttpError(400, 'This is not an Online Exam Portal backup file.');
  }
  if (file.version !== VERSION) {
    throw new HttpError(400, `This backup file has version ${String(file.version)}; this portal reads version ${VERSION}.`);
  }
  const { data } = file;

  const users = readRows(data.users, 'users', {
    id: 'string',
    name: 'string',
    email: 'string',
    passwordHash: 'string',
    role: Object.values(Role),
    createdAt: 'date',
  });
  const exams = readRows(data.exams, 'exams', {
    id: 'string',
    title: 'string',
    subject: 'string',
    description: 'string?',
    status: Object.values(ExamStatus),
    startAt: 'date',
    endAt: 'date',
    durationMinutes: 'int',
    totalMarks: 'int',
    createdAt: 'date',
    createdById: 'string?',
  });
  const questions = readRows(data.questions, 'questions', {
    id: 'string',
    text: 'string',
    optionA: 'string',
    optionB: 'string',
    optionC: 'string',
    optionD: 'string',
    correctOption: ['A', 'B', 'C', 'D'],
    marks: 'int',
    createdAt: 'date',
    updatedAt: 'date',
  });
  const examQuestions = readRows(data.examQuestions, 'examQuestions', { questionId: 'string', examId: 'string' });
  const attempts = readRows(data.attempts, 'attempts', {
    id: 'string',
    examId: 'string',
    studentId: 'string',
    status: Object.values(AttemptStatus),
    startedAt: 'date',
    expiresAt: 'date',
    submittedAt: 'date?',
    autoSubmitted: 'bool',
    score: 'int?',
    maxScore: 'int?',
  });
  const attemptAnswers = readRows(data.attemptAnswers, 'attemptAnswers', {
    attemptId: 'string',
    questionId: 'string',
    selectedOption: 'string?',
    isCorrect: 'bool?',
    savedAt: 'date',
  });

  if (attemptAnswers.some((a) => a.selectedOption !== null && !['A', 'B', 'C', 'D'].includes(a.selectedOption as string))) {
    throw new HttpError(400, 'Backup file: an answer has an invalid "selectedOption".');
  }

  checkUnique(users, (r) => r.id as string, 'user');
  checkUnique(users, (r) => (r.email as string).toLowerCase(), 'email address');
  checkUnique(exams, (r) => r.id as string, 'exam');
  checkUnique(questions, (r) => r.id as string, 'question');
  checkUnique(examQuestions, (r) => `${r.examId}|${r.questionId}`, 'exam question');
  checkUnique(attempts, (r) => r.id as string, 'attempt');
  checkUnique(attempts, (r) => `${r.examId}|${r.studentId}`, 'student attempt for one exam');
  checkUnique(attemptAnswers, (r) => `${r.attemptId}|${r.questionId}`, 'answer');

  const userIds = new Set(users.map((r) => r.id as string));
  const examIds = new Set(exams.map((r) => r.id as string));
  const questionIds = new Set(questions.map((r) => r.id as string));
  const attemptIds = new Set(attempts.map((r) => r.id as string));
  checkReferences(examQuestions, 'examId', examIds, 'exam');
  checkReferences(examQuestions, 'questionId', questionIds, 'question');
  checkReferences(attempts, 'examId', examIds, 'exam');
  checkReferences(attempts, 'studentId', userIds, 'student');
  checkReferences(attemptAnswers, 'attemptId', attemptIds, 'attempt');
  checkReferences(attemptAnswers, 'questionId', questionIds, 'question');
  for (const exam of exams) {
    if (exam.createdById && !userIds.has(exam.createdById as string)) exam.createdById = null;
  }

  return { users, exams, questions, examQuestions, attempts, attemptAnswers };
}

/**
 * POST /api/backup/restore — body is the backup file. Exams, questions, attempts
 * and answers are replaced by the ones in the file. Users in the file are added
 * or updated; other existing accounts are kept.
 */
export async function restoreBackup(req: Request, res: Response) {
  const backup = readBackup(req.body);

  // A user in the file whose email belongs to a different existing account can't be restored.
  const existing = await prisma.user.findMany({
    where: { email: { in: backup.users.map((u) => u.email as string) } },
    select: { id: true, email: true },
  });
  const fileIdByEmail = new Map(backup.users.map((u) => [(u.email as string).toLowerCase(), u.id]));
  const clash = existing.find((u) => fileIdByEmail.get(u.email.toLowerCase()) !== u.id);
  if (clash) {
    throw new HttpError(409, `Cannot restore: ${clash.email} belongs to a different account in this database.`);
  }

  try {
    await prisma.$transaction(
      async (tx) => {
      await tx.attemptAnswer.deleteMany();
      await tx.attempt.deleteMany();
      await tx.examQuestion.deleteMany();
      await tx.question.deleteMany();
      await tx.exam.deleteMany();

      for (const u of backup.users) {
        const fields = {
          name: u.name as string,
          email: u.email as string,
          passwordHash: u.passwordHash as string,
          role: u.role as Role,
        };
        await tx.user.upsert({
          where: { id: u.id as string },
          create: { id: u.id as string, createdAt: u.createdAt as Date, ...fields },
          update: fields,
        });
      }

      // Every field of these rows was checked in readBackup.
      await tx.exam.createMany({ data: backup.exams as unknown as Prisma.ExamCreateManyInput[] });
      await tx.question.createMany({ data: backup.questions as unknown as Prisma.QuestionCreateManyInput[] });
      await tx.examQuestion.createMany({
        data: backup.examQuestions as unknown as Prisma.ExamQuestionCreateManyInput[],
      });
      await tx.attempt.createMany({ data: backup.attempts as unknown as Prisma.AttemptCreateManyInput[] });
      await tx.attemptAnswer.createMany({
        data: backup.attemptAnswers as unknown as Prisma.AttemptAnswerCreateManyInput[],
      });
    },
      { maxWait: 10_000, timeout: 120_000 }
    );
  } catch (error) {
    // The transaction was rolled back, so nothing changed.
    console.error('Restore failed:', error);
    throw new HttpError(
      400,
      'The backup could not be restored because some of its data is not valid (for example a value that is too ' +
        'long). Nothing was changed.'
    );
  }

  const counts = {
    users: backup.users.length,
    exams: backup.exams.length,
    questions: backup.questions.length,
    attempts: backup.attempts.length,
    answers: backup.attemptAnswers.length,
  };
  await logActivity(
    req.user!.id,
    'BACKUP_RESTORED',
    `Restored a backup (${counts.exams} exams, ${counts.questions} questions, ${counts.attempts} attempts)`
  );
  res.json({ message: 'Backup restored.', counts });
}
