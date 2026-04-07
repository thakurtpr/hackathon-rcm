"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface PQBadgeProps {
  score: number;
  overrideApplied: boolean;
}

const PQBadge: React.FC<PQBadgeProps> = ({ score, overrideApplied }) => {
  return (
    <div
      className={cn(
        "relative rounded-2xl transition-all duration-500",
        overrideApplied
          ? "bg-gradient-to-r from-emerald-400 to-blue-500 dark:from-green-400 dark:to-blue-500 p-[2px] shadow-lg dark:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
          : "bg-gray-200 dark:bg-gray-700 p-[1px]"
      )}
    >
      <div className="flex flex-col items-center justify-center rounded-[14px] bg-white dark:bg-gray-800 p-8 text-center transition-colors">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 transition-colors">
          Potential Quotient (PQ)
        </h3>
        
        <div className="flex items-baseline gap-2">
          <span className="text-7xl font-black tracking-tighter text-gray-900 dark:text-white transition-colors">
            {score}
          </span>
          <span className="text-xl font-bold text-gray-300 dark:text-gray-500 transition-colors">
            / 100
          </span>
        </div>

        {overrideApplied && (
          <div className="mt-6 animate-bounce rounded-full bg-emerald-50 dark:bg-green-500/10 px-6 py-2 text-sm font-bold text-emerald-700 dark:text-green-400 border border-emerald-200 dark:border-green-500/20 transition-colors">
            Approved by Potential — your drive made the difference!
          </div>
        )}
      </div>
    </div>
  );
};

export default PQBadge;
