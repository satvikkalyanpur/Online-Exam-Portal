// Test accounts and sample data, so the portal can be tried straight away.
// Safe to run more than once: accounts are reset to the passwords below, and
// sample exams are only added to a database that has no exams yet.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { ExamStatus, Role } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { submitAttempt } from './grading.js';

const users = [
  { name: 'Portal Administrator', email: 'admin@example.com', password: 'Admin@123', role: Role.ADMIN },
  { name: 'Test Teacher', email: 'teacher@example.com', password: 'Teacher@123', role: Role.TEACHER },
  { name: 'Test Student', email: 'student@example.com', password: 'Student@123', role: Role.STUDENT },
  { name: 'Second Student', email: 'student2@example.com', password: 'Student@123', role: Role.STUDENT },
];

type Option = 'A' | 'B' | 'C' | 'D';
type SampleQuestion = { text: string; options: [string, string, string, string]; correct: Option };

const csQuestions: SampleQuestion[] = [
  { text: 'Which data structure follows FIFO (first in, first out)?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correct: 'B' },
  { text: 'Which language runs natively in a web browser?', options: ['C', 'Java', 'JavaScript', 'SQL'], correct: 'C' },
  { text: 'What does HTTP stand for?', options: ['Hypertext Transfer Protocol', 'High Transfer Text Program', 'Hyper Transfer Technology Process', 'Host Text Transfer Protocol'], correct: 'A' },
  { text: 'Which number system does a computer use internally?', options: ['Decimal', 'Binary', 'Octal', 'Roman'], correct: 'B' },
  { text: 'Which device is used to store files permanently?', options: ['RAM', 'CPU cache', 'Hard disk / SSD', 'Register'], correct: 'C' },
];

const dsaQuestions: SampleQuestion[] = [
  { text: 'Which data structure uses LIFO (last in, first out)?', options: ['Queue', 'Stack', 'Array', 'Graph'], correct: 'B' },
  { text: 'What is the time complexity of binary search on a sorted array?', options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], correct: 'C' },
  { text: 'Which traversal visits the root between the left and right subtrees?', options: ['Pre-order', 'In-order', 'Post-order', 'Level-order'], correct: 'B' },
];

const osQuestions: SampleQuestion[] = [
  { text: 'Which of these is not an operating system?', options: ['Linux', 'Windows', 'Oracle', 'macOS'], correct: 'C' },
  { text: 'What does the CPU scheduler decide?', options: ['Which process runs next', 'How much RAM to buy', 'The screen resolution', 'The file name'], correct: 'A' },
  { text: 'A situation where processes wait for each other forever is called…', options: ['Paging', 'Deadlock', 'Caching', 'Booting'], correct: 'B' },
];

const dbQuestions: SampleQuestion[] = [
  { text: 'Which SQL keyword removes rows from a table?', options: ['DROP', 'DELETE', 'REMOVE', 'CLEAR'], correct: 'B' },
];

/** A date `days` from today at the given hour (local time). */
function day(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function addExam(
  exam: { title: string; subject: string; description: string; durationMinutes: number; startAt: Date; endAt: Date; status: ExamStatus },
  questions: SampleQuestion[],
  adminId: string
) {
  const created = await prisma.exam.create({
    data: { ...exam, totalMarks: questions.length, createdById: adminId },
  });
  const questionIds: string[] = [];
  for (const q of questions) {
    const question = await prisma.question.create({
      data: {
        text: q.text,
        optionA: q.options[0],
        optionB: q.options[1],
        optionC: q.options[2],
        optionD: q.options[3],
        correctOption: q.correct,
        marks: 1,
        examLinks: { create: { examId: created.id } },
      },
    });
    questionIds.push(question.id);
  }
  return { examId: created.id, questionIds };
}

/** A finished attempt, so reports and statistics have something to show. */
async function addFinishedAttempt(examId: string, studentId: string, answers: Record<string, Option>) {
  const startedAt = day(-1, 11);
  const attempt = await prisma.attempt.create({
    data: { examId, studentId, startedAt, expiresAt: new Date(startedAt.getTime() + 30 * 60_000) },
  });
  for (const [questionId, selectedOption] of Object.entries(answers)) {
    await prisma.attemptAnswer.create({ data: { attemptId: attempt.id, questionId, selectedOption } });
  }
  await submitAttempt(attempt.id, false);
}

async function main() {
  const ids: Record<string, string> = {};
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, role: user.role, name: user.name },
      create: { name: user.name, email: user.email, passwordHash, role: user.role },
    });
    ids[user.email] = saved.id;
  }

  if ((await prisma.exam.count()) === 0) {
    const adminId = ids['admin@example.com'];
    const open = { startAt: day(-2, 9), endAt: day(14, 18), status: ExamStatus.PUBLISHED };

    const cs = await addExam(
      { title: 'Computer Science Fundamentals', subject: 'Computer Science', description: 'Basic computing concepts.', durationMinutes: 30, ...open },
      csQuestions,
      adminId
    );
    const dsa = await addExam(
      { title: 'Data Structures and Algorithms', subject: 'Computer Science', description: 'Stacks, queues, trees and searching.', durationMinutes: 20, ...open },
      dsaQuestions,
      adminId
    );
    await addExam(
      { title: 'Operating Systems Quiz', subject: 'Operating Systems', description: 'Opens tomorrow morning.', durationMinutes: 15, startAt: day(1, 10), endAt: day(3, 18), status: ExamStatus.PUBLISHED },
      osQuestions,
      adminId
    );
    await addExam(
      { title: 'Database Systems', subject: 'Databases', description: 'Draft: not visible to students yet.', durationMinutes: 15, startAt: day(7, 10), endAt: day(7, 12), status: ExamStatus.DRAFT },
      dbQuestions,
      adminId
    );

    // The second student has already taken both open exams.
    const [c1, c2, c3, c4] = cs.questionIds;
    const [d1, d2, d3] = dsa.questionIds;
    await addFinishedAttempt(cs.examId, ids['student2@example.com'], { [c1]: 'B', [c2]: 'C', [c3]: 'A', [c4]: 'C' });
    await addFinishedAttempt(dsa.examId, ids['student2@example.com'], { [d1]: 'B', [d2]: 'A', [d3]: 'B' });

    console.log('Added 4 sample examinations, 12 questions and 2 finished attempts.');
  }

  console.log('\nTest accounts:');
  for (const user of users) {
    console.log(`  ${user.role.padEnd(8)} ${user.email.padEnd(22)} ${user.password}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
