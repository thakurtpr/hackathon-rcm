'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useConversationStore } from '@/store/conversationStore';
import { sendChatStream } from '@/lib/api';
import ChatLayout from '@/components/chat/ChatLayout';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator from '@/components/chat/TypingIndicator';

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, user, logout } = useAuthStore();
  const {
    conversations,
    activeId,
    isTyping,
    ensureConversation,
    newChat,
    setActive,
    addMessage,
    appendContent,
    finalizeMessage,
    setTitle,
    setTyping,
    deleteConversation,
  } = useConversationStore();

  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiMsgIdRef = useRef<string | null>(null);

  // Auth guard
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated || !accessToken) {
      router.replace('/login');
    }
  }, [isAuthenticated, accessToken, router]);

  // Ensure a conversation exists
  useEffect(() => {
    if (mounted && isAuthenticated) {
      ensureConversation();
    }
  }, [mounted, isAuthenticated, ensureConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations, isTyping, activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const convId = activeId ?? ensureConversation();
    setInput('');

    // Add user message
    addMessage(convId, { role: 'user', content: text });

    // Auto-title: first user message = their name (Q1 answer) → use as title
    const conv = conversations.find((c) => c.id === convId);
    const userMsgCount = conv?.messages.filter((m) => m.role === 'user').length ?? 0;
    if (userMsgCount === 0) {
      // First message is likely the user's name from onboarding Q1
      const titleText = text.length > 28 ? text.slice(0, 28) + '…' : text;
      setTitle(convId, `Onboarding — ${titleText}`);
    }

    setTyping(true);
    aiMsgIdRef.current = null;

    sendChatStream(
      text,
      convId,
      (chunk) => {
        if (!aiMsgIdRef.current) {
          // First chunk — create the AI message bubble now
          aiMsgIdRef.current = addMessage(convId, { role: 'assistant', content: chunk, isStreaming: true });
        } else {
          appendContent(convId, aiMsgIdRef.current, chunk);
        }
      },
      () => {
        if (aiMsgIdRef.current) finalizeMessage(convId, aiMsgIdRef.current);
        setTyping(false);
      },
      () => {
        const errText = "I'm unable to connect right now. Please check your connection and try again.";
        if (aiMsgIdRef.current) {
          appendContent(convId, aiMsgIdRef.current, errText);
          finalizeMessage(convId, aiMsgIdRef.current);
        } else {
          addMessage(convId, { role: 'assistant', content: errText });
        }
        setTyping(false);
      }
    );
  };

  if (!mounted || !isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
        <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <ChatLayout
      conversations={conversations}
      activeId={activeId}
      onSelectConversation={setActive}
      onNewChat={newChat}
      onDeleteConversation={deleteConversation}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-white">
            {activeConversation?.title || 'ScholarFlow AI'}
          </p>
          <p className="text-[10px] text-indigo-400/80 uppercase tracking-wider font-semibold">
            AI Financial Advisor
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.name && (
            <span className="text-xs text-gray-500 hidden sm:block">{user.name}</span>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
            title="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 space-y-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        {!activeConversation ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <span className="text-indigo-400 font-black text-lg">AI</span>
            </div>
            <p className="text-gray-400 text-sm">Start a conversation below</p>
          </div>
        ) : (
          activeConversation.messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        {isTyping && <TypingIndicator />}
        <div className="h-2" />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isTyping}
        placeholder="Ask about loans, scholarships, KYC, or anything else…"
      />
    </ChatLayout>
  );
}
