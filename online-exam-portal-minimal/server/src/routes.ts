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
  getPerformanceReports,
} from './controllers.js';
import { getActivityLogs, recordExamStart } from './activityLog.js';
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

// Students submit their finished exam and report that they started one.
router.post('/submissions', requireAuth, createSubmission);
router.post('/activity/exam-start', requireAuth, recordExamStart);

router.get(
  '/admin/reports/performance',
  requireAuth,
  requireAdmin,
  getPerformanceReports,
);

// Only administrators can view the activity logs.
router.get('/admin/activity-logs', requireAuth, requireAdmin, getActivityLogs);
