import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

// Known conversation stages returned by the AI service stage machine.
export type ConversationStage =
  | 'GREETING'
  | 'INTENT'
  | 'PROFILE_COLLECTION'
  | 'KYC_GUIDANCE'
  | 'BEHAVIORAL_ASSESSMENT'
  | 'AWAITING_RESULTS'
  | 'RESULT_EXPLANATION'
  | 'POST_APPROVAL'
  | null;

interface ChatStore {
  isOpen: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  /** The current conversation stage reported by the AI service. */
  currentStage: ConversationStage;
  toggleChat: () => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  setTyping: (status: boolean) => void;
  /** Update the current conversation stage from the AI service response. */
  setCurrentStage: (stage: ConversationStage) => void;
}

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    sender: 'bot',
    text: 'Hi! I am your AI financial advisor. How can I help you today?',
  },
];

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  isTyping: false,
  messages: initialMessages,
  currentStage: null,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Math.random().toString(36).substring(7),
        },
      ],
    })),
  setTyping: (status) => set({ isTyping: status }),
  setCurrentStage: (stage) => set({ currentStage: stage }),
}));
