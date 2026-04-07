'use client';

import React, { useRef, useEffect, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Message ScholarFlow AI...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSend();
    }
  };

  return (
    <div className="flex items-end gap-3 p-4 bg-[#0d0d14] border-t border-white/5">
      <div className="flex-1 bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 resize-none outline-none leading-relaxed disabled:opacity-50"
          style={{ maxHeight: '160px' }}
        />
      </div>
      <button
        onClick={onSend}
        disabled={!value.trim() || disabled}
        className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-indigo-500/20"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
