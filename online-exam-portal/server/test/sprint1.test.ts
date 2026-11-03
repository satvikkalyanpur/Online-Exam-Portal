// API tests for Sprint 1 (US01–US10). Run with: npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/prisma.js';
import { api, created, createExam, createQuestion, startServer, stopServer, tokens } from './helpers.js';

before(startServer);
after(stopServer);

describe('US01 login', () => {
  test('valid credentials log the user in and return the role', async () => {
    const { status, data } = await api('POST', '/auth/login', undefined, {
      email: '  Student@Example.com ',
      password: 'Student@123',
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    assert.equal(data.user.role, 'STUDENT');
    assert.equal(data.user.passwordHash, undefined, 'the password hash is never sent');
  });

  test('a wrong password and an unknown email get the same message', async () => {
    const wrong = await api('POST', '/auth/login', undefined, { email: 'student@example.com', password: 'nope' });
    const unknown = await api('POST', '/auth/login', undefined, { email: 'x@example.com', password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.error, 'Invalid email or password.');
    assert.equal(unknown.data.error, wrong.data.error);
  });

  test('missing fields are rejected', async () => {
    assert.equal((await api('POST', '/auth/login', undefined, { email: '' })).status, 400);
  });
});

describe('US02 role-based access', () => {
  test('the role is identified after login', async () => {
    for (const [name, role] of [
      ['admin', 'ADMIN'],
      ['teacher', 'TEACHER'],
      ['student', 'STUDENT'],
    ] as const) {
      const { data } = await api('GET', '/auth/me', tokens[name]);
      assert.equal(data.user.role, role);
    }
  });

  test('requests without a valid token are rejected', async () => {
    assert.equal((await api('GET', '/exams/available')).status, 401);
    assert.equal((await api('GET', '/questions', 'not-a-token')).status, 401);
  });

  test('a student cannot use teacher or administrator features', async () => {
    assert.equal((await api('GET', '/questions', tokens.student)).status, 403);
    assert.equal((await api('POST', '/exams', tokens.student, {})).status, 403);
    assert.equal((await api('GET', '/reports/performance', tokens.student)).status, 403);
    assert.equal((await api('GET', '/backup', tokens.student)).status, 403);
  });

  test('a teacher cannot create exams, see reports or take exams', async () => {
    assert.equal((await api('POST', '/exams', tokens.teacher, {})).status, 403);
    assert.equal((await api('GET', '/reports/statistics', tokens.teacher)).status, 403);
    assert.equal((await api('GET', '/exams/available', tokens.teacher)).status, 403);
  });

  test('an administrator cannot edit the question bank or take exams', async () => {
    assert.equal((await api('GET', '/questions', tokens.admin)).status, 403);
    assert.equal((await api('DELETE', '/questions/anything', tokens.admin)).status, 403);
    assert.equal((await api('GET', '/exams/available', tokens.admin)).status, 403);
  });
});

describe('US04 create examination', () => {
  test('an administrator creates an exam with title, subject, duration, marks and schedule', async () => {
    const startAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const endAt = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const { status, data } = await api('POST', '/exams', tokens.admin, {
      title: 'Sprint 1 test exam',
      subject: 'Testing',
      durationMinutes: 1,
      totalMarks: 3,
      startAt,
      endAt,
      publish: true,
    });
    assert.equal(status, 201, JSON.stringify(data));
    created.examIds.push(data.exam.id);
    assert.equal(data.exam.durationMinutes, 1);
    assert.equal(data.exam.totalMarks, 3);
    assert.equal(data.exam.status, 'PUBLISHED');
    assert.equal(new Date(data.exam.startAt).toISOString(), startAt);

    const list = await api('GET', '/exams', tokens.admin);
    assert.ok(list.data.some((exam: { id: string }) => exam.id === data.exam.id), 'stored');
  });

  test('invalid details are rejected', async () => {
    const valid = {
      title: 'X',
      subject: 'Y',
      durationMinutes: 30,
      totalMarks: 10,
      startAt: '2030-01-01T10:00:00Z',
      endAt: '2030-01-01T12:00:00Z',
    };
    for (const change of [
      { title: ' ' },
      { durationMinutes: 0 },
      { totalMarks: -1 },
      { endAt: '2030-01-01T09:00:00Z' },
      { endAt: '2030-01-01T10:10:00Z' }, // window shorter than the duration
    ]) {
      assert.equal((await api('POST', '/exams', tokens.admin, { ...valid, ...change })).status, 400);
    }
  });
});

describe('US05–US07 question bank', () => {
  const question = {
    text: 'What is 2 + 2?',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '22',
    correctOption: 'B',
    marks: 2,
  };

  test('US05: a teacher adds questions, linked to an exam or kept for later', async () => {
    const examId = created.examIds[0];
    await createQuestion('Sprint 1 question one', 'B', [examId], 2);
    const unlinked = await api('POST', '/questions', tokens.teacher, { ...question, text: 'Kept for later' });
    assert.equal(unlinked.status, 201);
    created.questionIds.push(unlinked.data.question.id);
    assert.deepEqual(unlinked.data.question.exams, []);

    const bank = await api('GET', '/questions', tokens.teacher);
    assert.ok(bank.data.some((q: { id: string }) => q.id === created.questionIds[0]));
  });

  test('US05: invalid questions are rejected', async () => {
    for (const change of [{ text: '' }, { optionC: ' ' }, { correctOption: 'E' }, { examIds: ['missing-exam'] }]) {
      assert.equal((await api('POST', '/questions', tokens.teacher, { ...question, ...change })).status, 400);
    }
  });

  test('US06: a teacher edits a question and the change is saved', async () => {
    const id = created.questionIds[1];
    const { status } = await api('PUT', `/questions/${id}`, tokens.teacher, {
      ...question,
      text: 'What is 3 + 3?',
      optionB: '6',
      examIds: [created.examIds[0]],
    });
    assert.equal(status, 200);
    const bank = await api('GET', '/questions', tokens.teacher);
    const updated = bank.data.find((q: { id: string }) => q.id === id);
    assert.equal(updated.text, 'What is 3 + 3?');
    assert.equal(updated.optionB, '6');
    assert.equal(updated.exams.length, 1);
    assert.equal((await api('PUT', '/questions/does-not-exist', tokens.teacher, question)).status, 404);
  });

  test('US07: a teacher deletes a question and it is gone', async () => {
    const add = await api('POST', '/questions', tokens.teacher, { ...question, text: 'Delete me' });
    const id = add.data.question.id;
    assert.equal((await api('DELETE', `/questions/${id}`, tokens.teacher)).status, 200);
    const bank = await api('GET', '/questions', tokens.teacher);
    assert.ok(!bank.data.some((q: { id: string }) => q.id === id));
    assert.equal((await api('DELETE', `/questions/${id}`, tokens.teacher)).status, 404);
  });
});

describe('US03 view available exams', () => {
  test('a student sees published exams with subject, schedule, duration and question count', async () => {
    const { status, data } = await api('GET', '/exams/available', tokens.student);
    assert.equal(status, 200);
    const exam = data.exams.find((e: { id: string }) => e.id === created.examIds[0]);
    assert.ok(exam, 'the published test exam is listed');
    assert.equal(exam.subject, 'Testing');
    assert.ok(exam.startAt && exam.endAt);
    assert.equal(exam.durationMinutes, 1);
    assert.equal(exam.questionCount, 2);
    assert.equal(exam.attempt, null);
  });

  test('draft exams are hidden, and moving an exam back to draft hides it', async () => {
    const id = created.examIds[0];
    let list = await api('GET', '/exams/available', tokens.student);
    assert.ok(list.data.exams.every((e: { status: string }) => e.status === 'PUBLISHED'));

    await api('PATCH', `/exams/${id}/status`, tokens.admin, { status: 'DRAFT' });
    list = await api('GET', '/exams/available', tokens.student);
    assert.ok(!list.data.exams.some((e: { id: string }) => e.id === id));
    await api('PATCH', `/exams/${id}/status`, tokens.admin, { status: 'PUBLISHED' });
  });
});

describe('US08–US10 taking an exam', () => {
  let attemptId = '';
  let questionIds: string[] = [];

  test('US08/US09: starting returns the questions (without answers) and a deadline', async () => {
    const { status, data } = await api('POST', `/exams/${created.examIds[0]}/attempt`, tokens.student);
    assert.equal(status, 201, JSON.stringify(data));
    attemptId = data.attempt.id;
    questionIds = data.questions.map((q: { id: string }) => q.id);
    assert.equal(data.questions.length, 2);
    assert.equal(data.questions[0].options.length, 4);
    assert.equal(JSON.stringify(data).includes('correctOption'), false, 'correct answers are not sent');

    const remainingMs = new Date(data.attempt.expiresAt).getTime() - new Date(data.serverTime).getTime();
    assert.ok(remainingMs > 55_000 && remainingMs <= 60_000, `about 1 minute left, got ${remainingMs}ms`);
  });

  test('US10: an answer is saved when selected, and updated when changed', async () => {
    const path = `/attempts/${attemptId}/answers/${questionIds[0]}`;
    assert.equal((await api('PUT', path, tokens.student, { selectedOption: 'A' })).status, 200);
    assert.equal((await api('PUT', path, tokens.student, { selectedOption: 'B' })).status, 200);
    const stored = await prisma.attemptAnswer.findMany({ where: { attemptId } });
    assert.equal(stored.length, 1);
    assert.equal(stored[0].selectedOption, 'B');
  });

  test('US08/US10: opening the exam again resumes with the same deadline and answers', async () => {
    const first = await api('GET', `/attempts/${attemptId}`, tokens.student);
    const again = await api('POST', `/exams/${created.examIds[0]}/attempt`, tokens.student);
    assert.equal(again.status, 200);
    assert.equal(again.data.resumed, true);
    assert.equal(again.data.attempt.id, attemptId);
    assert.equal(again.data.attempt.expiresAt, first.data.attempt.expiresAt);
    assert.deepEqual(again.data.answers, { [questionIds[0]]: 'B' });
  });

  test("a student cannot touch another student's attempt", async () => {
    assert.equal((await api('GET', `/attempts/${attemptId}`, tokens.student2)).status, 404);
    const r = await api('PUT', `/attempts/${attemptId}/answers/${questionIds[0]}`, tokens.student2, {
      selectedOption: 'A',
    });
    assert.equal(r.status, 404);
  });

  test('invalid answers are rejected', async () => {
    const path = `/attempts/${attemptId}/answers`;
    assert.equal((await api('PUT', `${path}/${questionIds[0]}`, tokens.student, { selectedOption: 'Z' })).status, 400);
    assert.equal((await api('PUT', `${path}/not-in-exam`, tokens.student, { selectedOption: 'A' })).status, 404);
  });

  test('US08: the student submits the exam and cannot start it again', async () => {
    const r = await api('POST', `/attempts/${attemptId}/submit`, tokens.student);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.answeredCount, 1);
    assert.equal(r.data.totalQuestions, 2);
    assert.equal(r.data.alreadySubmitted, false);
    assert.equal((await api('POST', `/exams/${created.examIds[0]}/attempt`, tokens.student)).status, 409);
  });

  test('an exam with no questions cannot be started', async () => {
    const examId = await createExam('Sprint 1 empty exam');
    assert.equal((await api('POST', `/exams/${examId}/attempt`, tokens.student)).status, 409);
  });
});
