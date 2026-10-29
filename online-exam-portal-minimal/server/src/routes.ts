import { Router } from 'express';
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
  updateQuestion,
  createExam,
} from './controllers.js';
import { login } from './auth.js';
import { requireAuth, requireAdmin } from './security.js';

export const router = Router();

router.get('/project-status', getProjectStatus);
router.post('/auth/login', login);

// Authenticated users can view exam listings and questions.
router.get('/exams', requireAuth, getExams);
router.get('/questions', requireAuth, getQuestions);

// Only administrators can modify exam and question data.
router.post('/exams', requireAuth, requireAdmin, createExam);
router.post('/questions', requireAuth, requireAdmin, createQuestion);
router.put('/questions/:id', requireAuth, requireAdmin, updateQuestion);
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
  updateQuestion,
  createExam,
  getStudentResults,
} from './controllers.js';
