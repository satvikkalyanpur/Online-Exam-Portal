import type { Exam } from '../types';

/**
 * An exam doesn't hold its own copy of the questions. It lists the ids of
 * the question-bank questions it uses, so deleting a question from the
 * bank also removes it from the exam.
 */
export interface ExamDefinition extends Omit<Exam, 'questions'> {
  questionIds: number[];
}

export const examDefinitions: ExamDefinition[] = [
  {
    id: 1,
    title: 'Computer Science Fundamentals',
    subject: 'Computer Science',
    duration: 30,
    // Already open.
    startAt: '2026-10-01T09:00:00',
    questionIds: [1, 2, 3],
  },
  {
    id: 2,
    title: 'Data Structures and Algorithms',
    subject: 'Computer Science',
    duration: 20,
    // Demo: opens 90 seconds after the page loads so the unlock can be shown.
    // Replace with a real date, for example '2026-11-20T10:00:00'.
    startAt: new Date(Date.now() + 90 * 1000).toISOString(),
    questionIds: [4, 5],
  },
];