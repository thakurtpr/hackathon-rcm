'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useApplicationStore } from '@/store/applicationStore';
import { useApplicationStatusSocket } from '@/hooks/useApplicationStatusSocket';
import {
  getApplication,
  getApplicationStatus,
  listUserApplications,
  getEligibilityScore,
  getMatchedScholarships,
  getDisbursalSchedule,
  getAuditTrail,
  getEligibleLoans,
  type EligibleLoan,
} from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplicationData {
  app_id?: string;
  status: string;
  loan_amount?: number;
  loan_type?: string;
  pipeline_stages?: Record<string, string>;
}

interface EligibilityData {
  composite?: number;
  band?: string;
  academic?: number;
  financial?: number;
  pq?: number;
  doc_trust?: number;
  kyc_completeness?: number;
  risk_band?: string;
}

interface DisburseStep {
  semester: string;
  status: string;
  amount: string;
  scheduled_date?: string;
  date?: string;
  type?: 'completed' | 'current' | 'locked';
}

interface ScholarshipItem {
  id: number | string;
  title: string;
  amount: string;
  match: number;
}

interface AuditEvent {
  event_id?: string;
  event_type?: string;
  action?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
}

// ─── useQuery-like hook ───────────────────────────────────────────────────────

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useApiQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  enabled: boolean,
  staleTimeMs = 30000
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: false, error: null });
  const retryCount = useRef(0);
  const lastFetchTime = useRef(0);
  const mountedRef = useRef(true);

  const fetch = useCallback(
    async (isManual = false) => {
      if (!enabled) return;
      const now = Date.now();
      if (!isManual && now - lastFetchTime.current < staleTimeMs && state.data !== null) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await queryFn();
        if (mountedRef.current) {
          lastFetchTime.current = Date.now();
          retryCount.current = 0;
          setState({ data: result, loading: false, error: null });
        }
      } catch (err) {
        if (mountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (retryCount.current < 2) {
            retryCount.current += 1;
            setTimeout(() => fetch(false), 1000 * retryCount.current);
          } else {
            setState((prev) => ({ ...prev, loading: false, error: msg }));
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, staleTimeMs, ...deps]
  );

  useEffect(() => {
    mountedRef.current = true;
    fetch(false);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const refetch = useCallback(() => {
    retryCount.current = 0;
    lastFetchTime.current = 0;
    fetch(true);
  }, [fetch]);

  return { ...state, refetch };
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />;
}

// ─── Error State ──────────────────────────────────────────────────────────────

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400/60" />
      <p className="text-gray-500 text-sm">Failed to load {label}.</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}

// ─── WS Status Dot ────────────────────────────────────────────────────────────

function WsStatusDot({ status }: { status: 'connecting' | 'connected' | 'disconnected' }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={`w-2 h-2 rounded-full ${
          status === 'connected'
            ? 'bg-emerald-400'
            : status === 'connecting'
            ? 'bg-amber-400 animate-pulse'
            : 'bg-gray-500'
        }`}
      />
      <span className="text-[10px] text-gray-500 font-medium">
        {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Polling'}
      </span>
    </span>
  );
}

// ─── Disburse Step Normaliser ─────────────────────────────────────────────────

function normaliseDisbursal(raw: Record<string, unknown>): DisburseStep {
  const dateStr = (raw.scheduled_date || raw.date || '') as string;
  const rawStatus = ((raw.status || 'pending') as string).toLowerCase();
  let type: 'completed' | 'current' | 'locked' = 'locked';
  if (rawStatus === 'disbursed' || rawStatus === 'completed' || rawStatus === 'done') type = 'completed';
  else if (rawStatus === 'pending' || rawStatus === 'current' || rawStatus === 'upcoming') type = 'current';
  return {
    semester: (raw.semester as string) || 'Semester',
    status: rawStatus,
    amount: raw.amount ? `₹${Number(raw.amount).toLocaleString('en-IN')}` : (raw.amount as string) || '—',
    date: dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
    type,
  };
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, userId: authUserId } = useAuthStore();
  const { applicationId: storedAppId, setApplicationId, pipelineStages } = useApplicationStore();
  const [userName, setUserName] = useState('Student');
  const [aiPulse, setAiPulse] = useState(0);
  const [appId, setAppId] = useState<string | null>(storedAppId);

  // Resolve appId: store → sessionStorage → fetch from API (with stale ID recovery)
  useEffect(() => {
    const resolvedUserId =
      authUserId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null);

    const fetchFromApi = () => {
      if (!resolvedUserId) return;
      listUserApplications(resolvedUserId)
        .then((resp: { applications?: { app_id?: string }[] } | { app_id?: string }[]) => {
          const apps = Array.isArray(resp) ? resp : (resp as { applications?: { app_id?: string }[] }).applications || [];
          if (apps?.length) {
            const id = apps[0].app_id;
            if (id) {
              setApplicationId(id);
              setAppId(id);
              if (typeof window !== 'undefined') sessionStorage.setItem('app_id', id);
            }
          }
        })
        .catch(() => {});
    };

    // Try stored app IDs first, but validate they exist
    const candidateId = storedAppId || (typeof window !== 'undefined' ? sessionStorage.getItem('app_id') : null);
    if (candidateId) {
      // Validate the candidate ID by fetching it
      getApplicationStatus(candidateId)
        .then((result) => {
          if (result && result.status !== 'unknown') {
            setApplicationId(candidateId);
            setAppId(candidateId);
          } else {
            // Stale ID — clear and fetch from API
            if (typeof window !== 'undefined') sessionStorage.removeItem('app_id');
            fetchFromApi();
          }
        })
        .catch(() => {
          // ID not found — clear and fetch from API
          if (typeof window !== 'undefined') sessionStorage.removeItem('app_id');
          fetchFromApi();
        });
      return;
    }

    fetchFromApi();
  }, [storedAppId, authUserId, setApplicationId]);

  useEffect(() => {
    const storedName = typeof window !== 'undefined' ? sessionStorage.getItem('user_name') : null;
    if (user?.name && user.name !== user.id) setUserName(user.name.split(' ')[0]);
    else if (storedName) setUserName(storedName.split(' ')[0]);
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setAiPulse((p) => (p + 1) % 3), 1200);
    return () => clearInterval(interval);
  }, []);

  const enabled = !!appId;

  // ── Query 1: Loan Summary (GET /applications/{app_id}) ──────────────────────
  const {
    data: applicationData,
    loading: applicationLoading,
    error: applicationError,
    refetch: refetchApplication,
  } = useApiQuery<ApplicationData>(
    () => getApplication(appId!),
    [appId],
    enabled,
    30000
  );

  // ── Query 2: Application Status + Pipeline (GET /applications/{app_id}/status)
  const {
    data: statusData,
    loading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useApiQuery<{ status: string; pipeline_stages: Record<string, string> }>(
    () => getApplicationStatus(appId!),
    [appId],
    enabled,
    30000
  );

  // ── Query 3: Disbursal / Semester Timeline ───────────────────────────────────
  const {
    data: rawDisbursal,
    loading: disbursalLoading,
    error: disbursalError,
    refetch: refetchDisbursal,
  } = useApiQuery<unknown[]>(
    () => getDisbursalSchedule(appId!),
    [appId],
    enabled,
    30000
  );

  // ── Query 4: Scholarships ────────────────────────────────────────────────────
  const {
    data: scholarships,
    loading: scholLoading,
    error: scholError,
    refetch: refetchSchol,
  } = useApiQuery<ScholarshipItem[]>(
    () => getMatchedScholarships(appId!),
    [appId],
    enabled,
    30000
  );

  // ── Query 5: Notifications / Audit Trail ─────────────────────────────────────
  const {
    data: auditRaw,
    loading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useApiQuery<{ events?: AuditEvent[] }>(
    () => getAuditTrail(appId!),
    [appId],
    enabled,
    30000
  );

  // ── Eligibility ──────────────────────────────────────────────────────────────
  const {
    data: eligibility,
    loading: eligibilityLoading,
  } = useApiQuery<EligibilityData>(
    () => getEligibilityScore(appId!),
    [appId],
    enabled,
    30000
  );

  // ── WebSocket for live status ─────────────────────────────────────────────────
  const { wsStatus } = useApplicationStatusSocket(appId);

  // ── Derived values ────────────────────────────────────────────────────────────
  const eligibilityBand = eligibility?.band ?? 'pending';
  const isEligibilityPending = !eligibility?.composite || eligibilityBand.toLowerCase() === 'pending';
  const eligibilityScore = isEligibilityPending ? 0 : (eligibility?.composite ?? 0);
  const disbursalSchedule: DisburseStep[] = (rawDisbursal || []).map((item) =>
    normaliseDisbursal(item as Record<string, unknown>)
  );
  const auditEvents: AuditEvent[] = auditRaw?.events || [];
  const appStatus = statusData?.status || applicationData?.status || null;
  const pipelineFromStatus = statusData?.pipeline_stages || {};

  // ── Merge pipeline stages: status data overrides store ───────────────────────
  const mergedPipelineStages = pipelineStages.map((stage) => {
    const liveStatus = pipelineFromStatus[stage.id];
    if (liveStatus) {
      return { ...stage, status: liveStatus as typeof stage.status };
    }
    return stage;
  });

  const hasPendingAction = mergedPipelineStages.some(
    (s) => s.status === 'pending' || s.status === 'flagged'
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-15%] w-[50rem] h-[50rem] bg-violet-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[40rem] h-[40rem] bg-cyan-600/5 rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => {
              const state = useAuthStore.getState();
              const role = typeof window !== 'undefined' ? sessionStorage.getItem('role') : null;
              if (state.isAuthenticated) {
                router.push(role === 'admin' ? '/admin/applications' : '/dashboard');
              } else {
                router.push('/');
              }
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Brain className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Scholar</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">Flow</span>
            </span>
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
              {auditEvents.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#0a0a0f]" />
              )}
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
            {appStatus ? (
              <span className="text-indigo-400 font-semibold">Status: {appStatus}</span>
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
              <p className="text-sm font-bold text-white">
                {isEligibilityPending ? 'AI Analysis in Progress' : 'AI Analysis Complete'}
              </p>
              {eligibilityLoading ? (
                <SkeletonBlock className="w-48 h-3 mt-1" />
              ) : isEligibilityPending ? (
                <p className="text-xs text-gray-400">
                  Complete your <span className="text-indigo-400 font-bold">assessment via AI chat</span> to unlock your eligibility score
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Your eligibility score is{' '}
                  <span className="text-emerald-400 font-bold">
                    {eligibilityScore}/100 ({eligibilityBand})
                  </span>{' '}
                  — above average for your profile
                </p>
              )}
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

            {/* ── Section 1: Loan Summary Card ─────────────────────────────── */}
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

                {applicationLoading ? (
                  <div className="grid grid-cols-3 gap-6">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={i > 0 ? 'border-l border-white/5 pl-6' : ''}>
                        <SkeletonBlock className="w-24 h-3 mb-2" />
                        <SkeletonBlock className="w-32 h-6" />
                      </div>
                    ))}
                  </div>
                ) : applicationError ? (
                  <SectionError label="Loan Summary" onRetry={refetchApplication} />
                ) : applicationData ? (
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold mb-1">Application Status</p>
                      <p className="text-xl font-black text-white capitalize">
                        {appStatus || applicationData.status}
                      </p>
                    </div>
                    {applicationData.loan_amount != null && (
                      <div className="border-l border-white/5 pl-6">
                        <p className="text-gray-500 text-xs font-semibold mb-1">Loan Amount</p>
                        <p className="text-xl font-black text-indigo-400">
                          ₹{Number(applicationData.loan_amount).toLocaleString('en-IN')}
                        </p>
                      </div>
                    )}
                    {applicationData.loan_type && (
                      <div className="border-l border-white/5 pl-6">
                        <p className="text-gray-500 text-xs font-semibold mb-1">Loan Type</p>
                        <p className="text-xl font-black text-indigo-400 capitalize">
                          {applicationData.loan_type}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-gray-600 text-sm">
                      No active application found.{' '}
                      <button onClick={() => router.push('/chat')} className="text-indigo-400 underline">
                        Start with AI
                      </button>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 5: Application Status Pipeline ───────────────────── */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-8 py-5 border-b border-white/5 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Application Status Pipeline</h3>
                <span className="ml-auto">
                  <WsStatusDot status={wsStatus} />
                </span>
              </div>
              <div className="p-8">
                {statusLoading && !statusData ? (
                  <div className="space-y-4">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <SkeletonBlock className="w-8 h-8 rounded-full flex-shrink-0" />
                        <SkeletonBlock className="flex-1 h-4" />
                      </div>
                    ))}
                  </div>
                ) : statusError ? (
                  <SectionError label="Status Pipeline" onRetry={refetchStatus} />
                ) : (
                  <div className="relative space-y-6">
                    <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/5" />
                    {mergedPipelineStages.map((stage) => {
                      const isDone = stage.status === 'done';
                      const isFailed = stage.status === 'failed' || stage.status === 'flagged';
                      const isPending = stage.status === 'pending';
                      return (
                        <div key={stage.id} className="relative flex items-center gap-4">
                          <div
                            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#0a0a0f] flex-shrink-0 ${
                              isDone
                                ? 'bg-emerald-500'
                                : isFailed
                                ? 'bg-red-500'
                                : isPending
                                ? 'bg-indigo-500'
                                : 'bg-white/10'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            ) : isFailed ? (
                              <AlertCircle className="w-3.5 h-3.5 text-white" />
                            ) : isPending ? (
                              <Clock className="w-3.5 h-3.5 text-white animate-pulse" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <span
                              className={`text-sm font-semibold ${
                                isDone
                                  ? 'text-white'
                                  : isFailed
                                  ? 'text-red-400'
                                  : isPending
                                  ? 'text-indigo-300'
                                  : 'text-gray-600'
                              }`}
                            >
                              {stage.name}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isDone
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isFailed
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : isPending
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : 'bg-white/5 text-gray-500 border border-white/10'
                              }`}
                            >
                              {stage.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 2: Semester Timeline ─────────────────────────────── */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-8 py-5 border-b border-white/5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Semester Disbursal Timeline</h3>
              </div>
              <div className="p-8">
                {disbursalLoading && !rawDisbursal ? (
                  <div className="relative space-y-8">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-6">
                        <SkeletonBlock className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <SkeletonBlock className="w-32 h-4" />
                          <SkeletonBlock className="w-24 h-3" />
                          <SkeletonBlock className="w-20 h-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : disbursalError ? (
                  <SectionError label="Semester Timeline" onRetry={refetchDisbursal} />
                ) : disbursalSchedule.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Clock className="w-8 h-8 text-gray-700" />
                    <p className="text-gray-600 text-sm text-center">
                      Your semester schedule will appear here after loan approval.
                      <br />
                      <button onClick={() => router.push('/chat')} className="text-indigo-400 underline">
                        Apply via AI assistant
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="relative space-y-10">
                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/5" />
                    {disbursalSchedule.map((step, idx) => {
                      const isCompleted = step.type === 'completed';
                      const isCurrent = step.type === 'current';
                      const needsMarksheet =
                        isCurrent &&
                        (step.status === 'pending' || step.status === 'upcoming');
                      return (
                        <div key={idx} className="relative flex gap-6">
                          <div
                            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-[#0a0a0f] flex-shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-500'
                                : isCurrent
                                ? 'bg-amber-500'
                                : 'bg-white/10'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            ) : isCurrent ? (
                              <AlertCircle className="w-4 h-4 text-white" />
                            ) : (
                              <Lock className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-1">
                              <h4
                                className={`font-bold ${
                                  step.type === 'locked' ? 'text-gray-500' : 'text-white'
                                }`}
                              >
                                {step.semester}
                              </h4>
                              <div className="flex items-center gap-2">
                                {needsMarksheet && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Action Required
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                                    isCompleted
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : isCurrent
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-white/5 text-gray-500 border border-white/10'
                                  }`}
                                >
                                  {step.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-xl font-black text-gray-300 mb-0.5">{step.amount}</p>
                            <p className="text-xs text-gray-500">{step.date}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: Notification Feed ─────────────────────────────── */}
            <div className="bg-white/[0.03] backdrop-blur border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-8 py-5 border-b border-white/5 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Notification Feed</h3>
              </div>
              <div className="p-4">
                {auditLoading && !auditRaw ? (
                  <div className="space-y-3 p-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-3">
                        <SkeletonBlock className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <SkeletonBlock className="w-48 h-3" />
                          <SkeletonBlock className="w-24 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : auditError ? (
                  <SectionError label="Notifications" onRetry={refetchAudit} />
                ) : auditEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Bell className="w-7 h-7 text-gray-700" />
                    <p className="text-gray-600 text-xs text-center">No notifications yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {auditEvents.slice(0, 10).map((evt, idx) => {
                      const label = evt.description || evt.action || evt.event_type || 'System event';
                      const ts = evt.timestamp || evt.created_at;
                      const timeStr = ts
                        ? new Date(ts).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '';
                      return (
                        <div
                          key={evt.event_id || idx}
                          className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/10 transition-all"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-300 font-medium leading-snug">{label}</p>
                            {timeStr && (
                              <p className="text-[10px] text-gray-600 mt-0.5">{timeStr}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* Action Required */}
            {hasPendingAction && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden hover:border-amber-500/40 transition-all group">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      Action Required
                    </span>
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

            {/* AI Credit Score — Prominent Card */}
            <div className="bg-gradient-to-br from-indigo-600/10 via-violet-600/8 to-cyan-600/5 border border-indigo-500/20 rounded-3xl p-6 hover:border-indigo-500/40 transition-all relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none rounded-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                    AI Credit Score
                  </span>
                  <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    DISHA Computed
                  </span>
                </div>
                {eligibilityLoading ? (
                  <div className="space-y-3">
                    <SkeletonBlock className="w-24 h-14" />
                    <SkeletonBlock className="w-full h-2 rounded-full" />
                    <SkeletonBlock className="w-full h-16 rounded-xl" />
                  </div>
                ) : isEligibilityPending ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-end gap-3">
                      <span className="text-6xl font-black text-gray-700">—</span>
                      <span className="text-gray-600 text-sm font-bold mb-2">/100</span>
                      <span className="ml-auto mb-2 text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full w-0 rounded-full bg-gray-700" />
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Complete your AI chat assessment to unlock your score
                    </p>
                    <button
                      onClick={() => router.push('/chat')}
                      className="w-full mt-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-300 text-xs font-bold py-2 rounded-xl transition-all"
                    >
                      Start with Disha AI →
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Big score number */}
                    <div className="flex items-end gap-3 mb-3">
                      <span className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400">
                        {eligibilityScore}
                      </span>
                      <div className="mb-2">
                        <span className="text-gray-400 text-sm font-bold">/100</span>
                        <div
                          className={`text-xs font-black px-2 py-0.5 rounded-full mt-1 w-fit ${
                            eligibilityScore >= 80
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : eligibilityScore >= 60
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {eligibilityBand.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
                        style={{ width: `${eligibilityScore}%` }}
                      />
                    </div>
                    {/* Score breakdown */}
                    {eligibility && (eligibility.academic || eligibility.financial || eligibility.pq) ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Academic', val: eligibility.academic, color: 'text-emerald-400' },
                          { label: 'Financial', val: eligibility.financial, color: 'text-indigo-400' },
                          { label: 'Potential (PQ)', val: eligibility.pq, color: 'text-violet-400' },
                          { label: 'Doc Trust', val: eligibility.doc_trust, color: 'text-cyan-400' },
                          { label: 'KYC Done', val: eligibility.kyc_completeness, color: 'text-amber-400' },
                        ].filter(x => x.val != null && x.val !== 0).slice(0, 4).map(({ label, val, color }) => (
                          <div key={label} className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5">
                            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
                            <p className={`text-base font-black ${color}`}>{Math.round((val ?? 0) * 10) / 10}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {eligibility?.risk_band && (
                      <p className="text-[10px] text-gray-500 mt-3">
                        Risk Band: <span className="text-indigo-400 font-bold">{eligibility.risk_band}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Section 3: Scholarships Panel ──────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/8 rounded-3xl overflow-hidden hover:border-indigo-500/20 transition-all">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white">AI Matched Scholarships</span>
                </div>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
                  NEW
                </span>
              </div>
              <div className="p-4 space-y-3">
                {scholLoading && !scholarships ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <SkeletonBlock className="w-40 h-3" />
                        <SkeletonBlock className="w-24 h-5" />
                      </div>
                    ))}
                  </div>
                ) : scholError ? (
                  <SectionError label="Scholarships" onRetry={refetchSchol} />
                ) : !scholarships || scholarships.length === 0 ? (
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
                      <div
                        key={s.id}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all group cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <h5 className="font-bold text-sm text-gray-200 group-hover:text-indigo-400 transition-colors leading-tight">
                            {s.title}
                          </h5>
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 ml-2 whitespace-nowrap">
                            {s.match}% Match
                          </span>
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

            {/* Eligible Loans Section */}
            {!isEligibilityPending && eligibilityScore > 0 && (() => {
              const eligibleLoans = getEligibleLoans(eligibilityScore);
              if (eligibleLoans.length === 0) return null;
              return (
                <div className="bg-white/[0.03] border border-white/8 rounded-3xl overflow-hidden hover:border-emerald-500/20 transition-all">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">Eligible Loan Products</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                      {eligibleLoans.length} MATCHED
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    {eligibleLoans.map((loan: EligibleLoan) => (
                      <div
                        key={loan.id}
                        className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-all"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-bold text-xs text-gray-200 leading-tight">{loan.name}</h5>
                              {loan.badge && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {loan.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">{loan.provider}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-xs font-black text-white">₹{(loan.maxAmount / 100000).toFixed(0)}L</p>
                            <p className="text-[10px] text-emerald-400 font-bold">{loan.interestRate}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed">{loan.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* AI Chat CTA */}
            <button
              onClick={() => router.push('/chat')}
              className="w-full p-5 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-between group hover:border-indigo-500/40 hover:from-indigo-500/15 hover:to-violet-500/15 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <MessageSquare
                    className={`w-5 h-5 text-indigo-400 ${aiPulse === 2 ? 'animate-pulse' : ''}`}
                  />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Ask Disha AI</p>
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
