'use client';

import React from 'react';
import ChatSidebar from './ChatSidebar';
import { Conversation } from '@/store/conversationStore';

interface ChatLayoutProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  children: React.ReactNode;
}

export default function ChatLayout({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  children,
}: ChatLayoutProps) {
  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelectConversation}
        onNew={onNewChat}
        onDelete={onDeleteConversation}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
