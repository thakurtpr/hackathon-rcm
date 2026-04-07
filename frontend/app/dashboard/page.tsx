'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Bell,
  User,
  Sparkles,
  Brain,
  MessageSquare,
  Zap,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApplicationStatus, listUserApplications, getEligibilityScore, getMatchedScholarships, getDisbursalSchedule } from '@/lib/api';

// Timeline and scholarships loaded from API; no mock data

type DisburseStep = { semester: string; status: string; amount: string; date: string; type: 'completed' | 'current' | 'locked' };
type ScholarshipItem = { id: number | string; title: string; amount: string; match: number };

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userName, setUserName] = useState('Student');
  const [aiPulse, setAiPulse] = useState(0);
  const [appData, setAppData] = useState<{ status: string; pipeline_stages: Record<string, string> } | null>(null);
  const [eligibility, setEligibility] = useState<{ composite?: number; band?: string } | null>(null);
  const [disbursalSchedule, setDisbursalSchedule] = useState<DisburseStep[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipItem[]>([]);

  useEffect(() => {
    // Load user name
    const storedName = typeof window !== 'undefined' ? sessionStorage.getItem('user_name') : null;
    if (user?.name && user.name !== user.id) setUserName(user.name.split(' ')[0]);
    else if (storedName) setUserName(storedName.split(' ')[0]);

    // Animate AI pulse
    const interval = setInterval(() => setAiPulse((p) => (p + 1) % 3), 1200);

    // Load real application data
    const userId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null;
    const appId = typeof window !== 'undefined' ? sessionStorage.getItem('app_id') : null;
    const loadForApp = (id: string) => {
      getApplicationStatus(id).then(setAppData).catch(() => {});
      getEligibilityScore(id).then(setEligibility).catch(() => {});
      getMatchedScholarships(id).then((s: ScholarshipItem[]) => setScholarships(s || [])).catch(() => {});
      getDisbursalSchedule(id).then((s: DisburseStep[]) => setDisbursalSchedule(s || [])).catch(() => {});
    };
    if (appId) {
      loadForApp(appId);
    } else if (userId) {
      listUserApplications(userId)
        .then((apps: { app_id?: string }[]) => {
          if (apps?.length) {
            const id = apps[0].app_id;
            if (id) {
              sessionStorage.setItem('app_id', id);
              loadForApp(id);
            }
          }
        })
        .catch(() => {});
    }

    return () => clearInterval(interval);
  }, [user]);

  const eligibilityScore = eligibility?.composite ?? 0;
  const eligibilityBand = eligibility?.band ?? 'Pending';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-15%] w-[50rem] h-[50rem] bg-violet-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[40rem] h-[40rem] bg-cyan-600/5 rounded-full blur-[100px]" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Brain className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Scholar</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">Flow</span>
            </span>
            {/* AI Live Badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full ml-2">
              <span className={`w-1.5 h-1.5 rounded-full bg-indigo-400 ${aiPulse === 0 ? 'animate-ping' : ''}`} />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">AI Live</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/chat')}
              className="hidden md:flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              AI Assistant
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#0a0a0f]" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
        </div>
      </nav>

      <main className="relative max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Welcome Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-indigo-400/80 text-sm font-semibold mb-3 uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Dashboard</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
            Welcome back,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
              {userName}
            </span>
          </h1>
          <p className="text-gray-400 text-base font-medium max-w-xl">
            Your AI loan agent is actively monitoring your application.{' '}
            {appData?.status ? (
              <span className="text-indigo-400 font-semibold">Status: {appData.status}</span>
            ) : (
              <span>Everything looks on track for your next disbursal.</span>
            )}
          </p>
        </header>

        {/* AI Insight Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Brain className={`w-5 h-5 text-indigo-400 ${aiPulse === 1 ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI Analysis Complete</p>
              <p className="text-xs text-gray-400">Your eligibility score is <span className="text-emerald-400 font-bold">{eligibilityScore}/100 ({eligibilityBand})</span> — above average for your profile</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/20 transition-all whitespace-nowrap"
          >
            Ask AI <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* Loan Performance Card */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/8 rounded-3xl p-8 relative overflow-hidden group hover:border-indigo-500/20 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent pointer-events-none rounded-3xl" />
              <div className="absolute top-0 right-0 p-6 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                <IndianRupee className="w-48 h-48 -rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-indigo-400 mb-6">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Loan Performance Overview</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Zap className="w-2.5 h-2.5" /> Live
                  </span>
                </div>

                {appData?.status ? (
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold mb-1">Application Status</p>
                      <p className="text-xl font-black text-white capitalize">{appData.status}</p>
                    </div>
                    {Object.entries(appData.pipeline_stages || {}).slice(0, 2).map(([stage, status]) => (
                      <div key={stage} className="border-l border-white/5 pl-6">
                        <p className="text-gray-500 text-xs font-semibold mb-1 capitalize">{stage.replace(/_/g, ' ')}</p>
                        <p className="text-xl font-black text-indigo-400 capitalize">{String(status)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-gray-600 text-sm">No active application found. <button onClick={() => router.push('/chat')} className="text-indigo-400 underline">Start with AI</button></p>
                  </div>
                )}
              </div>
            </div>

            {/* Disbursal Timeline */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-8 py-5 border-b border-white/5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Disbursal Timeline</h3>
              </div>
              <div className="p-8">
                {disbursalSchedule.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Clock className="w-8 h-8 text-gray-700" />
                    <p className="text-gray-600 text-sm text-center">No disbursal schedule yet.<br/><button onClick={() => router.push('/chat')} className="text-indigo-400 underline">Apply via AI assistant</button></p>
                  </div>
                ) : (
                  <div className="relative space-y-10">
                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/5" />
                    {disbursalSchedule.map((step, idx) => (
                      <div key={idx} className="relative flex gap-6">
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-[#0a0a0f] flex-shrink-0 ${
                          step.type === 'completed' ? 'bg-emerald-500' :
                          step.type === 'current' ? 'bg-indigo-500' :
                          'bg-white/10'
                        }`}>
                          {step.type === 'completed' ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                           step.type === 'current' ? <AlertCircle className="w-4 h-4 text-white" /> :
                           <Lock className="w-4 h-4 text-gray-500" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-1">
                            <h4 className={`font-bold ${step.type === 'locked' ? 'text-gray-500' : 'text-white'}`}>{step.semester}</h4>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                              step.type === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              step.type === 'current' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                              'bg-white/5 text-gray-500 border border-white/10'
                            }`}>{step.status}</span>
                          </div>
                          <p className="text-xl font-black text-gray-300 mb-0.5">{step.amount}</p>
                          <p className="text-xs text-gray-500">{step.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* Action Required — shown only when there's a pending pipeline stage */}
            {appData?.pipeline_stages && Object.values(appData.pipeline_stages).some(v => v === 'pending' || v === 'awaiting') && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden hover:border-amber-500/40 transition-all group">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Action Required</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Verification Pending</h3>
                  <p className="text-gray-400 text-xs leading-relaxed mb-5">
                    Some pipeline stages need your attention. AI will guide you through the next step.
                  </p>
                  <button
                    onClick={() => router.push('/chat')}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-black py-3 rounded-2xl text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                  >
                    Ask AI Assistant →
                  </button>
                </div>
              </div>
            )}

            {/* AI Eligibility Score */}
            <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-6 hover:border-indigo-500/20 transition-all">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">AI Eligibility</span>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">{eligibilityScore}</span>
                <span className="text-gray-500 text-sm font-bold mb-2">/100</span>
                <span className={`ml-auto mb-2 text-xs font-black px-2 py-0.5 rounded-full ${
                  eligibilityScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  eligibilityScore >= 60 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>{eligibilityBand}</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000"
                  style={{ width: `${eligibilityScore}%` }}
                />
              </div>
            </div>

            {/* Scholarships */}
            <div className="bg-white/[0.03] border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white">AI Matched Scholarships</span>
                </div>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">NEW</span>
              </div>
              <div className="p-4 space-y-3">
                {scholarships.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <GraduationCap className="w-7 h-7 text-gray-700" />
                    <p className="text-gray-600 text-xs text-center">
                      No matches yet.{' '}
                      <button onClick={() => router.push('/chat')} className="text-indigo-400 underline">
                        Ask AI to find scholarships
                      </button>
                    </p>
                  </div>
                ) : (
                  <>
                    {scholarships.map((s) => (
                      <div key={s.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all group cursor-pointer">
                        <div className="flex justify-between items-start mb-1.5">
                          <h5 className="font-bold text-sm text-gray-200 group-hover:text-indigo-400 transition-colors leading-tight">{s.title}</h5>
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 ml-2 whitespace-nowrap">{s.match}% Match</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-black text-white">{s.amount}</p>
                          <button className="text-xs font-bold text-indigo-400 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                            Apply <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button className="w-full mt-2 text-xs font-bold text-gray-500 hover:text-indigo-400 flex items-center justify-center gap-1.5 py-2 transition-colors">
                      View All <ExternalLink className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AI Chat CTA */}
            <button
              onClick={() => router.push('/chat')}
              className="w-full p-5 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-between group hover:border-indigo-500/40 hover:from-indigo-500/15 hover:to-violet-500/15 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <MessageSquare className={`w-5 h-5 text-indigo-400 ${aiPulse === 2 ? 'animate-pulse' : ''}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Ask AI Assistant</p>
                  <p className="text-xs text-gray-500">Loan advice, docs, eligibility</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
