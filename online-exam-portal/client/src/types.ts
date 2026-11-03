export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Exam {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  status: ExamStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  totalMarks: number;
}

/** An exam as the administrator and teacher see it. */
export interface ExamSummary extends Exam {
  questionCount: number;
  questionMarks: number;
  submittedCount: number;
}

/** An exam as a student sees it, with their own attempt if they started it. */
export interface AvailableExam extends Exam {
  questionCount: number;
  attempt: {
    id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    expiresAt: string;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
  } | null;
}

export interface BankQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  marks: number;
  exams: { id: string; title: string }[];
}

export interface AttemptQuestion {
  id: string;
  text: string;
  marks: number;
  options: { key: OptionKey; text: string }[];
}

export interface AttemptState {
  serverTime: string;
  resumed: boolean;
  attempt: {
    id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED';
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
  };
  exam: { id: string; title: string; subject: string; durationMinutes: number; totalMarks: number };
  questions: AttemptQuestion[];
  answers: Record<string, OptionKey>;
}

export interface SubmitResult {
  attemptId: string;
  score: number;
  maxScore: number;
  percentage: number;
  answeredCount: number;
  totalQuestions: number;
  autoSubmitted: boolean;
  alreadySubmitted: boolean;
}

export interface ResultSummary {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  autoSubmitted: boolean;
  exam: { id: string; title: string; subject: string };
}

export interface ResultDetail {
  id: string;
  exam: { id: string; title: string; subject: string; endAt: string };
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  autoSubmitted: boolean;
  answersVisible: boolean;
  questions: (AttemptQuestion & {
    selectedOption: OptionKey | null;
    /** null until the exam closes */
    isCorrect: boolean | null;
    correctOption: OptionKey | null;
  })[];
}

export interface PerformanceRow extends ResultSummary {
  student: { id: string; name: string; email: string };
}

export interface ExamStatistics {
  id: string;
  title: string;
  subject: string;
  status: ExamStatus;
  startAt: string;
  endAt: string;
  submittedCount: number;
  inProgressCount: number;
  averagePercentage: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  passCount: number;
}

export interface StatisticsResponse {
  summary: {
    examCount: number;
    submittedCount: number;
    inProgressCount: number;
    averagePercentage: number | null;
    passCount: number;
  };
  exams: ExamStatistics[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { name: string; email: string; role: Role } | null;
}
