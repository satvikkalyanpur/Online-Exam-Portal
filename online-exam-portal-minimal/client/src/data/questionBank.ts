import type { Question } from '../types';

export interface BankQuestion extends Question {
  subject: string;
}

/** Starting contents of the question bank (teacher view). */
export const initialQuestionBank: BankQuestion[] = [
  {
    id: 1,
    subject: 'Computer Science',
    text: 'Which data structure follows FIFO?',
    options: ['Stack', 'Queue', 'Tree', 'Graph'],
    answer: 'Queue',
  },
  {
    id: 2,
    subject: 'Computer Science',
    text: 'Which language runs natively in a web browser?',
    options: ['C', 'Java', 'JavaScript', 'SQL'],
    answer: 'JavaScript',
  },
  {
    id: 3,
    subject: 'Computer Science',
    text: 'What does HTTP stand for?',
    options: [
      'Hypertext Transfer Protocol',
      'High Transfer Text Program',
      'Hyper Transfer Technology Process',
      'Host Text Transfer Protocol',
    ],
    answer: 'Hypertext Transfer Protocol',
  },
  {
    id: 4,
    subject: 'Computer Science',
    text: 'Which data structure uses LIFO?',
    options: ['Queue', 'Stack', 'Array', 'Graph'],
    answer: 'Stack',
  },
  {
    id: 5,
    subject: 'Computer Science',
    text: 'What is the average time complexity of binary search?',
    options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
    answer: 'O(log n)',
  },
  {
    id: 6,
    subject: 'Computer Science',
    text: 'Which SQL keyword removes rows from a table?',
    options: ['DROP', 'DELETE', 'REMOVE', 'CLEAR'],
    answer: 'DELETE',
  },
];