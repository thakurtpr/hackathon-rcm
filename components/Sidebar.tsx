'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  GraduationCap, 
  User, 
  Settings, 
  LogOut,
  Sparkles,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { ThemeToggle } from './ThemeToggle';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Scholarships', href: '/scholarships', icon: GraduationCap },
  { name: 'My Profile', href: '/profile', icon: User },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar on landing, login, register, onboarding, assessment, and status pages
  const hideOn = ['/', '/login', '/register', '/onboarding', '/assessment', '/application/status', '/application/result'];
  if (hideOn.includes(pathname) || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 transition-colors duration-500">
      <div className="p-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center transition-transform group-hover:scale-110">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tighter text-gray-900 dark:text-white">ScholarFlow</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 py-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group active:scale-95",
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <item.icon size={18} className={cn("transition-colors", isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Theme</span>
            <ThemeToggle />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all active:scale-95"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
