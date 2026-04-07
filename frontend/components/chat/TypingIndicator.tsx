'use client';

import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-indigo-400 text-[9px] font-black tracking-tight">AI</span>
      </div>
      <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  );
}
