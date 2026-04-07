'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  GraduationCap, 
  ChevronRight, 
  TrendingUp, 
  IndianRupee, 
  Clock, 
  ExternalLink,
  Search,
  Bell,
  User,
  LayoutDashboard,
  Sparkles,
  Award,
  Globe,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Scholarship {
  id: string;
  name: string;
  provider: string;
  amount: string;
  match: number;
  tags: string[];
  deadline: number;
  type: string;
}

const MOCK_SCHOLARSHIPS: Scholarship[] = [
  {
    id: '1',
    name: 'Dr. APJ Abdul Kalam STEM Grant',
    provider: 'ISRO Foundation',
    amount: '₹50,000',
    match: 98,
    tags: ['STEM', 'Merit-based'],
    deadline: 4,
    type: 'Merit'
  },
  {
    id: '2',
    name: 'Mahindra All-Rounder Scholarship',
    provider: 'Mahindra Foundation',
    amount: '₹25,000',
    match: 92,
    tags: ['Sports', 'Academic'],
    deadline: 12,
    type: 'Merit'
  },
  {
    id: '3',
    name: 'Global Indian Student Grant',
    provider: 'British Council',
    amount: '₹1,00,000',
    match: 85,
    tags: ['Study Abroad', 'STEM'],
    deadline: 7,
    type: 'Inclusion'
  },
  {
    id: '4',
    name: 'HDFC Badhte Kadam Grant',
    provider: 'HDFC Bank',
    amount: '₹15,000',
    match: 88,
    tags: ['Academic', 'First-gen'],
    deadline: 15,
    type: 'Merit'
  }
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'scholarships'>('overview');
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);

  const handleApply = (id: string) => {
    setAppliedIds(prev => new Set(prev).add(id));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const timelineSteps = [
    { 
      semester: "Semester 1", 
      status: "Completed", 
      amount: "₹62,500", 
      date: "Paid on Aug 15, 2025",
      type: "completed" 
    },
    { 
      semester: "Semester 2", 
      status: "Current - Awaiting Marksheet", 
      amount: "₹62,500", 
      date: "Due by Jan 20, 2026",
      type: "current" 
    },
    { 
      semester: "Semester 3", 
      status: "Locked", 
      amount: "₹62,500", 
      date: "Tentative Aug 2026",
      type: "locked" 
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-8 right-8 z-[100]"
          >
            <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 text-gray-900 dark:text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
              <div className="bg-emerald-500/20 p-1.5 rounded-full ring-1 ring-emerald-500/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-sm tracking-tight text-gray-900 dark:text-white">Application Sent!</p>
                <p className="text-gray-500 dark:text-zinc-400 text-xs">Using your verified KYC data.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-white dark:to-gray-400 transition-colors">Portal</span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 transition-colors">
                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input type="text" placeholder="Search..." className="bg-transparent border-none focus:ring-0 text-sm w-32 outline-none text-gray-900 dark:text-white" />
             </div>
             <ThemeToggle />
             <button className="p-2 text-gray-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-950"></span>
             </button>
             <div className="w-9 h-9 rounded-full bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center transition-colors">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Header Section with Tab Switcher */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2 transition-colors">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Student</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium transition-colors">
              {activeTab === 'overview' 
                ? "You're currently in your 2nd Semester. Everything looks on track for your next disbursal."
                : "Our AI matched your academic profile with global scholarship opportunities."}
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-900/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 flex self-start md:self-auto transition-colors">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'overview' 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              My Loan
            </button>
            <button
              onClick={() => setActiveTab('scholarships')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'scholarships' 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              <GraduationCap className="w-4 h-4" />
              Scholarships
            </button>
          </div>
        </header>

        {activeTab === 'overview' ? (
          /* OVERVIEW TAB CONTENT */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Loan Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-2xl dark:shadow-none relative overflow-hidden group transition-colors">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                      <IndianRupee className="w-48 h-48 -rotate-12 text-indigo-600 dark:text-white" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-6 transition-colors">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">Loan Performance Overview</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-sm font-semibold mb-1">Total Approved</p>
                          <p className="text-4xl font-black text-gray-900 dark:text-white transition-colors">₹5,00,000</p>
                        </div>
                        <div className="border-l-0 md:border-l border-gray-200 dark:border-gray-800 md:pl-8 transition-colors">
                          <p className="text-gray-400 dark:text-gray-500 text-sm font-semibold mb-1">Disbursed So Far</p>
                          <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 transition-colors">₹62,500</p>
                        </div>
                        <div className="border-l-0 md:border-l border-gray-200 dark:border-gray-800 md:pl-8 transition-colors">
                          <p className="text-gray-400 dark:text-gray-500 text-sm font-semibold mb-1">Remaining</p>
                          <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 transition-colors">₹4,37,500</p>
                        </div>
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 transition-colors">
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-2 transition-colors">
                            <span>Disbursal Progress</span>
                            <span>12.5%</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden transition-colors">
                            <div className="h-full bg-emerald-500 w-[12.5%] rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                        </div>
                      </div>
                    </div>
                </div>
              </div>

              {/* Disbursal Timeline */}
              <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-none transition-colors">
                <CardHeader className="border-b border-gray-200 dark:border-gray-800 px-8 py-6">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Disbursal Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="relative space-y-12">
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-800 transition-colors" />
                    
                    {timelineSteps.map((step, idx) => (
                      <div key={idx} className="relative flex gap-8 group">
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-gray-50 dark:border-gray-900 shadow-xl transition-colors ${
                          step.type === 'completed' ? 'bg-emerald-500 text-white' : 
                          step.type === 'current' ? 'bg-amber-500 text-white animate-pulse' : 
                          'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                        }`}>
                          {step.type === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                           step.type === 'current' ? <AlertCircle className="w-5 h-5" /> : 
                           <Lock className="w-5 h-5" />}
                        </div>

                        <div className="flex-1 pb-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                            <h4 className={`text-lg font-bold transition-colors ${
                              step.type === 'locked' ? 'text-gray-300 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                            }`}>{step.semester}</h4>
                            <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full transition-colors ${
                               step.type === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 
                               step.type === 'current' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 
                               'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                            }`}>
                              {step.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-2xl font-black text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                             <IndianRupee className="w-5 h-5" />
                             {step.amount}
                          </div>
                          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium transition-colors">{step.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              {/* ACTION REQUIRED Card */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/30 rounded-3xl p-8 relative overflow-hidden group transition-colors shadow-sm dark:shadow-none">
                <div className="absolute top-0 right-0 p-4 opacity-10 font-bold">
                    <AlertCircle className="w-20 h-20 text-amber-600 dark:text-amber-500 rotate-12" />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-4 transition-colors">
                      <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-500 animate-ping" />
                      <span className="text-xs font-black uppercase tracking-widest">Immediate Action Required</span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 transition-colors">Semester 2 Verification</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 transition-colors">
                      Upload your Semester 1 marksheet to unlock your next disbursal of <span className="text-gray-900 dark:text-white font-bold">₹62,500</span>.
                    </p>
                    
                    <Button 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-black py-6 rounded-2xl shadow-lg transition-all"
                    >
                      Upload Marksheet
                    </Button>
                </div>
              </div>

              {/* Quick Scholarship Matches */}
              <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-none transition-colors">
                 <CardHeader className="px-6 py-6 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <CardTitle className="text-lg font-bold flex items-center justify-between text-gray-900 dark:text-white transition-colors">
                      <span className="flex items-center gap-2">
                         <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                         AI Match Prep
                      </span>
                      <button onClick={() => setActiveTab('scholarships')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">See all</button>
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    <div className="space-y-4">
                       {MOCK_SCHOLARSHIPS.slice(0, 2).map(scholarship => (
                          <div key={scholarship.id} className="p-4 rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/30 dark:hover:border-gray-700 transition-all group shadow-sm dark:shadow-none">
                             <div className="flex justify-between items-start mb-2">
                                <h5 className="font-bold text-sm text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[150px]">{scholarship.name}</h5>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 opacity-80">{scholarship.match}% Match</span>
                             </div>
                             <div className="flex items-center justify-between">
                                <p className="text-lg font-black text-gray-900 dark:text-white transition-colors">{scholarship.amount}</p>
                                <button onClick={() => setActiveTab('scholarships')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all">
                                   Apply <ChevronRight className="w-3 h-3" />
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* SCHOLARSHIPS TAB CONTENT */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {MOCK_SCHOLARSHIPS.map((scholarship, index) => (
                  <ScholarshipItem 
                    key={scholarship.id} 
                    scholarship={scholarship} 
                    index={index}
                    isApplied={appliedIds.has(scholarship.id)}
                    onApply={() => handleApply(scholarship.id)}
                  />
                ))}
             </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function ScholarshipItem({ 
  scholarship, 
  index, 
  isApplied, 
  onApply 
}: { 
  scholarship: Scholarship, 
  index: number,
  isApplied: boolean,
  onApply: () => void 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: "easeOut" }}
      className="group relative h-full flex flex-col bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800/50 rounded-[2.5rem] p-8 transition-all hover:bg-white dark:hover:bg-gray-900/80 hover:border-indigo-500/40 hover:shadow-2xl shadow-sm dark:shadow-none"
    >
      <div className="absolute top-6 right-6">
        <div className={cn(
          "px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 border border-gray-100 dark:border-white/5 shadow-sm transition-colors",
          scholarship.match >= 95 
            ? "bg-gradient-to-br from-emerald-500 to-cyan-600 dark:from-emerald-400 dark:to-cyan-500 text-white dark:text-zinc-950" 
            : "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300"
        )}>
          {scholarship.match >= 90 && <Sparkles className={cn("w-3.5 h-3.5", scholarship.match >= 95 ? "fill-white dark:fill-zinc-950" : "fill-current")} />}
          {scholarship.match}% MATCH
        </div>
      </div>

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
           <div className={cn(
             "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110",
             scholarship.type === 'Merit' ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-50" :
             scholarship.type === 'Research' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400" :
             "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
           )}>
             {scholarship.type === 'Merit' ? <Award className="w-7 h-7" /> : 
              scholarship.type === 'Research' ? <Globe className="w-7 h-7" /> :
              <GraduationCap className="w-7 h-7" />}
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-1 leading-none transition-colors">Provider</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm font-bold truncate max-w-[150px] transition-colors">{scholarship.provider}</span>
           </div>
        </div>

        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3 leading-tight tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
          {scholarship.name}
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {scholarship.tags.map((tag) => (
            <span 
              key={tag} 
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-8 border-t border-gray-200 dark:border-gray-800/80 flex flex-col gap-6 transition-colors">
        <div className="flex items-end justify-between">
          <div className="flex flex-col text-[#1e2330] dark:text-white">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-1 leading-none text-xs transition-colors">Amount</span>
            <span className="text-3xl font-black tracking-tighter tabular-nums transition-colors">
              {scholarship.amount}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black flex items-center gap-1.5 transition-colors">
            <Clock className="w-3.5 h-3.5" />
            {scholarship.deadline}D LEFT
          </div>
        </div>

        <button
          onClick={onApply}
          disabled={isApplied}
          className={cn(
            "w-full py-4 rounded-[1.25rem] font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 relative overflow-hidden",
            isApplied 
              ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-default" 
              : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/20"
          )}
        >
          {isApplied ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span>Pending</span>
            </>
          ) : (
            <>
              <span>Apply with One-Click</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
