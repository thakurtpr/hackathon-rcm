import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface OnboardingData {
  course: string | null;
  institution: string | null;
  year: number | null;
  lastExamScore: number | null;
  familyIncome: string | null;
  loanAmount: number | null;
  aadhaar: string | null;
  pan: string | null;
  bankAccount: { ifsc: string; accountNumber: string } | null;
  coApplicant: { name: string; income: number } | null;
}

interface OnboardingStore {
  currentStep: number;
  isComplete: boolean;
  data: OnboardingData;
  setAnswer: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void;
  nextStep: () => void;
  goToStep: (step: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const initialData: OnboardingData = {
  course: null,
  institution: null,
  year: null,
  lastExamScore: null,
  familyIncome: null,
  loanAmount: null,
  aadhaar: null,
  pan: null,
  bankAccount: null,
  coApplicant: null,
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      currentStep: 1,
      isComplete: false,
      data: initialData,
      setAnswer: (field, value) =>
        set((state) => ({
          data: {
            ...state.data,
            [field]: value,
          },
        })),
      nextStep: () =>
        set((state) => ({
          currentStep: state.currentStep + 1,
        })),
      goToStep: (step) => set({ currentStep: step }),
      completeOnboarding: () => set({ isComplete: true }),
      resetOnboarding: () =>
        set({
          currentStep: 1,
          isComplete: false,
          data: initialData,
        }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
