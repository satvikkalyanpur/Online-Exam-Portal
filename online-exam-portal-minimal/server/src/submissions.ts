import type { Request, Response } from 'express';
import prisma from './prisma.js';

type AuthedRequest = Request & { user?: { id: string; role: string } };

export async function createSubmission(req: Request, res: Response) {
  try {
    const user = (req as AuthedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { examRef, examTitle, answers, score, totalMarks, autoSubmitted } =
      req.body ?? {};

    if (
      !Number.isInteger(examRef) ||
      typeof examTitle !== 'string' ||
      typeof answers !== 'object' ||
      answers === null ||
      Array.isArray(answers) ||
      !Number.isInteger(score) ||
      !Number.isInteger(totalMarks) ||
      score < 0 ||
      totalMarks < 0 ||
      score > totalMarks
    ) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    const submission = await prisma.submission.create({
      data: {
        studentId: user.id,
        examRef,
        examTitle: examTitle.slice(0, 200),
        answers,
        score,
        totalMarks,
        autoSubmitted: autoSubmitted === true,
      },
    });

    return res.status(201).json({
      id: submission.id,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error('Failed to store submission:', error);
    return res.status(500).json({ error: 'Unable to store the submission.' });
  }
}