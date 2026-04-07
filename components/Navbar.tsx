'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, LayoutDashboard, Settings, User } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const isAdmin = session?.user?.email === 'admin@gmail.com';

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 transition-colors duration-500">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="text-xl font-bold tracking-tighter text-indigo-600 dark:text-white transition-colors">
            ScholarFlow AI
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex gap-8 items-center text-sm font-medium tracking-tight">
          <Link href="/scholarships" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
            Scholarships
          </Link>
          <Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
            Loans
          </Link>
          <Link href="#" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
            Aspirations
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                href={isAdmin ? "/admin/applications" : "/dashboard"}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
              
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-95"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden md:block text-gray-500 dark:text-gray-400 font-medium text-sm hover:text-indigo-600 dark:hover:text-white transition-colors"
                onClick={(e) => {
                  // If using NextAuth's default login, use signIn()
                  // But user asked for /login page nav too
                  // I'll keep it as a Link to /login as per their specific instruction "Actual <Link href='/login'>"
                }}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-indigo-600 px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:bg-indigo-500 transition-all scale-95 duration-200 hover:scale-100 shadow-xl shadow-indigo-500/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
