import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, LogOut, Search, Bell } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    { name: 'Applications Queue', href: '/admin/applications', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0 z-10 transition-all duration-300">
        <div className="p-8">
          <Link href="/admin" className="flex items-center gap-3 transition-transform hover:scale-105">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <LayoutDashboard size={22} className="text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">
              ADMIN<span className="text-indigo-400">.</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 hover:bg-gray-900/80 group hover:text-indigo-400 hover:shadow-inner border border-transparent hover:border-white/5 active:scale-95"
            >
              <item.icon size={18} className="text-gray-400 group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.5)] transition-all" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-gray-800 bg-gray-950/50 backdrop-blur-sm">
          <Link
            href="/login"
            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
          >
            <div className="p-2 rounded-lg bg-gray-900 group-hover:bg-red-500/10 transition-colors">
              <LogOut size={16} />
            </div>
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-gray-800 bg-gray-950/30 backdrop-blur-md flex items-center justify-between px-8 z-0">
          <div className="flex items-center gap-2 text-gray-400 px-3 py-1.5 bg-gray-900/50 rounded-lg border border-gray-800 focus-within:border-indigo-500/50 transition-all w-96 max-w-full">
            <Search size={16} className="text-gray-500" />
            <input type="text" placeholder="Global search..." className="bg-transparent border-none outline-none text-sm w-full font-medium" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center relative cursor-pointer hover:bg-gray-700 transition-colors">
              <Bell size={20} className="text-gray-400" />
              <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-950 animate-pulse"></div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 ring-2 ring-indigo-500/20 group cursor-pointer overflow-hidden shadow-lg shadow-indigo-500/10">
               <div className="w-full h-full flex items-center justify-center font-bold text-sm">AM</div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 scrollbar-thin scrollbar-track-gray-950 scrollbar-thumb-gray-800">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
