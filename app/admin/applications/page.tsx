'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Eye, 
  CheckCircle2, 
  Clock, 
  XCircle,
  MoreVertical,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  GraduationCap,
  Banknote,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Refactored Application Interface to focus on Command Center needs
interface Application {
  id: string;
  name: string;
  institution: string;
  pqScore: number;
  isFraudFlagged: boolean;
  amount: string;
  status: 'Action Required' | 'High Potential' | 'Pending Disbursal' | 'Standard';
}

const mockApplications: Application[] = [
  {
    id: 'APP-7241',
    name: 'Emily Chen',
    institution: 'IIT Delhi',
    pqScore: 88,
    isFraudFlagged: false,
    amount: '₹8,50,000',
    status: 'High Potential',
  },
  {
    id: 'APP-7243',
    name: 'Sarah Anderson',
    institution: 'BITS Pilani',
    pqScore: 96,
    isFraudFlagged: true,
    amount: '₹12,00,000',
    status: 'Action Required',
  },
  {
    id: 'APP-7245',
    name: 'David Thompson',
    institution: 'Stanford University',
    pqScore: 68,
    isFraudFlagged: false,
    amount: '₹45,00,000',
    status: 'Pending Disbursal',
  },
  {
    id: 'APP-7246',
    name: 'Rajan Kumar',
    institution: 'Delhi University',
    pqScore: 85,
    isFraudFlagged: true,
    amount: '₹5,00,000',
    status: 'Action Required',
  },
  {
    id: 'APP-7247',
    name: 'Priya Sharma',
    institution: 'IIM Ahmedabad',
    pqScore: 92,
    isFraudFlagged: false,
    amount: '₹15,00,000',
    status: 'High Potential',
  },
];

export default function CommandCenterQueue() {
  const router = useRouter();
  const [filter, setFilter] = useState<'All' | 'Flagged' | 'High Potential'>('All');

  const filteredApplications = mockApplications.filter((app) => {
    if (filter === 'Flagged') return app.isFraudFlagged;
    if (filter === 'High Potential') return app.pqScore > 85;
    return true;
  });

  const getAIVerdictBadge = (app: Application) => {
    if (app.isFraudFlagged) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/30 rounded-lg animate-pulse ring-4 ring-red-500/5 transition-colors">
          <ShieldAlert size={14} className="shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider">PQ {app.pqScore} / HIGH RISK</span>
        </div>
      );
    }
    
    const isHighPotential = app.pqScore > 85;
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
        isHighPotential 
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
      }`}>
        <Zap size={14} className={isHighPotential ? 'text-emerald-500 dark:text-emerald-400 fill-emerald-500/20' : 'text-indigo-500 dark:text-indigo-400'} />
        <span>PQ {app.pqScore} / {isHighPotential ? 'LOW RISK' : 'STABLE'}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* Summary Stats Card Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Action Required', value: '12', icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
          { label: 'High Potential', value: '08', icon: Zap, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Disbursal', value: '04', icon: Banknote, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl backdrop-blur-sm flex items-center justify-between group hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 shadow-sm dark:shadow-none">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1 transition-colors">{stat.label}</p>
              <h3 className={`text-3xl font-black ${stat.color} transition-colors`}>{stat.value}</h3>
            </div>
            <div className={`p-4 rounded-2xl ${stat.bg} border border-gray-100 dark:border-white/5 group-hover:scale-110 transition-all ${stat.color}`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Priority Queue Container */}
      <div className="space-y-4">
        {/* Filter Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-950 dark:text-white flex items-center gap-2 transition-colors">
              <Activity size={20} className="text-indigo-600 dark:text-indigo-500" />
              Priority Processing Queue
            </h2>
            <p className="text-gray-500 text-xs font-medium transition-colors">Auto-sorted by risk urgency and potential quotient</p>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-950 p-1 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors">
            {(['All', 'Flagged', 'High Potential'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                  filter === tab 
                  ? 'bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-lg border border-gray-200 dark:border-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* The Clean Table */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-2xl dark:shadow-none backdrop-blur-md transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 transition-colors">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-[0.2em] transition-colors">Student</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-[0.2em] text-center transition-colors">AI Verdict</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-[0.2em] text-center transition-colors">Requested</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-[0.2em] text-right transition-colors">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-900 transition-colors">
                <AnimatePresence mode='popLayout'>
                  {filteredApplications.map((app) => (
                    <motion.tr 
                      key={app.id}
                      layout 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all duration-300 group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 group-hover:border-indigo-400 transition-colors">
                            <GraduationCap size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">{app.name}</p>
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight transition-colors">{app.institution}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-8 py-6 text-center">
                        {getAIVerdictBadge(app)}
                      </td>
 
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-black text-gray-900 dark:text-gray-200 transition-colors">{app.amount}</span>
                          <span className="text-[9px] text-gray-500 dark:text-gray-600 font-bold uppercase tracking-widest transition-colors">Loan Request</span>
                        </div>
                      </td>
 
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => router.push(`/admin/applications/${app.id}`)}
                          className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/5 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl transition-all duration-300 active:scale-95"
                        >
                          Review
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredApplications.length === 0 && (
                   <tr>
                     <td colSpan={4} className="px-8 py-20 text-center text-gray-400 dark:text-gray-600 text-sm font-bold uppercase tracking-widest transition-colors">
                       No Priority Cases Detected
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
