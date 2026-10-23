import type { Request, Response } from 'express';

export function getProjectStatus(_req: Request, res: Response) {
  res.json({
    project: 'Online Exam Portal',
    status: 'skeleton',
    message: 'Implement features through separate GitHub issues and feature branches.'
  });
}

// TODO: Add controllers in their own modules as features grow:
// authentication, users/roles, exams, questions, attempts, grading, and reports.
