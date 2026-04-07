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
        "relative rounded-xl transition-all duration-500",
        overrideApplied
          ? "bg-gradient-to-r from-green-400 to-blue-500 p-[2px] shadow-[0_0_20px_rgba(34,197,94,0.3)]"
          : "bg-gray-700 p-[1px]"
      )}
    >
      <div className="flex flex-col items-center justify-center rounded-xl bg-gray-800 p-6 text-center">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-gray-400">
          Potential Quotient (PQ)
        </h3>
        
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-extrabold tracking-tighter text-white">
            {score}
          </span>
          <span className="text-xl font-medium text-gray-500">
            / 100
          </span>
        </div>

        {overrideApplied && (
          <div className="mt-4 animate-bounce rounded-full bg-green-500/10 px-4 py-1 text-sm font-semibold text-green-400 border border-green-500/20">
            Approved by Potential — your drive made the difference!
          </div>
        )}
      </div>
    </div>
  );
};

export default PQBadge;
