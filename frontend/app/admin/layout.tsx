'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, GraduationCap, LogOut, Search, Bell } from 'lucide-react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';

const navItems = [
  { name: 'College Stats', href: '/admin/colleges', icon: GraduationCap },
  { name: 'Applications Queue', href: '/admin/applications', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Login page renders standalone — no sidebar, no auth guard
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleSignOut = () => {
    sessionStorage.removeItem('admin_token');
    router.replace('/admin/login');
  };

  return (
    <AdminProtectedRoute>
      <div className="flex h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500/30 selection:text-indigo-200">

        {/* Sidebar */}
        <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0 z-10">
          <div className="p-8">
            <Link href="/admin/colleges" className="flex items-center gap-3 transition-transform hover:scale-105">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
                <LayoutDashboard size={22} className="text-white" />
              </div>
              <span className="text-xl font-black tracking-tighter text-white">
                ADMIN<span className="text-indigo-400">.</span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 border active:scale-95 ${
                    active
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-inner'
                      : 'hover:bg-gray-900/80 text-gray-400 hover:text-indigo-400 border-transparent hover:border-white/5'
                  }`}
                >
                  <item.icon
                    size={18}
                    className={active ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-gray-500'}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 mt-auto border-t border-gray-800">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
            >
              <div className="p-2 rounded-lg bg-gray-900 group-hover:bg-red-500/10 transition-colors">
                <LogOut size={16} />
              </div>
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="h-16 border-b border-gray-800 bg-gray-950/30 backdrop-blur-md flex items-center justify-between px-8 z-0 shrink-0">
            <div className="flex items-center gap-2 text-gray-400 px-3 py-1.5 bg-gray-900/50 rounded-lg border border-gray-800 focus-within:border-indigo-500/50 transition-all w-80">
              <Search size={16} className="text-gray-500 shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm w-full font-medium placeholder-gray-600"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
                <Bell size={18} className="text-gray-400" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-gray-950" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 ring-2 ring-indigo-500/20 flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/10 cursor-pointer">
                AM
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-gray-900">
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
