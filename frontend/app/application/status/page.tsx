'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, Loader2, Signal, WifiOff } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { useApplicationStatusSocket } from '@/hooks/useApplicationStatusSocket';

// Map backend pipeline stage keys → frontend store IDs
const STAGE_KEY_MAP: Record<string, string> = {
  kyc: 'verified',
  behavioral: 'assessment',
  fraud: 'fraud',
  eligibility: 'eligibility',
  decision: 'decision',
  scholarship: 'decision', // scholarship completion feeds into final decision
};

// Reusable PipelineStage component
const PipelineStage = ({ 
  name, 
  status, 
  isLast,
  isActive
}: { 
  name: string; 
  status: 'pending' | 'done' | 'failed' | 'flagged'; 
  isLast?: boolean;
  isActive?: boolean;
}) => {
  const getIcon = () => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-6 h-6 text-green-400" />;
      case 'failed':
      case 'flagged':
        return <AlertCircle className="w-6 h-6 text-amber-500" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-gray-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-500" />;
    }
  };

  const isCompleted = status === 'done';

  return (
    <div className="relative flex items-start gap-4 pb-8">
      {/* Vertical line between steps */}
      {!isLast && (
        <div 
          className={`absolute left-[11px] top-7 w-[2px] h-full ${
            isCompleted ? 'bg-green-400' : 'bg-gray-700'
          }`}
        />
      )}
      
      {/* Icon container */}
      <div className="relative z-10 flex items-center justify-center w-6 h-6">
        {isActive ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-4 h-4 rounded-full bg-blue-500/30 animate-ping" />
            <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
        ) : (
          getIcon()
        )}
      </div>

      {/* Stage detail */}
      <div className="flex flex-col">
        <span 
          className={`text-lg font-medium transition-colors duration-300 ${
            isCompleted ? 'text-white' : isActive ? 'text-blue-300' : 'text-gray-400'
          }`}
        >
          {name}
        </span>
        {isActive && (
          <span className="text-sm text-blue-400 font-medium animate-pulse mt-0.5">
            Processing...
          </span>
        )}
        {status === 'done' && (
          <span className="text-sm text-green-400 font-medium mt-0.5">Complete</span>
        )}
        {status === 'flagged' && (
          <span className="text-sm text-amber-400 font-medium mt-0.5">Requires review</span>
        )}
      </div>
    </div>
  );
};

export default function StatusPage() {
  const router = useRouter();
  const { pipelineStages, webSocketStatus, updateStageStatus, applicationId } = useApplicationStore();
  const navigatedRef = useRef(false);

  // Connect to real WebSocket — hook auto-connects when applicationId is set
  useApplicationStatusSocket(applicationId);
  
  // Find the first pending stage to mark it as active
  const firstPendingId = pipelineStages.find(s => s.status === 'pending')?.id;
  const allComplete = pipelineStages.every(s => s.status === 'done' || s.status === 'flagged');
  const decisionStage = pipelineStages.find(s => s.id === 'decision');

  // No-op: stage key mapping reference for debugging, safely attached to globalThis
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__stageKeyMap = STAGE_KEY_MAP;
    } catch { /* ignore */ }
    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).__stageKeyMap;
      } catch { /* ignore */ }
    };
  }, []);

  // ── Polling fallback: GET /applications/:id/status every 10s ─────────
  // This runs in parallel to WS — ensures data consistency even if WS drops.
  useEffect(() => {
    if (!applicationId) {
      // No app ID — user may have navigated directly. Redirect them.
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('app_id') : null;
      if (!stored) {
        router.replace('/application');
        return;
      }
    }

    const interval = setInterval(async () => {
      try {
        const id = applicationId || sessionStorage.getItem('app_id');
        if (!id) return;
        const res = await fetch(`/api/backend/applications/${id}/status`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access_token') ?? ''}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json() as { status: string; pipeline_stages: Record<string, string> };
        
        // Update stages from pipeline_stages map
        if (data.pipeline_stages) {
          Object.entries(data.pipeline_stages).forEach(([key, val]) => {
            const storeId = STAGE_KEY_MAP[key] ?? key;
            if (val === 'completed' || val === '"completed"') {
              updateStageStatus(storeId, 'done');
            } else if (val === 'flagged' || val === '"flagged"') {
              updateStageStatus(storeId, 'flagged');
            }
          });
        }

        // Map top-level status → decision stage
        if (data.status === 'approved' || data.status === 'rejected') {
          updateStageStatus('eligibility', 'done');
          updateStageStatus('decision', 'done');
        }
      } catch {
        // silently swallow
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [applicationId, updateStageStatus, router]);

  // ── Navigate to result when all stages complete ───────────────────────
  useEffect(() => {
    if (allComplete && decisionStage?.status === 'done' && !navigatedRef.current) {
      navigatedRef.current = true;
      const timer = setTimeout(() => {
        router.push('/application/result');
      }, 1500); // Brief pause so user sees all stages green
      return () => clearTimeout(timer);
    }
  }, [allComplete, decisionStage?.status, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center py-16 px-4">
      {/* Top right live indicator */}
      <div className="fixed top-8 right-8 flex items-center gap-2 bg-gray-800/80 backdrop-blur-md px-4 py-2 rounded-full border border-gray-700 shadow-xl z-50">
        {webSocketStatus === 'connected' ? (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
            <Signal className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-200">Live</span>
          </>
        ) : webSocketStatus === 'connecting' ? (
          <>
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-sm font-medium text-gray-400">Connecting...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-500">Polling</span>
          </>
        )}
      </div>

      <div className="max-w-xl w-full">
        {/* Header Section */}
        <header className="mb-14 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">
            Tracking Your Application
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-light max-w-md mx-auto">
            Your application is being processed by our AI engine. This usually takes 2–4 minutes.
          </p>
          {applicationId && (
            <p className="mt-3 text-xs font-mono text-gray-600">App ID: {applicationId}</p>
          )}
        </header>

        {/* Pipeline Container */}
        <div className="bg-gray-950/40 border border-gray-800/60 p-10 md:p-12 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          {/* Decorative glow effects */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-[120px] transition-all group-hover:bg-blue-500/20" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-500/10 rounded-full blur-[120px] transition-all group-hover:bg-purple-500/20" />
          
          <div className="relative z-10 space-y-2">
            {pipelineStages.map((stage, index) => (
              <PipelineStage 
                key={stage.id}
                name={stage.name}
                status={stage.status}
                isLast={index === pipelineStages.length - 1}
                isActive={stage.id === firstPendingId}
              />
            ))}
          </div>
        </div>

        {/* Informative Footer */}
        <footer className="mt-16 flex flex-col items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 text-gray-400 text-sm font-medium">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Analyzing financial profile</span>
            </div>
            <div className="w-px h-5 bg-gray-800" />
            <div className="flex items-center gap-2.5 text-gray-400 text-sm font-medium">
              <Signal className="w-5 h-5 text-green-500" />
              <span>Secure encryption active</span>
            </div>
          </div>
          
          <p className="text-gray-600 text-xs tracking-widest uppercase mt-4">
            Powered by HackForge AI
          </p>
        </footer>
      </div>
    </div>
  );
}
