import type { Exam } from '../types';

export const exams: Exam[] = [
  {
    id: 1,
    title: 'Computer Science Fundamentals',
    subject: 'Computer Science',
    duration: 30,
    questions: [
      {
        id: 1,
        text: 'Which data structure follows FIFO?',
        options: ['Stack', 'Queue', 'Tree', 'Graph'],
        answer: 'Queue',
      },
      {
        id: 2,
        text: 'Which language runs natively in a web browser?',
        options: ['C', 'Java', 'JavaScript', 'SQL'],
        answer: 'JavaScript',
      },
      {
        id: 3,
        text: 'What does HTTP stand for?',
        options: [
          'Hypertext Transfer Protocol',
          'High Transfer Text Program',
          'Hyper Transfer Technology Process',
          'Host Text Transfer Protocol',
        ],
        answer: 'Hypertext Transfer Protocol',
      },
    ],
  },
  {
    id: 2,
    title: 'Data Structures and Algorithms',
    subject: 'Computer Science',
    duration: 20,
    questions: [
      {
        id: 1,
        text: 'Which data structure uses LIFO?',
        options: ['Queue', 'Stack', 'Array', 'Graph'],
        answer: 'Stack',
      },
      {
        id: 2,
        text: 'What is the average time complexity of binary search?',
        options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
        answer: 'O(log n)',
      },
    ],
  },
];