'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FaceMatchResultProps {
  status: 'pending' | 'verifying' | 'success' | 'failed';
  score: number | null;
  onRetryAadhaar?: () => void;
  onRetrySelfie?: () => void;
}

export const FaceMatchResult = ({ status, score, onRetryAadhaar, onRetrySelfie }: FaceMatchResultProps) => {
  if (status === 'pending') return null;

  const isVerifying = status === 'verifying';
  const isSuccess = status === 'success';
  const isFailed = status === 'failed';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-500 border-2",
      isVerifying ? "border-blue-500/50 bg-blue-500/5" :
      isSuccess   ? "border-emerald-500/50 bg-emerald-500/5" :
      isFailed    ? "border-rose-500/50 bg-rose-500/5" :
                    "border-gray-800"
    )}>
      <CardContent className="p-6">
        <AnimatePresence mode="wait">

          {/* ── Verifying ── */}
          {isVerifying && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center space-y-5"
            >
              {/* Two-face comparison animation */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full bg-indigo-500/20 border-2 border-indigo-500/50 flex items-center justify-center">
                    <span className="text-xl">🪪</span>
                  </div>
                  <span className="text-xs text-indigo-300/70">Aadhaar</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-blue-400"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center">
                    <span className="text-xl">🤳</span>
                  </div>
                  <span className="text-xs text-blue-300/70">Selfie</span>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">Running Face Recognition</h3>
                <p className="text-sm text-blue-300/80 mt-1">
                  Comparing your Aadhaar photo against your selfie using biometric AI…
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {isSuccess && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="p-4 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-white">Face Match Verified</h3>
                {score != null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-3xl font-bold text-emerald-400">{score}%</span>
                      <span className="text-gray-400 text-sm">confidence</span>
                    </div>
                    <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                )}
                <p className="text-sm text-emerald-300/80">Biometric identity confirmed. You may proceed.</p>
              </div>
            </motion.div>
          )}

          {/* ── Failed ── */}
          {isFailed && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="p-4 rounded-full bg-rose-500/20 border border-rose-500/30">
                <XCircle className="w-12 h-12 text-rose-500" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-white">Face Match Failed</h3>
                <p className="text-sm text-rose-400/80">
                  The selfie did not match the photo on your Aadhaar card.
                  Please upload a clearer front-facing image.
                </p>
              </div>
              {(onRetryAadhaar || onRetrySelfie) && (
                <div className="flex gap-3 pt-1">
                  {onRetryAadhaar && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetryAadhaar}
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-upload Aadhaar
                    </Button>
                  )}
                  {onRetrySelfie && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetrySelfie}
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake Selfie
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
