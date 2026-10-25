import { Router } from 'express';
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
  createExam,
} from './controllers.js';
import { login } from './auth.js';

export const router = Router();

router.get('/project-status', getProjectStatus);

router.get('/exams', getExams);
router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
router.post('/exams', createExam);

router.post('/auth/login', login);