import { create } from 'zustand';

interface IntentState {
  intent: 'loan' | 'scholarship' | 'both' | null;
  setIntent: (intent: 'loan' | 'scholarship' | 'both') => void;
}

export const useIntentStore = create<IntentState>((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
}));
