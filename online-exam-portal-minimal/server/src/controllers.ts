import type { Request, Response } from 'express';

export function getProjectStatus(_req: Request, res: Response) {
  res.json({
    project: 'Online Exam Portal',
    status: 'skeleton',
    message: 'Implement features through separate GitHub issues and feature branches.'
  });
}

import prisma from "./prisma";

export const createExam = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      title,
      durationMinutes,
      totalMarks,
      startAt,
      endAt,
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        error: "Title is required and must be at most 150 characters.",
      });
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    ) {
      return res.status(400).json({
        error: "Duration must be between 1 and 1440 minutes.",
      });
    }

    if (
      !Number.isInteger(totalMarks) ||
      totalMarks < 1 ||
      totalMarks > 100000
    ) {
      return res.status(400).json({
        error: "Total marks must be a positive integer.",
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
        error: "Provide valid dates; the end must be after the start.",
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
      message: "Examination created successfully.",
      exam,
    });
  } catch (error) {
    console.error("Failed to create examination:", error);

    return res.status(500).json({
      error: "Unable to create examination.",
    });
  }
};
