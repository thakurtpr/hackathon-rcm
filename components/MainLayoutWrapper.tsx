'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ChatWidget from './ChatWidget';
import { cn } from '@/lib/utils';

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Route groups where the Student Sidebar should be visible
  const showSidebarOn = ['/dashboard', '/scholarships', '/profile', '/settings'];
  const hasSidebar = showSidebarOn.some(route => pathname.startsWith(route));

  // Skip the wrapper's margin for Admin because AdminLayout has its own Sidebar
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen relative w-full overflow-x-hidden transition-colors duration-500">
      {!isAdmin && <Sidebar />}
      
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen w-full",
        hasSidebar && !isAdmin ? "md:ml-64 bg-slate-50/50 dark:bg-transparent" : ""
      )}>
        {children}
      </main>
      
      {!isAdmin && <ChatWidget />}
    </div>
  );
}
