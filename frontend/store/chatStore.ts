import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

interface ChatStore {
  isOpen: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  toggleChat: () => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  setTyping: (status: boolean) => void;
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
}));
