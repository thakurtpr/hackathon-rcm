'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Award, 
  GraduationCap, 
  BookOpen, 
  Globe,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Scholarship {
  id: string;
  name: string;
  provider: string;
  amount: string;
  match: number;
  tags: string[];
  deadline: number; // days left
  type: string;
}

// Mock Data
const MOCK_SCHOLARSHIPS: Scholarship[] = [
  {
    id: '1',
    name: 'Dr. APJ Abdul Kalam STEM Grant',
    provider: 'ISRO Foundation',
    amount: '₹50,000',
    match: 98,
    tags: ['STEM', 'Merit-based', 'Innovation'],
    deadline: 4,
    type: 'Merit'
  },
  {
    id: '2',
    name: 'Mahindra All-Rounder Scholarship',
    provider: 'Mahindra Foundation',
    amount: '₹25,000',
    match: 92,
    tags: ['Sports', 'Academic', 'Tier-2 Cities'],
    deadline: 12,
    type: 'Merit'
  },
  {
    id: '3',
    name: 'Global Indian Student Grant',
    provider: 'British Council',
    amount: '₹1,00,000',
    match: 85,
    tags: ['Study Abroad', 'STEM', 'Post-grad'],
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
  },
  {
    id: '5',
    name: 'Sustainable Future Fellowship',
    provider: 'EcoWise Group',
    amount: '₹40,000',
    match: 82,
    tags: ['Research', 'Ecology'],
    deadline: 3,
    type: 'Research'
  },
  {
    id: '6',
    name: 'Aspire Higher Arts Grant',
    provider: 'Creative Arts Alliance',
    amount: '₹30,000',
    match: 76,
    tags: ['Arts', 'Creative', 'Design'],
    deadline: 20,
    type: 'Creative'
  }
];

export default function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState<Scholarship[]>(MOCK_SCHOLARSHIPS);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate AI Analysis loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleApply = (id: string) => {
    setAppliedIds(prev => new Set(prev).add(id));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const isEmpty = scholarships.length === 0;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-8 right-8 z-[100]"
          >
            <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 text-gray-900 dark:text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl transition-colors">
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

      <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        {/* Header Section */}
        <header className="mb-20 text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
              <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-2 shadow-sm dark:shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] transition-colors">
                <Sparkles className="w-4 h-4 fill-current" />
                <span>PQ-ANALYSIS POWERED</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gray-950 dark:text-white mb-6 transition-colors">
              Scholarships <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600 dark:from-indigo-400 dark:via-blue-400 dark:to-emerald-400">Matched for You</span>
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 text-lg md:text-xl max-w-3xl leading-relaxed mx-auto md:mx-0 transition-colors">
              Our AI analyzed your academic record and Potential Quotient (PQ) to find these opportunities. 
              Higher match percentages indicate a stronger alignment with your profile.
            </p>
          </motion.div>
        </header>

        {/* AI Match Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[420px] w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-[2.5rem] relative overflow-hidden transition-colors">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-800/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center bg-gray-50 dark:bg-zinc-900/20 rounded-[3rem] border border-gray-200 dark:border-zinc-900 border-dashed transition-colors"
          >
            <div className="w-24 h-24 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mb-8 border border-gray-200 dark:border-zinc-800 transition-colors">
              <BookOpen className="w-10 h-10 text-gray-300 dark:text-zinc-700" />
            </div>
            <h3 className="text-3xl font-bold text-gray-700 dark:text-zinc-300 mb-4 transition-colors">No matches found yet</h3>
            <p className="text-gray-400 dark:text-zinc-500 max-w-sm text-lg italic transition-colors">
              "We're constantly scanning for new grants. Check back after your next semester upload!"
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {scholarships.map((scholarship, index) => (
              <ScholarshipCard 
                key={scholarship.id} 
                scholarship={scholarship} 
                index={index}
                isApplied={appliedIds.has(scholarship.id)}
                onApply={() => handleApply(scholarship.id)}
              />
            ))}
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

function ScholarshipCard({ 
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
      whileHover={{ y: -10 }}
      className="group relative h-full flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/50 rounded-[2.5rem] p-8 transition-all hover:bg-gray-50 dark:hover:bg-zinc-900/80 hover:border-indigo-600 dark:hover:border-indigo-500/40 shadow-sm hover:shadow-xl dark:shadow-none"
    >
      {/* Match Percentage Badge */}
      <div className="absolute top-6 right-6">
        <div className={cn(
          "px-4 py-2 rounded-2xl text-xs font-black tracking-widest shadow-xl flex items-center gap-2 border border-white/5 transition-colors",
          scholarship.match >= 95 
            ? "bg-gradient-to-br from-emerald-500 to-cyan-600 dark:from-emerald-400 dark:to-cyan-500 text-white dark:text-zinc-950" 
            : "bg-gray-100 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300"
        )}>
          {scholarship.match >= 90 && <Sparkles className={cn("w-3.5 h-3.5", scholarship.match >= 95 ? "fill-white dark:fill-zinc-950" : "fill-current")} />}
          {scholarship.match}% MATCH
        </div>
      </div>

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
           <div className={cn(
             "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110",
             scholarship.type === 'Merit' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-500" :
             scholarship.type === 'Research' ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-500" :
             "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-500"
           )}>
             {scholarship.type === 'Merit' ? <Award className="w-7 h-7" /> : 
              scholarship.type === 'Research' ? <Globe className="w-7 h-7" /> :
              <GraduationCap className="w-7 h-7" />}
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest leading-none mb-1 transition-colors">Provider</span>
              <span className="text-gray-600 dark:text-zinc-400 text-sm font-bold truncate max-w-[150px] transition-colors">{scholarship.provider}</span>
           </div>
        </div>

        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 leading-tight tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
          {scholarship.name}
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {scholarship.tags.map((tag) => (
            <span 
              key={tag} 
              className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest group-hover:border-gray-200 dark:group-hover:border-zinc-700 transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-8 border-t border-gray-100 dark:border-zinc-800/80 flex flex-col gap-6 transition-colors text-gray-900 dark:text-white">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest mb-1 leading-none transition-colors">Scholarship Amount</span>
            <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums bg-clip-text transition-colors">
              {scholarship.amount}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-500 border border-rose-100 dark:border-rose-500/20 text-[10px] font-black flex items-center gap-1.5 transition-colors">
            <Clock className="w-3.5 h-3.5" />
            {scholarship.deadline}D LEFT
          </div>
        </div>

        <button
          onClick={onApply}
          disabled={isApplied}
          className={cn(
            "w-full py-5 rounded-[1.25rem] font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn",
            isApplied 
              ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-default" 
              : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-[0_10px_20px_-10px_rgba(99,102,241,0.5)]"
          )}
        >
          {isApplied ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Pending</span>
            </>
          ) : (
            <>
              <span>Apply with One-Click</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
