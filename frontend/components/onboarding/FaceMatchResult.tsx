'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FaceMatchResultProps {
  status: 'pending' | 'verifying' | 'success' | 'failed';
  score: number | null;
}

export const FaceMatchResult = ({ status, score }: FaceMatchResultProps) => {
  if (status === 'pending') return null;

  const isVerifying = status === 'verifying';
  const isSuccess = status === 'success';
  const isFailed = status === 'failed';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-500 border-2",
      isVerifying ? "border-blue-500/50 bg-blue-500/5" :
      isSuccess ? "border-emerald-500/50 bg-emerald-500/5" :
      isFailed ? "border-rose-500/50 bg-rose-500/5" :
      "border-gray-800"
    )}>
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          {isVerifying ? (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                <UserCheck className="w-6 h-6 text-blue-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">Verifying Face Match</h3>
                <p className="text-sm text-blue-300/80">Comparing your selfie with Aadhaar photo...</p>
              </div>
            </motion.div>
          ) : isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="p-4 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">Face Match Success</h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-emerald-400">{score}%</span>
                  <span className="text-gray-400 text-sm">confidence score</span>
                </div>
                <p className="mt-2 text-sm text-emerald-300/80">Biological identity verification completed.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="failed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/30">
                <XCircle className="w-12 h-12 text-rose-500" />
              </div>
              <div className="text-center">
               <h3 className="text-lg font-semibold text-white">Face Match Failed</h3>
               <p className="text-sm text-rose-400/80">Low similarity detected. Please try uploading a clearer selfie.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
