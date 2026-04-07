'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Users, 
  ShieldAlert, 
  Banknote, 
  TrendingUp, 
  ArrowRight, 
  Activity,
  Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const stats = [
    { 
      label: 'Total Applications', 
      value: '124', 
      icon: Users, 
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-500/10'
    },
    { 
      label: 'Flagged for Fraud', 
      value: '8', 
      icon: ShieldAlert, 
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10'
    },
    { 
      label: 'Total Disbursed', 
      value: '₹1.2 Cr', 
      icon: Banknote, 
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10'
    },
  ];

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Welcome, <span className="text-indigo-600 dark:text-indigo-400">Admin</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium italic">
            Monitor and manage student funding requests across the platform.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Systems Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group p-8 rounded-[2.5rem] bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500"
          >
            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
              <stat.icon size={28} />
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
            <h3 className={`text-4xl font-black ${stat.color} tracking-tight`}>{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-colors">
            <Activity size={20} className="text-indigo-500" />
            Quick Actions
          </h3>
          <div className="bg-white dark:bg-gray-950 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm group transition-all">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Priority Processing</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed">
              We have detected 4 new high-potential applications that require immediate review for the upcoming academic cycle.
            </p>
            <Link 
              href="/admin/applications"
              className="w-full py-5 bg-gray-950 dark:bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-800 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 group"
            >
              View Full Application Queue
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="lg:col-span-7 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 transition-colors">
            <TrendingUp size={20} className="text-indigo-500" />
            Application Trends (Last 7 Days)
          </h3>
          <div className="h-[280px] bg-gray-50 dark:bg-gray-950 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-4 transition-colors">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 transition-colors">
              <Layers size={32} />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest opacity-50">Chart Visualization Placeholder</p>
          </div>
        </div>
      </div>
      
      {/* Decorative Background Glob */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
