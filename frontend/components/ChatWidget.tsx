'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { sendChatMessage } from '@/lib/api';

export default function ChatWidget() {
  const { 
    isOpen, 
    messages, 
    isTyping, 
    toggleChat, 
    addMessage, 
    setTyping 
  } = useChatStore();
  
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    addMessage({ sender: 'user', text: userText });
    setInputValue('');
    setTyping(true);

    try {
      const sessionId = typeof window !== 'undefined' ? sessionStorage.getItem('chat_session') ?? undefined : undefined;
      const response = await sendChatMessage(userText, sessionId);
      const reply = response?.response || response?.message || "I can help you with your loan status, disbursal schedule, scholarship matches, and more.";
      addMessage({ sender: 'bot', text: reply });
      if (response?.session_id && typeof window !== 'undefined') {
        sessionStorage.setItem('chat_session', response.session_id);
      }
    } catch {
      addMessage({
        sender: 'bot',
        text: 'I apologize, I am temporarily unavailable. Please try again or contact support.',
      });
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <button 
              onClick={toggleChat}
              className="hover:bg-gray-700 p-1 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent bg-[#0b0f1a]"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                  msg.sender === 'user' 
                    ? "bg-blue-600 text-white ml-auto rounded-tr-none shadow-md" 
                    : "bg-gray-800 text-gray-200 mr-auto rounded-tl-none border border-gray-700"
                )}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1 items-center px-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 animate-pulse">
                  AI is typing...
                </span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
            />
            <button 
              onClick={handleSendMessage}
              className="bg-blue-600 p-2 rounded-xl text-white hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-500/20"
              disabled={!inputValue.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button 
        onClick={toggleChat}
        className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-90 transition-all duration-300 ring-4 ring-black/10 group"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
        ) : (
          <MessageCircle className="w-6 h-6 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
