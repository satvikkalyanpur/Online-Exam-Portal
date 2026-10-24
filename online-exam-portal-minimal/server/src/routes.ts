
import { Router } from 'express';
import {
  getProjectStatus,
  getExams,
  getQuestions,
  createQuestion,
} from './controllers.js';

export const router = Router();

router.get('/project-status', getProjectStatus);

router.get('/exams', getExams);
router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
