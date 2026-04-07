import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const WELCOME_CONTENT = `Welcome to **ScholarFlow AI** — your guided education funding assistant.\n\nI will take you through a structured **4-step journey**:\n\n**[1/4] Profile Onboarding** — Name, qualification, target program\n**[2/4] KYC Verification** — Document checklist\n**[3/4] Behavioral Assessment** — 5-question financial profile\n**[4/4] Loan & Scholarship Matching** — Personalised offers\n\n━━━━━━━━━━━━━━━━━━━━\n\n**[Step 1/4 — Profile Setup]**\n\nLet's begin with your profile.\n\n**What is your full name?**`;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function newConversation(): Conversation {
  return {
    id: uid(),
    title: 'New Chat',
    messages: [
      {
        id: uid(),
        role: 'assistant',
        content: WELCOME_CONTENT,
        timestamp: Date.now(),
      },
    ],
    createdAt: Date.now(),
  };
}

interface ConversationStore {
  conversations: Conversation[];
  activeId: string | null;
  isTyping: boolean;

  ensureConversation: () => string;
  newChat: () => string;
  setActive: (id: string) => void;
  addMessage: (convId: string, msg: Omit<Message, 'id' | 'timestamp'>) => string;
  appendContent: (convId: string, msgId: string, chunk: string) => void;
  finalizeMessage: (convId: string, msgId: string) => void;
  setTitle: (convId: string, title: string) => void;
  setTyping: (v: boolean) => void;
  deleteConversation: (id: string) => void;
  getActive: () => Conversation | null;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      isTyping: false,

      ensureConversation: () => {
        const s = get();
        if (s.activeId && s.conversations.find((c) => c.id === s.activeId)) {
          return s.activeId;
        }
        const conv = newConversation();
        set((prev) => ({ conversations: [conv, ...prev.conversations], activeId: conv.id }));
        return conv.id;
      },

      newChat: () => {
        const conv = newConversation();
        set((prev) => ({ conversations: [conv, ...prev.conversations], activeId: conv.id }));
        return conv.id;
      },

      setActive: (id) => set({ activeId: id }),

      addMessage: (convId, msg) => {
        const id = uid();
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, { id, ...msg, timestamp: Date.now() }] }
              : c
          ),
        }));
        return id;
      },

      appendContent: (convId, msgId, chunk) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + chunk, isStreaming: true } : m
                  ),
                }
              : c
          ),
        }));
      },

      finalizeMessage: (convId, msgId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, isStreaming: false } : m
                  ),
                }
              : c
          ),
        }));
      },

      setTitle: (convId, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, title } : c
          ),
        }));
      },

      setTyping: (v) => set({ isTyping: v }),

      deleteConversation: (id) => {
        set((s) => {
          const remaining = s.conversations.filter((c) => c.id !== id);
          const activeId = s.activeId === id ? (remaining[0]?.id ?? null) : s.activeId;
          return { conversations: remaining, activeId };
        });
      },

      getActive: () => {
        const s = get();
        return s.conversations.find((c) => c.id === s.activeId) ?? null;
      },
    }),
    {
      name: 'scholarflow-conversations',
      partialize: (s) => ({
        conversations: s.conversations.slice(0, 20),
        activeId: s.activeId,
      }),
    }
  )
);
