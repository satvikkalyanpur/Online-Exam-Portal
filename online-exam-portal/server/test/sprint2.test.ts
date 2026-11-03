// API tests for Sprint 2 (US11–US22). Run with: npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma.js';
import { api, created, createExam, createQuestion, startServer, stopServer, tokens } from './helpers.js';

before(startServer);
after(stopServer);

const answerPath = (attemptId: string, questionId: string) => `/attempts/${attemptId}/answers/${questionId}`;

describe('US12 restrict access before the scheduled time', () => {
  test('an exam that has not opened is listed but cannot be started', async () => {
    const examId = await createExam('Sprint 2 upcoming exam', { opensIn: 60 });
    await createQuestion('Upcoming question', 'A', [examId]);

    const list = await api('GET', '/exams/available', tokens.student);
    const exam = list.data.exams.find((e: { id: string }) => e.id === examId);
    assert.ok(new Date(exam.startAt) > new Date(list.data.serverTime), 'start time is in the future');

    const r = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    assert.equal(r.status, 403);
    assert.equal(r.data.error, 'This examination has not started yet.');
    assert.equal(r.data.opensAt, exam.startAt);
  });

  test('the exam can be started once its start time is reached', async () => {
    const examId = created.examIds[0];
    const opened = await api('PUT', `/exams/${examId}`, tokens.admin, {
      title: 'Sprint 2 upcoming exam',
      subject: 'Testing',
      durationMinutes: 10,
      totalMarks: 10,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    assert.equal(opened.status, 200);
    assert.equal((await api('POST', `/exams/${examId}/attempt`, tokens.student)).status, 201);
  });

  test('an exam whose window has ended cannot be started', async () => {
    const examId = await createExam('Sprint 2 closed exam', { opensIn: -300 });
    await createQuestion('Closed question', 'A', [examId]);
    await prisma.exam.update({ where: { id: examId }, data: { endAt: new Date(Date.now() - 60_000) } });
    const r = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    assert.equal(r.status, 403);
    assert.equal(r.data.error, 'This examination has closed.');
  });
});

describe('US11, US14 and US15: answering, marking and results', () => {
  let examId = '';
  let attemptId = '';
  let q1 = '';
  let q2 = '';
  let q3 = '';

  test('US11: answers to several questions are kept while moving between them', async () => {
    examId = await createExam('Sprint 2 marking exam');
    q1 = await createQuestion('Marked question one', 'A', [examId], 1);
    q2 = await createQuestion('Marked question two', 'B', [examId], 2);
    q3 = await createQuestion('Marked question three', 'C', [examId], 3);

    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    attemptId = start.data.attempt.id;
    assert.deepEqual(
      start.data.questions.map((q: { id: string }) => q.id),
      [q1, q2, q3],
      'questions come in a fixed order'
    );

    await api('PUT', answerPath(attemptId, q1), tokens.student, { selectedOption: 'A' });
    await api('PUT', answerPath(attemptId, q2), tokens.student, { selectedOption: 'D' });
    const reopened = await api('GET', `/attempts/${attemptId}`, tokens.student);
    assert.deepEqual(reopened.data.answers, { [q1]: 'A', [q2]: 'D' });
  });

  test('US15: there is no result before the exam is submitted', async () => {
    assert.equal((await api('GET', `/results/${attemptId}`, tokens.student)).status, 409);
  });

  test('US14: submitting marks the answers and stores the score', async () => {
    const r = await api('POST', `/attempts/${attemptId}/submit`, tokens.student);
    assert.equal(r.status, 200);
    assert.equal(r.data.score, 1, 'only question one (1 mark) is right');
    assert.equal(r.data.maxScore, 6);
    assert.equal(r.data.percentage, 16.7);
    assert.equal(r.data.answeredCount, 2);
    assert.equal(r.data.totalQuestions, 3);

    const stored = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
    assert.equal(stored.score, 1);
    assert.equal(stored.maxScore, 6);
    const byQuestion = Object.fromEntries(stored.answers.map((a) => [a.questionId, a]));
    assert.equal(byQuestion[q1].isCorrect, true);
    assert.equal(byQuestion[q2].isCorrect, false);
    assert.equal(byQuestion[q3].selectedOption, null, 'unanswered questions are stored too');
    assert.equal(byQuestion[q3].isCorrect, false);
  });

  test('US15: the student sees the result for the right exam', async () => {
    const list = await api('GET', '/results', tokens.student);
    const row = list.data.find((r: { id: string }) => r.id === attemptId);
    assert.equal(row.exam.id, examId);
    assert.equal(row.score, 1);
    assert.equal(row.percentage, 16.7);

    const detail = await api('GET', `/results/${attemptId}`, tokens.student);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.questions.length, 3);
    assert.equal(detail.data.questions[0].selectedOption, 'A');
  });

  test('US15/US18: correct answers stay hidden until the exam closes, and results are private', async () => {
    let detail = await api('GET', `/results/${attemptId}`, tokens.student);
    assert.equal(detail.data.answersVisible, false);
    for (const q of detail.data.questions) {
      assert.equal(q.correctOption, null);
      assert.equal(q.isCorrect, null, 'not even right/wrong is shown while the exam is open');
    }

    await prisma.exam.update({ where: { id: examId }, data: { endAt: new Date(Date.now() - 1000) } });
    detail = await api('GET', `/results/${attemptId}`, tokens.student);
    assert.equal(detail.data.answersVisible, true);
    assert.equal(detail.data.questions[1].correctOption, 'B');
    assert.equal(detail.data.questions[0].isCorrect, true);
    assert.equal(detail.data.questions[1].isCorrect, false);

    assert.equal((await api('GET', `/results/${attemptId}`, tokens.student2)).status, 404);
    assert.equal((await api('GET', '/results', tokens.teacher)).status, 403);
  });

  test('US07: a question that has been marked cannot be deleted', async () => {
    const r = await api('DELETE', `/questions/${q1}`, tokens.teacher);
    assert.equal(r.status, 409);
  });

  test("US06: a marked question's wording can be fixed, but not its answer or marks", async () => {
    const question = {
      text: 'Marked question one (reworded)',
      optionA: 'Option A',
      optionB: 'Option B',
      optionC: 'Option C',
      optionD: 'Option D',
      correctOption: 'A',
      marks: 1,
      examIds: [examId],
    };
    assert.equal((await api('PUT', `/questions/${q1}`, tokens.teacher, question)).status, 200);
    assert.equal((await api('PUT', `/questions/${q1}`, tokens.teacher, { ...question, correctOption: 'B' })).status, 409);
    assert.equal((await api('PUT', `/questions/${q1}`, tokens.teacher, { ...question, marks: 5 })).status, 409);
  });

  test('US16: the administrator sees the attempt in the performance report, filtered by exam', async () => {
    const all = await api('GET', '/reports/performance', tokens.admin);
    assert.equal(all.status, 200);
    const filtered = await api('GET', `/reports/performance?examId=${examId}`, tokens.admin);
    assert.equal(filtered.data.length, 1);
    const row = filtered.data[0];
    assert.equal(row.student.email, 'student@example.com');
    assert.equal(row.exam.title, 'Sprint 2 marking exam');
    assert.equal(row.score, 1);
    assert.equal(row.percentage, 16.7);
    assert.ok(all.data.length >= filtered.data.length);
    assert.equal(JSON.stringify(all.data).includes('passwordHash'), false);
  });

  test('US17: statistics are worked out from the stored results', async () => {
    const r = await api('GET', '/reports/statistics', tokens.admin);
    assert.equal(r.status, 200);
    const exam = r.data.exams.find((e: { id: string }) => e.id === examId);
    assert.equal(exam.submittedCount, 1);
    assert.equal(exam.averagePercentage, 16.7);
    assert.equal(exam.highestPercentage, 16.7);
    assert.equal(exam.lowestPercentage, 16.7);
    assert.equal(exam.passCount, 0);
    assert.ok(r.data.summary.submittedCount >= 1);
  });

  test('US16/US17: only administrators can see reports and statistics', async () => {
    for (const token of [tokens.teacher, tokens.student]) {
      assert.equal((await api('GET', '/reports/performance', token)).status, 403);
      assert.equal((await api('GET', '/reports/statistics', token)).status, 403);
    }
  });
});

describe('US13 automatic submission when time runs out', () => {
  test('the browser asking for an automatic submission is recorded as automatic', async () => {
    const examId = await createExam('Sprint 2 auto exam');
    await createQuestion('Auto question', 'A', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const r = await api('POST', `/attempts/${start.data.attempt.id}/submit`, tokens.student, { auto: true });
    assert.equal(r.data.autoSubmitted, true);
  });

  test('an attempt whose time ran out is submitted even if the student closed the browser', async () => {
    const examId = await createExam('Sprint 2 abandoned exam');
    const q = await createQuestion('Abandoned question', 'C', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const attemptId = start.data.attempt.id;
    await api('PUT', answerPath(attemptId, q), tokens.student, { selectedOption: 'C' });

    await prisma.attempt.update({ where: { id: attemptId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const list = await api('GET', '/exams/available', tokens.student);
    const exam = list.data.exams.find((e: { id: string }) => e.id === examId);
    assert.equal(exam.attempt.status, 'SUBMITTED');
    assert.equal(exam.attempt.score, 1, 'the saved answer was marked');

    const stored = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    assert.equal(stored.autoSubmitted, true);
  });

  test('answers sent after the deadline are refused and the attempt is closed', async () => {
    const examId = await createExam('Sprint 2 late exam');
    const q = await createQuestion('Late question', 'A', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const attemptId = start.data.attempt.id;
    await prisma.attempt.update({ where: { id: attemptId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const r = await api('PUT', answerPath(attemptId, q), tokens.student, { selectedOption: 'A' });
    assert.equal(r.status, 409);
    const stored = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    assert.equal(stored.status, 'SUBMITTED');
    assert.equal(stored.score, 0);
  });

  test('an attempt never runs past the end of the exam window', async () => {
    const examId = await createExam('Sprint 2 short window', { durationMinutes: 60 });
    await createQuestion('Window question', 'A', [examId]);
    const endAt = new Date(Date.now() + 10 * 60_000);
    await prisma.exam.update({ where: { id: examId }, data: { endAt } });
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    assert.equal(new Date(start.data.attempt.expiresAt).getTime(), endAt.getTime());
  });
});

describe('exams that are being taken', () => {
  test("an exam's questions cannot change while a student is taking it", async () => {
    const examId = await createExam('Sprint 2 busy exam');
    const q = await createQuestion('Busy question', 'A', [examId]);
    await api('POST', `/exams/${examId}/attempt`, tokens.student);

    const add = await api('POST', '/questions', tokens.teacher, {
      text: 'Added during the exam',
      optionA: 'a',
      optionB: 'b',
      optionC: 'c',
      optionD: 'd',
      correctOption: 'A',
      marks: 1,
      examIds: [examId],
    });
    assert.equal(add.status, 409);
    assert.match(add.data.error, /taking "Sprint 2 busy exam" right now/);
    assert.equal((await api('DELETE', `/questions/${q}`, tokens.teacher)).status, 409);
  });

  test('a student in the middle of an exam can carry on if it is moved back to draft', async () => {
    const examId = await createExam('Sprint 2 draft-midway exam');
    await createQuestion('Draft-midway question', 'A', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    await api('PATCH', `/exams/${examId}/status`, tokens.admin, { status: 'DRAFT' });

    const resume = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    assert.equal(resume.status, 200);
    assert.equal(resume.data.attempt.id, start.data.attempt.id);
    assert.equal((await api('POST', `/exams/${examId}/attempt`, tokens.student2)).status, 404, 'but nobody new');
  });

  test('answers to questions no longer in the exam are not counted', async () => {
    const examId = await createExam('Sprint 2 shrinking exam');
    const keep = await createQuestion('Kept question', 'A', [examId]);
    const gone = await createQuestion('Removed question', 'A', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const attemptId = start.data.attempt.id;
    await api('PUT', answerPath(attemptId, keep), tokens.student, { selectedOption: 'A' });
    await api('PUT', answerPath(attemptId, gone), tokens.student, { selectedOption: 'A' });
    await prisma.examQuestion.delete({ where: { questionId_examId: { questionId: gone, examId } } });

    const r = await api('POST', `/attempts/${attemptId}/submit`, tokens.student);
    assert.equal(r.data.totalQuestions, 1);
    assert.equal(r.data.answeredCount, 1);
    assert.equal(r.data.maxScore, 1);
  });
});

describe('US19 consistency after a lost connection', () => {
  test('resending answers and submissions never creates duplicates', async () => {
    const testStart = new Date();
    const examId = await createExam('Sprint 2 retry exam');
    const q = await createQuestion('Retry question', 'D', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const attemptId = start.data.attempt.id;

    // The same answer sent three times (e.g. retried after the connection came back)
    for (let i = 0; i < 3; i++) {
      assert.equal((await api('PUT', answerPath(attemptId, q), tokens.student, { selectedOption: 'D' })).status, 200);
    }
    assert.equal(await prisma.attemptAnswer.count({ where: { attemptId } }), 1);

    // Two submissions at the same moment, then a retry
    const [first, second] = await Promise.all([
      api('POST', `/attempts/${attemptId}/submit`, tokens.student),
      api('POST', `/attempts/${attemptId}/submit`, tokens.student),
    ]);
    const retry = await api('POST', `/attempts/${attemptId}/submit`, tokens.student);
    assert.deepEqual([first.status, second.status, retry.status], [200, 200, 200]);
    assert.equal([first, second].filter((r) => r.data.alreadySubmitted === false).length, 1, 'submitted once');
    assert.equal(retry.data.score, 1);
    assert.equal(await prisma.attempt.count({ where: { examId } }), 1);

    const submitLogs = await prisma.activityLog.count({
      where: { action: 'EXAM_SUBMITTED', details: { contains: 'Sprint 2 retry exam' }, createdAt: { gte: testStart } },
    });
    assert.equal(submitLogs, 1);
  });

  test('an answer racing with the submission is either marked or refused, never stored unmarked', async () => {
    for (let round = 0; round < 8; round++) {
      const examId = await createExam(`Sprint 2 race exam ${round}`);
      const q = await createQuestion(`Race question ${round}`, 'B', [examId]);
      const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
      const attemptId = start.data.attempt.id;

      const [save] = await Promise.all([
        api('PUT', answerPath(attemptId, q), tokens.student, { selectedOption: 'B' }),
        api('POST', `/attempts/${attemptId}/submit`, tokens.student),
      ]);
      const stored = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
      const answer = stored.answers[0];
      if (save.status === 200) {
        // The answer got in first, so it must have been marked.
        assert.equal(answer.selectedOption, 'B');
        assert.equal(answer.isCorrect, true);
        assert.equal(stored.score, 1);
      } else {
        assert.equal(save.status, 409);
        assert.equal(answer.selectedOption, null);
        assert.equal(stored.score, 0);
      }
    }
  });

  test('an answer arriving a few seconds after the deadline (network delay) still counts', async () => {
    const examId = await createExam('Sprint 2 delayed exam');
    const q = await createQuestion('Delayed question', 'B', [examId]);
    const start = await api('POST', `/exams/${examId}/attempt`, tokens.student);
    const attemptId = start.data.attempt.id;
    await prisma.attempt.update({ where: { id: attemptId }, data: { expiresAt: new Date(Date.now() - 3000) } });

    assert.equal((await api('PUT', answerPath(attemptId, q), tokens.student, { selectedOption: 'B' })).status, 200);
    const r = await api('POST', `/attempts/${attemptId}/submit`, tokens.student, { auto: true });
    assert.equal(r.data.score, 1);
  });
});

describe('US18 protecting credentials and data', () => {
  test('responses carry security headers and are not cached', async () => {
    const r = await api('GET', '/auth/me', tokens.student);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok(r.headers.get('content-security-policy'));
  });

  test('passwords are stored as bcrypt hashes', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'student@example.com' } });
    assert.match(user.passwordHash, /^\$2[aby]\$10\$/);
    assert.ok(!user.passwordHash.includes('Student@123'));
  });

  test('repeated wrong passwords are locked out for a while', async () => {
    const attempt = () => api('POST', '/auth/login', undefined, { email: 'guess@example.com', password: 'wrong' });
    for (let i = 0; i < 5; i++) assert.equal((await attempt()).status, 401);
    const locked = await attempt();
    assert.equal(locked.status, 429);
    assert.match(locked.data.error, /Too many failed attempts/);
  });

  test('a refused request is written to the activity log', async () => {
    await api('GET', '/backup', tokens.student);
    const log = await prisma.activityLog.findFirst({ where: { action: 'ACCESS_DENIED' }, orderBy: { createdAt: 'desc' } });
    assert.match(log!.details, /STUDENT tried GET \/api\/backup/);
  });
});

describe('US21 activity logs', () => {
  test('logins, exam starts, submissions and exam creation are logged', async () => {
    const r = await api('GET', '/activity', tokens.admin);
    assert.equal(r.status, 200);
    const actions = new Set(r.data.logs.map((l: { action: string }) => l.action));
    for (const action of ['LOGIN', 'LOGIN_FAILED', 'EXAM_STARTED', 'EXAM_SUBMITTED', 'EXAM_CREATED', 'QUESTION_ADDED']) {
      assert.ok(actions.has(action), `${action} is logged`);
    }
    const start = r.data.logs.find((l: { action: string }) => l.action === 'EXAM_STARTED');
    assert.equal(start.user.email, 'student@example.com');
    assert.ok(start.createdAt);
  });

  test('logs can be filtered by action and searched', async () => {
    const r = await api('GET', '/activity?action=EXAM_SUBMITTED&search=retry', tokens.admin);
    assert.ok(r.data.logs.length >= 1);
    assert.ok(r.data.logs.every((l: { action: string }) => l.action === 'EXAM_SUBMITTED'));
    assert.equal((await api('GET', '/activity?action=NOPE', tokens.admin)).status, 400);
    assert.equal((await api('GET', '/activity?action=toString', tokens.admin)).status, 400);
  });

  test('only administrators can read the logs', async () => {
    assert.equal((await api('GET', '/activity', tokens.teacher)).status, 403);
    assert.equal((await api('GET', '/activity', tokens.student)).status, 403);
  });
});

describe('US20 backup and recovery', () => {
  test('a backup contains the exam and result data', async () => {
    const r = await api('GET', '/backup', tokens.admin);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-disposition') ?? '', /attachment; filename="exam-portal-backup-\d+\.json"/);
    assert.equal(r.data.format, 'online-exam-portal-backup');
    assert.ok(r.data.data.exams.some((e: { id: string }) => e.id === created.examIds[0]));
    assert.ok(r.data.data.attempts.some((a: { score: number | null }) => a.score !== null));
    assert.equal(r.data.counts.exams, r.data.data.exams.length);
  });

  test('restoring brings back deleted exams, questions and results exactly', async () => {
    const backup = (await api('GET', '/backup', tokens.admin)).data;
    const examId = created.examIds[0];
    const before = await prisma.attempt.findMany({ where: { examId }, include: { answers: true } });
    assert.ok(before.length > 0);

    // Simulate data loss
    await prisma.exam.delete({ where: { id: examId } });
    assert.equal(await prisma.attempt.count({ where: { examId } }), 0);

    const r = await api('POST', '/backup/restore', tokens.admin, backup);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.counts.exams, backup.data.exams.length);

    const after = await prisma.attempt.findMany({ where: { examId }, include: { answers: true } });
    assert.deepEqual(after, before);
    assert.equal(await prisma.exam.count(), backup.data.exams.length);
  });

  test('a damaged or inconsistent file is refused and nothing changes', async () => {
    const backup = (await api('GET', '/backup', tokens.admin)).data;
    const examsBefore = await prisma.exam.count();

    const notBackup = await api('POST', '/backup/restore', tokens.admin, { hello: 'world' });
    assert.equal(notBackup.status, 400);

    const broken = structuredClone(backup);
    broken.data.attempts[0].examId = 'missing-exam';
    const inconsistent = await api('POST', '/backup/restore', tokens.admin, broken);
    assert.equal(inconsistent.status, 400);
    assert.match(inconsistent.data.error, /inconsistent/);

    const badField = structuredClone(backup);
    badField.data.questions[0].correctOption = 'Z';
    assert.equal((await api('POST', '/backup/restore', tokens.admin, badField)).status, 400);

    const badAnswer = structuredClone(backup);
    badAnswer.data.attemptAnswers[0].selectedOption = 'Z';
    assert.equal((await api('POST', '/backup/restore', tokens.admin, badAnswer)).status, 400);

    const tooLong = structuredClone(backup);
    tooLong.data.exams[0].title = 'x'.repeat(500);
    const longResult = await api('POST', '/backup/restore', tokens.admin, tooLong);
    assert.equal(longResult.status, 400);
    assert.match(longResult.data.error, /Nothing was changed/);

    assert.equal(await prisma.exam.count(), examsBefore);
  });

  test('only administrators can back up or restore', async () => {
    assert.equal((await api('GET', '/backup', tokens.teacher)).status, 403);
    assert.equal((await api('POST', '/backup/restore', tokens.teacher, {})).status, 403);
  });
});
