// Shared set-up for the API tests: starts the app on a free port and logs in
// the seeded test accounts. Needs a seeded database (npm run db:setup).
import 'dotenv/config';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import prisma from '../src/prisma.js';

let server: Server;
let base = '';

export const tokens = { admin: '', teacher: '', student: '', student2: '' };

/** Ids of exams and questions created by a test file, removed again at the end. */
export const created = { examIds: [] as string[], questionIds: [] as string[] };

export async function api(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

export async function loginAs(email: string, password: string) {
  const { status, data } = await api('POST', '/auth/login', undefined, { email, password });
  assert.equal(status, 200, `login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token as string;
}

export async function startServer() {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  tokens.admin = await loginAs('admin@example.com', 'Admin@123');
  tokens.teacher = await loginAs('teacher@example.com', 'Teacher@123');
  tokens.student = await loginAs('student@example.com', 'Student@123');
  tokens.student2 = await loginAs('student2@example.com', 'Student@123');
}

export async function stopServer() {
  await prisma.question.deleteMany({ where: { id: { in: created.questionIds } } });
  await prisma.exam.deleteMany({ where: { id: { in: created.examIds } } });
  await prisma.$disconnect();
  server.close();
}

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();

/** Creates a published exam through the API. Opens `opensIn` minutes from now (negative = already open). */
export async function createExam(title: string, options: { opensIn?: number; durationMinutes?: number } = {}) {
  const opensIn = options.opensIn ?? -5;
  const { status, data } = await api('POST', '/exams', tokens.admin, {
    title,
    subject: 'Testing',
    durationMinutes: options.durationMinutes ?? 10,
    totalMarks: 10,
    startAt: minutes(opensIn),
    endAt: minutes(opensIn + 180),
    publish: true,
  });
  assert.equal(status, 201, JSON.stringify(data));
  created.examIds.push(data.exam.id);
  return data.exam.id as string;
}

/** Adds a question to the bank through the API, linked to the given exams. */
export async function createQuestion(text: string, correctOption: string, examIds: string[], marks = 1) {
  const { status, data } = await api('POST', '/questions', tokens.teacher, {
    text,
    optionA: 'Option A',
    optionB: 'Option B',
    optionC: 'Option C',
    optionD: 'Option D',
    correctOption,
    marks,
    examIds,
  });
  assert.equal(status, 201, JSON.stringify(data));
  created.questionIds.push(data.question.id);
  return data.question.id as string;
}
