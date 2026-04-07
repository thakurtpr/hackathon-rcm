'use client';

import React from 'react';
import { Plus, Trash2, MessageSquare, Brain } from 'lucide-react';
import { Conversation } from '@/store/conversationStore';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function timeLabel(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ChatSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0d0d14] border-r border-white/5 flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-white/5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm">
          <span className="text-white">Scholar</span>
          <span className="text-indigo-400">Flow</span>
        </span>
      </div>

      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/10 text-gray-400 hover:text-white transition-all text-sm font-medium group"
        >
          <Plus className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600">No conversations yet</p>
          </div>
        )}
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              className={`group relative flex items-center rounded-xl cursor-pointer transition-all ${
                isActive
                  ? 'bg-indigo-500/15 border border-indigo-500/20'
                  : 'hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <button
                className="flex-1 text-left px-3 py-2.5 min-w-0"
                onClick={() => onSelect(conv.id)}
              >
                <p
                  className={`text-sm truncate font-medium ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'
                  }`}
                >
                  {conv.title}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">{timeLabel(conv.createdAt)}</p>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-2 mr-1 rounded-lg hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5">
        <p className="text-[10px] text-gray-700 text-center font-medium uppercase tracking-wider">
          ScholarFlow AI · India&apos;s Funding Engine
        </p>
      </div>
    </aside>
  );
}
