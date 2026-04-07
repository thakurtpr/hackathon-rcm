import { create } from 'zustand';

export interface Question {
  question_id: string;
  question_text: string;
  type: 'mcq' | 'free_text';
  options: string[] | null;
}

export interface Answer {
  question_id: string;
  answer_text: string;
}

export type AssessmentStatus = 'idle' | 'loading' | 'active' | 'submitting' | 'complete';

interface AssessmentState {
  questions: Question[];
  answers: Answer[];
  currentQuestionIndex: number;
  status: AssessmentStatus;
  setQuestions: (questions: Question[]) => void;
  addAnswer: (answer: Answer) => void;
  nextQuestion: () => void;
  setStatus: (status: AssessmentStatus) => void;
  resetAssessment: () => void;
}

const initialState = {
  questions: [],
  answers: [],
  currentQuestionIndex: 0,
  status: 'idle' as AssessmentStatus,
};

export const useAssessmentStore = create<AssessmentState>((set) => ({
  ...initialState,
  setQuestions: (questions) => set({ 
    questions, 
    status: 'active' 
  }),
  addAnswer: (answer) =>
    set((state) => ({
      answers: [...state.answers, answer],
    })),
  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: state.currentQuestionIndex + 1,
    })),
  setStatus: (status) => set({ status }),
  resetAssessment: () => set(initialState),
}));
