import type { Request, Response } from 'express';

export function getProjectStatus(_req: Request, res: Response) {
  res.json({
    project: 'Online Exam Portal',
    status: 'skeleton',
    message: 'Implement features through separate GitHub issues and feature branches.'
  });
}

/
import prisma from './prisma.js';

export async function getExams(_req: Request, res: Response) {
  try {
    const exams = await prisma.exam.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(exams);
  } catch (error) {
    console.error('Failed to fetch exams:', error);
    return res.status(500).json({ error: 'Unable to fetch exams.' });
  }
}

export async function getQuestions(_req: Request, res: Response) {
  try {
    const questions = await prisma.question.findMany({
      include: {
        examLinks: {
          include: {
            exam: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(questions);
  } catch (error) {
    console.error('Failed to fetch questions:', error);
    return res.status(500).json({ error: 'Unable to fetch questions.' });
  }
}

export async function createQuestion(req: Request, res: Response) {
  try {
    const {
      text,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      marks,
      examId,
    } = req.body;

    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.trim().length > 10000
    ) {
      return res.status(400).json({
        error: 'Question text is required and must be at most 10000 characters.',
      });
    }

    const options = [optionA, optionB, optionC, optionD];

    if (
      options.some(
        (option) =>
          typeof option !== 'string' ||
          !option.trim() ||
          option.trim().length > 1000
      )
    ) {
      return res.status(400).json({
        error: 'All four answer options are required.',
      });
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({
        error: 'Correct option must be A, B, C, or D.',
      });
    }

    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) {
      return res.status(400).json({
        error: 'Marks must be an integer between 1 and 1000.',
      });
    }

    if (examId !== undefined && examId !== null && examId !== '') {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { id: true },
      });

      if (!exam) {
        return res.status(400).json({
          error: 'The selected examination does not exist.',
        });
      }
    }

    const question = await prisma.question.create({
      data: {
        text: text.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        correctOption,
        marks,
        ...(examId
          ? {
              examLinks: {
                create: {
                  exam: { connect: { id: examId } },
                },
              },
            }
          : {}),
      },
      include: {
        examLinks: {
          include: {
            exam: { select: { id: true, title: true } },
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Question added to the question bank.',
      question,
    });
  } catch (error) {
    console.error('Failed to create question:', error);
    return res.status(500).json({
      error: 'Unable to save the question.',
    });
  }
}
