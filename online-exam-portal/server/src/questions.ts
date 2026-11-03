// US05 add, US06 edit and US07 delete questions in the question bank.
import type { Request, Response } from 'express';
import { AttemptStatus } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError, idList, isOptionKey, requireInt, requireText } from './http.js';
import { logActivity } from './activityLog.js';
import { submitExpiredAttempts } from './grading.js';

function shorten(text: string) {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

const questionWithExams = {
  examLinks: {
    select: { exam: { select: { id: true, title: true } } },
  },
} as const;

type QuestionRow = {
  examLinks: { exam: { id: string; title: string } }[];
  [key: string]: unknown;
};

function toResponse<T extends QuestionRow>({ examLinks, ...question }: T) {
  return { ...question, exams: examLinks.map((link) => link.exam) };
}

/** Validates the body shared by create and edit. */
async function readQuestionInput(body: Record<string, unknown> = {}) {
  const text = requireText(body.text, 'Question text', 10000);
  const optionA = requireText(body.optionA, 'Option A', 1000);
  const optionB = requireText(body.optionB, 'Option B', 1000);
  const optionC = requireText(body.optionC, 'Option C', 1000);
  const optionD = requireText(body.optionD, 'Option D', 1000);
  if (!isOptionKey(body.correctOption)) {
    throw new HttpError(400, 'Correct option must be A, B, C or D.');
  }
  const marks = requireInt(body.marks, 'Marks', 1, 1000);
  const examIds = idList(body.examIds, 'Examinations');

  if (examIds.length > 0) {
    const found = await prisma.exam.count({ where: { id: { in: examIds } } });
    if (found !== examIds.length) {
      throw new HttpError(400, 'One of the selected examinations does not exist.');
    }
  }

  return {
    data: { text, optionA, optionB, optionC, optionD, correctOption: body.correctOption, marks },
    examIds,
  };
}

async function findQuestionOr404(id: string) {
  const question = await prisma.question.findUnique({ where: { id }, select: { id: true, text: true } });
  if (!question) throw new HttpError(404, 'Question not found. It may have been deleted.');
  return question;
}

/**
 * Refuses to change the questions of an exam that students are taking right now,
 * so nobody is marked on a question they never saw.
 */
async function refuseIfBeingTaken(examIds: string[]) {
  if (examIds.length === 0) return;
  await submitExpiredAttempts({ examId: { in: examIds } });
  const busy = await prisma.exam.findFirst({
    where: { id: { in: examIds }, attempts: { some: { status: AttemptStatus.IN_PROGRESS } } },
    select: { title: true },
  });
  if (busy) {
    throw new HttpError(
      409,
      `Students are taking "${busy.title}" right now, so its questions can't be changed until they have finished.`
    );
  }
}

/** Number of answers to this question that are part of submitted (marked) attempts. */
function countMarkedAnswers(questionId: string) {
  return prisma.attemptAnswer.count({
    where: { questionId, attempt: { status: AttemptStatus.SUBMITTED } },
  });
}

/** GET /api/questions — the whole question bank, newest first. */
export async function listQuestions(_req: Request, res: Response) {
  const questions = await prisma.question.findMany({
    include: questionWithExams,
    orderBy: { createdAt: 'desc' },
  });
  res.json(questions.map(toResponse));
}

/** POST /api/questions — add a question, optionally linked to one or more examinations. */
export async function createQuestion(req: Request, res: Response) {
  const { data, examIds } = await readQuestionInput(req.body);
  await refuseIfBeingTaken(examIds);

  const question = await prisma.question.create({
    data: {
      ...data,
      examLinks: { create: examIds.map((examId) => ({ examId })) },
    },
    include: questionWithExams,
  });
  await logActivity(req.user!.id, 'QUESTION_ADDED', `Added question "${shorten(question.text)}"`);

  res.status(201).json({
    message: 'Question added to the question bank.',
    question: toResponse(question),
  });
}

/** PUT /api/questions/:id — replace a question's details and its exam links. */
export async function updateQuestion(req: Request, res: Response) {
  const id = String(req.params.id);
  await findQuestionOr404(id);
  const { data, examIds } = await readQuestionInput(req.body);

  const current = await prisma.question.findUniqueOrThrow({
    where: { id },
    select: { correctOption: true, marks: true, examLinks: { select: { examId: true } } },
  });

  // Results already given out must stay correct, so the answer key and marks are fixed once marked.
  if (data.correctOption !== current.correctOption || data.marks !== current.marks) {
    if ((await countMarkedAnswers(id)) > 0) {
      throw new HttpError(
        409,
        'Students have already been marked on this question, so its correct answer and marks cannot be ' +
          'changed. You can still fix the wording, or add a new question instead.'
      );
    }
  }

  const before = current.examLinks.map((link) => link.examId);
  const changedExams = [
    ...examIds.filter((examId) => !before.includes(examId)),
    ...before.filter((examId) => !examIds.includes(examId)),
  ];
  await refuseIfBeingTaken(changedExams);

  const question = await prisma.question.update({
    where: { id },
    data: {
      ...data,
      examLinks: {
        deleteMany: {},
        create: examIds.map((examId) => ({ examId })),
      },
    },
    include: questionWithExams,
  });
  await logActivity(req.user!.id, 'QUESTION_UPDATED', `Edited question "${shorten(question.text)}"`);

  res.json({ message: 'Question updated successfully.', question: toResponse(question) });
}

/** DELETE /api/questions/:id — remove a question (the UI asks for confirmation first). */
export async function deleteQuestion(req: Request, res: Response) {
  const id = String(req.params.id);
  const question = await findQuestionOr404(id);

  // Deleting a question that is part of submitted results would change those results.
  if ((await countMarkedAnswers(id)) > 0) {
    throw new HttpError(
      409,
      'Students have already been marked on this question, so it cannot be deleted. ' +
        'To stop using it, edit the question and untick its examinations.'
    );
  }

  const links = await prisma.examQuestion.findMany({ where: { questionId: id }, select: { examId: true } });
  await refuseIfBeingTaken(links.map((link) => link.examId));

  // Its exam links are removed with it.
  await prisma.question.delete({ where: { id } });
  await logActivity(req.user!.id, 'QUESTION_DELETED', `Deleted question "${shorten(question.text)}"`);
  res.json({ message: 'Question deleted from the question bank.' });
}
