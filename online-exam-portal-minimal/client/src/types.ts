export interface Question {
  id: number;
  text: string;
  options: string[];
  answer: string;
}

export interface Exam {
  id: number;
  title: string;
  subject: string;
  /** Time limit in minutes */
  duration: number;
  questions: Question[];
}

/** question id -> selected option */
export type Answers = Record<number, string>;