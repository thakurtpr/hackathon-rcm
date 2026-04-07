'use client';

import React from 'react';
import { Message } from '@/store/conversationStore';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// Match [Step X/4 — Phase Name] pattern
const STEP_RE = /^\[Step\s+(\d+)\/4\s*[—–-]\s*(.+?)\]$/;
// Match ━━━ divider
const DIVIDER_RE = /^━+$/;

function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="space-y-1 my-1 pl-1">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    // Step indicator badge
    const stepMatch = line.match(STEP_RE);
    if (stepMatch) {
      flushList();
      nodes.push(
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Step {stepMatch[1]}/4 — {stepMatch[2]}
          </span>
        </div>
      );
      return;
    }

    // Divider line
    if (DIVIDER_RE.test(line)) {
      flushList();
      nodes.push(<div key={i} className="border-t border-white/10 my-2" />);
      return;
    }

    const isBullet = line.startsWith('• ') || line.startsWith('- ');
    if (isBullet) {
      listItems.push(
        <li key={i} className="flex items-start gap-2">
          <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
          <span>{renderInline(line.replace(/^[•\-]\s/, ''))}</span>
        </li>
      );
    } else {
      flushList();
      if (line === '') {
        nodes.push(<div key={i} className="h-1.5" />);
      } else {
        nodes.push(<p key={i}>{renderInline(line)}</p>);
      }
    }
  });

  flushList();
  return nodes;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed shadow-lg shadow-indigo-500/10">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-indigo-400 text-[9px] font-black tracking-tight">AI</span>
      </div>
      <div
        className={`max-w-[80%] bg-white/[0.05] border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed text-gray-200 ${
          message.isStreaming ? 'after:content-["▋"] after:animate-pulse after:text-indigo-400 after:ml-0.5' : ''
        }`}
      >
        {renderContent(message.content)}
      </div>
    </div>
  );
}
