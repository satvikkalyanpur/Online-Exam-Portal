import type { Request, Response } from 'express';
import prisma from './prisma.js';

export function getProjectStatus(_req: Request, res: Response) {
  res.json({
    project: 'Online Exam Portal',
    status: 'skeleton',
    message: 'Implement features through separate GitHub issues and feature branches.',
  });
}

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
      select: {
        id: true,
        text: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        marks: true,
        createdAt: true,
        examLinks: {
          select: {
            exam: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(questions);
  } catch (error) {
    console.error('Failed to fetch questions:', error);
    return res.status(500).json({
      error: 'Unable to fetch questions.',
    });
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

export const createExam = async (req: Request, res: Response) => {
  try {
    const { title, durationMinutes, totalMarks, startAt, endAt } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        error: 'Title is required and must be at most 150 characters.',
      });
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    ) {
      return res.status(400).json({
        error: 'Duration must be between 1 and 1440 minutes.',
      });
    }

    if (
      !Number.isInteger(totalMarks) ||
      totalMarks < 1 ||
      totalMarks > 100000
    ) {
      return res.status(400).json({
        error: 'Total marks must be a positive integer.',
      });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (
      !startAt ||
      !endAt ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        error: 'Provide valid dates; the end must be after the start.',
      });
    }

    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        durationMinutes,
        totalMarks,
        startAt: start,
        endAt: end,
      },
    });

    return res.status(201).json({
      message: 'Examination created successfully.',
      exam,
    });
  } catch (error) {
    console.error('Failed to create examination:', error);

    return res.status(500).json({
      error: 'Unable to create examination.',
    });
  }
};
export async function updateQuestion(req: Request, res: Response) {
  try {
    const {
      text,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      marks,
    } = req.body;

    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.trim().length > 10000
    ) {
      return res.status(400).json({ error: 'Valid question text is required.' });
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
      return res.status(400).json({ error: 'All four options are required.' });
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({ error: 'Correct option must be A, B, C, or D.' });
    }

    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) {
      return res.status(400).json({ error: 'Marks must be between 1 and 1000.' });
    }

    const existing = await prisma.question.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        text: text.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        correctOption,
        marks,
      },
      include: {
        examLinks: {
          include: {
            exam: { select: { id: true, title: true } },
          },
        },
      },
    });

    return res.json({ message: 'Question updated successfully.', question });
  } catch (error) {
    console.error('Failed to update question:', error);
    return res.status(500).json({ error: 'Unable to update question.' });
  }
}
};
export async function getStudentResults(
  req: Request,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }

    const results = await prisma.result.findMany({
      where: {
        studentId,
        evaluated: true,
      },
      orderBy: { evaluatedAt: 'desc' },
      select: {
        id: true,
        examId: true,
        score: true,
        evaluated: true,
        evaluatedAt: true,
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
          },
        },
      },
    });

    return res.json(results);
  } catch (error) {
    console.error('Failed to fetch student results:', error);
    return res.status(500).json({
      error: 'Unable to fetch examination results.',
    });
  }
}

export async function getPerformanceReports(
  _req: Request,
  res: Response
) {
  try {
    const results = await prisma.examResult.findMany({
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    const reports = results.map((result) => ({
      id: result.id,
      student: result.student,
      exam: result.exam,
      score: result.score,
      totalMarks: result.totalMarks,
      percentage:
        result.totalMarks > 0
          ? Number(
              ((result.score / result.totalMarks) * 100).toFixed(2)
            )
          : 0,
      submittedAt: result.submittedAt,
    }));

    return res.json(reports);
  } catch {
    return res.status(500).json({
      message: 'Unable to generate performance reports',
    });
  }
}


export async function getExaminationStatistics(
  _req: Request,
  res: Response,
) {
  try {
    const results = await prisma.examResult.findMany({
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
          },
        },
      },
    });

    const statistics = new Map<
      string,
      {
        exam: { id: string; title: string; totalMarks: number };
        totalAttempts: number;
        totalScore: number;
        highestScore: number;
        lowestScore: number;
      }
    >();

    for (const result of results) {
      const current = statistics.get(result.exam.id) ?? {
        exam: result.exam,
        totalAttempts: 0,
        totalScore: 0,
        highestScore: result.score,
        lowestScore: result.score,
      };

      current.totalAttempts += 1;
      current.totalScore += result.score;
      current.highestScore = Math.max(current.highestScore, result.score);
      current.lowestScore = Math.min(current.lowestScore, result.score);

      statistics.set(result.exam.id, current);
    }

    const reports = Array.from(statistics.values()).map((item) => ({
      ...item,
      averageScore: Number(
        (item.totalScore / item.totalAttempts).toFixed(2),
      ),
      averagePercentage:
        item.exam.totalMarks > 0
          ? Number(
              (
                (item.totalScore / item.totalAttempts /
                  item.exam.totalMarks) *
                100
              ).toFixed(2),
            )
          : 0,
    }));

    return res.json({
      totalExams: reports.length,
      totalAttempts: results.length,
      examinations: reports,
    });
  } catch (error) {
    console.error('Failed to generate examination statistics:', error);
    return res.status(500).json({
      error: 'Unable to generate examination statistics.',
    });
  }
}
router.get(
  '/admin/reports/performance',
  requireAuth,
  requireAdmin,
  getPerformanceReports,
);
router.post('/submissions', requireAuth, createSubmission);
router.get(
  '/admin/reports/performance',
  requireAuth,
  requireAdmin,
  getPerformanceReports,
);
