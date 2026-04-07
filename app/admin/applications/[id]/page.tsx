'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Activity,
  ThumbsUp,
  XCircle,
  MessageSquare,
  Zap,
  Info,
  ExternalLink,
  Lock,
  Search
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Dummy data for the applicant - Refactored to focus on AI
const applicantData = {
  id: 'APP-9823',
  name: 'Rajan Kumar',
  status: 'Manual Review Required',
  aiInsights: {
    fraudRiskScore: 85,
    fraudReasons: [
      'IP mapping mismatch (Declared: Delhi, Detected: Mumbai VPN)',
      'Unnatural keystroke dynamics (Bot detected in Behavioral test)',
      'Device fingerprint connected to 3 previous rejections',
      'Face Match anomaly: Passive liveness detection failed'
    ],
    pqScore: 88,
    pqSummary: "Despite risk flags, applicant shows exceptionally high drive and financial discipline. Behavioral patterns align with Top 5% of successful repayers.",
    behavioralAnalysis: "Highly motivated individual with strong financial discipline."
  },
  systemLog: [
    { time: '11:24 AM', event: 'Risk engine flagged IP mismatch', type: 'error' },
    { time: '11:22 AM', event: 'Face match completed: 98% Confidence', type: 'success' },
    { time: '11:20 AM', event: 'Behavioral test: Keystroke bot alert', type: 'warning' },
    { time: '11:15 AM', event: 'KYC Documents uploaded via OCR', type: 'info' },
    { time: '11:10 AM', event: 'Initial application submitted', type: 'info' },
    { time: 'Yesterday', event: 'Phone number verification failed (retry successful)', type: 'warning' }
  ]
};

const FraudGauge = ({ risk }: { risk: number }) => {
  const data = [
    { name: 'Risk', value: risk, fill: '#ef4444' }, // Red-500
    { name: 'Remaining', value: 100 - risk, fill: '#e5e7eb' }, // Gray-200 (light mode) or handled by theme?
  ];

  return (
    <div className="relative h-48 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill="#ef4444" />
            <Cell className="fill-gray-200 dark:fill-gray-800 transition-colors" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-red-600 dark:text-red-500 transition-colors">{risk}%</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider transition-colors">Fraud Risk</span>
      </div>
    </div>
  );
};

const PQVisual = ({ score }: { score: number }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Simple SVG Circular Progress */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            className="text-gray-100 dark:text-gray-800 transition-colors"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * score) / 100}
            className="text-indigo-600 dark:text-indigo-500 transition-all duration-1000 ease-out"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-indigo-700 dark:text-indigo-400 transition-colors">{score}</span>
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] transition-colors">PQ SCORE</span>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-full animate-pulse shadow-sm dark:shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-colors">
    {children}
  </span>
);

export default function ApplicationReviewPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Polish */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200 dark:border-gray-800/50 transition-colors">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium transition-colors">
             <Link href="/admin/applications" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
               <ArrowLeft size={14} /> Back to Queue
             </Link>
             <span>•</span>
             <span>Ref: {applicantData.id}</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white transition-colors">{applicantData.name}</h1>
            <StatusBadge>{applicantData.status}</StatusBadge>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 gap-2 transition-colors">
             <Search size={16} /> Look up History
           </Button>
           <Button variant="outline" className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
             <ExternalLink size={16} />
           </Button>
        </div>
      </header>

      {/* Main Analysis Card */}
      <Card className="bg-white dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 shadow-xl dark:shadow-none backdrop-blur-xl overflow-hidden transition-colors">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/10 px-8 py-6 transition-colors">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white transition-colors">
                <Zap size={20} className="text-indigo-600 dark:text-indigo-400 fill-indigo-600/10 dark:fill-indigo-400/20" />
                AI Risk & Potential Analysis
              </CardTitle>
              <CardDescription className="text-gray-500 font-medium transition-colors">Combined forensic and behavioral score engine</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-xs font-bold transition-colors">
              <ShieldAlert size={14} />
              Forensics Active
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Left Side: Fraud Risk */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-500 uppercase tracking-widest transition-colors">
                 <Lock size={14} />
                 Fraud Confidence
              </div>
              <FraudGauge risk={applicantData.aiInsights.fraudRiskScore} />
              <div className="space-y-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 p-5 rounded-2xl transition-colors">
                <h4 className="text-xs font-black text-red-600 dark:text-red-400/80 uppercase flex items-center gap-2 transition-colors">
                  <AlertTriangle size={14} />
                  AI Reasoning Checklist
                </h4>
                <ul className="space-y-2.5">
                  {applicantData.aiInsights.fraudReasons.map((reason, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300 items-start leading-relaxed group transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Side: PQ Analysis */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest transition-colors">
                   <Activity size={14} />
                   Applicant Potential
                </div>
                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded uppercase transition-colors">
                   High Probability
                </div>
              </div>
              <PQVisual score={applicantData.aiInsights.pqScore} />
              <div className="space-y-4 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/10 p-5 rounded-2xl transition-colors">
                <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2 transition-colors">
                  <ThumbsUp size={14} />
                  Behavioral Summary
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed italic transition-colors">
                  "{applicantData.aiInsights.pqSummary}"
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 transition-colors">
                  <Info size={12} />
                  Comparison to regional baseline: +22%
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Area Component inside Card Content */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800/50 transition-colors">
             <div className="flex flex-col md:flex-row items-center gap-4 justify-center">
                <Button className="w-full md:w-auto px-8 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 text-base">
                   Approve (Override Flags)
                </Button>
                <Button className="w-full md:w-auto px-8 h-12 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-gray-700 transition-all active:scale-95 text-base">
                   Request Manual Interview
                </Button>
                <Button variant="destructive" className="w-full md:w-auto px-8 h-12 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95 text-base border-none">
                   Reject (Confirm Fraud)
                </Button>
             </div>
             <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-4 uppercase font-bold tracking-widest transition-colors">
                All actions are logged & audited for compliance reasons
             </p>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail Redesign */}
      <Card className="bg-transparent border-gray-200 dark:border-gray-800/50 transition-colors">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-400 dark:text-gray-400 uppercase tracking-widest leading-none transition-colors">
            <Activity size={14} />
            System Event Log
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="h-40 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent transition-colors">
            <div className="space-y-4">
              {applicantData.systemLog.map((log, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 border-dashed transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 dark:text-gray-500 font-mono w-16 transition-colors">{log.time}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium transition-colors">{log.event}</span>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                    log.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                    log.type === 'warning' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 
                    log.type === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                    'bg-gray-300 dark:bg-gray-600'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
