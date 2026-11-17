import type { QuestionType } from "~/db/schema";

// The quiz as it is being built. Ids are client-only, for keys and drag and
// drop; the saved quiz gets its own ids from the database.

export interface WizardOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface WizardQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: WizardOption[];
}

export interface WizardState {
  title: string;
  passingScore: number;
  questions: WizardQuestion[];
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
