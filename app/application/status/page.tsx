'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, Loader2, Signal } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { useApplicationStatusSocket } from '@/hooks/useApplicationStatusSocket';

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
        return <CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400" />;
      case 'failed':
      case 'flagged':
        return <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-gray-400 dark:text-gray-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-400 dark:text-gray-500" />;
    }
  };

  const isCompleted = status === 'done';

  return (
    <div className="relative flex items-start gap-4 pb-8 transition-colors">
      {/* Vertical line between steps */}
      {!isLast && (
        <div 
          className={`absolute left-[11px] top-7 w-[2px] h-full transition-colors ${
            isCompleted ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      )}
      
      {/* Icon container */}
      <div className="relative z-10 flex items-center justify-center w-6 h-6">
        {isActive ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-4 h-4 rounded-full bg-blue-500/30 animate-ping" />
            <div className="w-3 h-3 bg-blue-600 dark:bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
        ) : (
          getIcon()
        )}
      </div>

      {/* Stage detail */}
      <div className="flex flex-col">
        <span 
          className={`text-lg font-medium transition-colors duration-300 ${
            isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {name}
        </span>
        {isActive && (
          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse mt-0.5">
            Processing...
          </span>
        )}
      </div>
    </div>
  );
};

export default function StatusPage() {
  const router = useRouter();
  const { pipelineStages, webSocketStatus, updateStageStatus, applicationId } = useApplicationStore();
  
  // Find the first pending stage to mark it as active
  const firstPendingId = pipelineStages.find(s => s.status === 'pending')?.id;

  // Connect to the WebSocket (using generated ID)
  const startPolling = useApplicationStatusSocket(applicationId || 'DUMMY_APP_ID_123');

  // Simulation effect setup
  useEffect(() => {
    console.log('Starting simulation flow...');

    const simulationSteps = [
      { id: 'verified', delay: 3000 },
      { id: 'assessment', delay: 7000 },
      { id: 'fraud', delay: 11000 },
      { id: 'eligibility', delay: 15000 },
      { id: 'decision', delay: 19000 },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    simulationSteps.forEach((step, index) => {
      const t = setTimeout(() => {
        updateStageStatus(step.id, 'done');
        
        // If it's the last step, navigate to result page after a short delay
        if (index === simulationSteps.length - 1) {
          setTimeout(() => {
            router.push('/application/result');
          }, 2000);
        }
      }, step.delay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [updateStageStatus, router]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-sans flex flex-col items-center py-16 px-4 transition-colors duration-500">
      {/* Top right live indicator */}
      <div className="fixed top-8 right-8 flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 shadow-xl z-50 transition-colors">
        <div className={`w-2.5 h-2.5 rounded-full ${webSocketStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-gray-400 dark:bg-gray-500'}`} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors">Live</span>
      </div>

      <div className="max-w-xl w-full">
        {/* Header Section */}
        <header className="mb-14 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-gray-900 dark:text-white transition-colors">
            Tracking Your Application
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl font-light max-w-md mx-auto transition-colors text-center">
            Your application is being processed by our AI engine. This usually takes 3-5 minutes.
          </p>
        </header>

        {/* Pipeline Container */}
        <div className="bg-gray-50 dark:bg-gray-950/40 border border-gray-200 dark:border-gray-800/60 p-10 md:p-12 rounded-[2.5rem] backdrop-blur-xl shadow-2xl relative overflow-hidden group transition-colors">
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
            <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400 text-sm font-medium transition-colors">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-500" />
              <span>Analyzing financial profile</span>
            </div>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-800 transition-colors" />
            <div className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400 text-sm font-medium transition-colors">
              <Signal className="w-5 h-5 text-green-600 dark:text-green-500" />
              <span>Secure encryption active</span>
            </div>
          </div>
          
          <p className="text-gray-400 dark:text-gray-600 text-xs tracking-widest uppercase mt-4 transition-colors">
            Powered by ScholarFlow Intelligence
          </p>
        </footer>
      </div>
    </div>
  );
}
