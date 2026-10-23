import { Router } from 'express';
import { getProjectStatus } from './controllers.js';

export const router = Router();

// Add feature routes here as GitHub issues are implemented.
router.get('/project-status', getProjectStatus);
import { createExam } from "./controllers";
router.post("/exams", createExam);
