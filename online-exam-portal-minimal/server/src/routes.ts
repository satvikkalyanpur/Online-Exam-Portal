import { Router } from 'express';
import { createSubmission } from './submissions.js';
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
  updateQuestion,
  createExam,
  getStudentResults,
  getExaminationStatistics,
} from './controllers.js';
import { login } from './auth.js';
import { requireAuth, requireAdmin } from './security.js';

export const router = Router();

router.get('/project-status', getProjectStatus);
router.post('/auth/login', login);

// Authenticated users can view examinations and questions.
router.get('/exams', requireAuth, getExams);
router.get('/questions', requireAuth, getQuestions);
router.get('/results/me', requireAuth, getStudentResults);

// Only administrators can modify examination and question data.
router.post('/exams', requireAuth, requireAdmin, createExam);
router.post('/questions', requireAuth, requireAdmin, createQuestion);
router.put('/questions/:id', requireAuth, requireAdmin, updateQuestion);

// Only administrators can generate and view examination statistics.
router.get(
  '/admin/statistics',
  requireAuth,
  requireAdmin,
  getExaminationStatistics,
);
