import { Router } from 'express';
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
  createExam,
} from './controllers.js';
import { login } from './auth.js';
import { me } from './users.js';
import { requireAuth, requireRole } from './middleware.js';

export const router = Router();

router.get('/project-status', getProjectStatus);

router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

router.get('/exams', requireAuth, getExams);
router.get('/questions', requireAuth, requireRole('TEACHER', 'ADMIN'), getQuestions);
router.post('/questions', requireAuth, requireRole('TEACHER', 'ADMIN'), createQuestion);
router.post('/exams', requireAuth, requireRole('TEACHER', 'ADMIN'), createExam);