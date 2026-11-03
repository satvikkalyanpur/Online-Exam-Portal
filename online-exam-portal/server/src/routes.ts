// Every API route and the role allowed to use it.
import express, { Router } from 'express';
import { Role } from './generated/prisma/client.js';
import { login, logout, me, requireAuth, requireRole } from './auth.js';
import { createExam, listAllExams, listAvailableExams, setExamStatus, updateExam } from './exams.js';
import { createQuestion, deleteQuestion, listQuestions, updateQuestion } from './questions.js';
import { getAttempt, saveAnswer, startOrResumeAttempt, submit } from './attempts.js';
import { getMyResult, listMyResults } from './results.js';
import { examStatistics, performanceReport } from './reports.js';
import { downloadBackup, restoreBackup } from './backup.js';
import { listActivity } from './activityLog.js';

const { STUDENT, TEACHER, ADMIN } = Role;

export const router = Router();

// Public
router.post('/auth/login', login);

// Everything below needs a logged-in user.
router.use(requireAuth);
router.get('/auth/me', me);
router.post('/auth/logout', logout);

// Student
router.get('/exams/available', requireRole(STUDENT), listAvailableExams);
router.post('/exams/:id/attempt', requireRole(STUDENT), startOrResumeAttempt);
router.get('/attempts/:id', requireRole(STUDENT), getAttempt);
router.put('/attempts/:id/answers/:questionId', requireRole(STUDENT), saveAnswer);
router.post('/attempts/:id/submit', requireRole(STUDENT), submit);
router.get('/results', requireRole(STUDENT), listMyResults);
router.get('/results/:attemptId', requireRole(STUDENT), getMyResult);

// Teacher: question bank
router.get('/questions', requireRole(TEACHER), listQuestions);
router.post('/questions', requireRole(TEACHER), createQuestion);
router.put('/questions/:id', requireRole(TEACHER), updateQuestion);
router.delete('/questions/:id', requireRole(TEACHER), deleteQuestion);

// Administrator (teachers may list exams so they can add questions to them)
router.get('/exams', requireRole(ADMIN, TEACHER), listAllExams);
router.post('/exams', requireRole(ADMIN), createExam);
router.put('/exams/:id', requireRole(ADMIN), updateExam);
router.patch('/exams/:id/status', requireRole(ADMIN), setExamStatus);
router.get('/reports/performance', requireRole(ADMIN), performanceReport);
router.get('/reports/statistics', requireRole(ADMIN), examStatistics);
router.get('/activity', requireRole(ADMIN), listActivity);
router.get('/backup', requireRole(ADMIN), downloadBackup);
// Backup files can be large, so this route reads its own body after the role check.
router.post('/backup/restore', requireRole(ADMIN), express.json({ limit: '50mb' }), restoreBackup);
