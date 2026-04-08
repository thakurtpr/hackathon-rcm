'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEligibilityScore, getDisbursalSchedule, getMatchedScholarships, getApplicationStatus } from '@/lib/api';
import ScoreRadar from '@/components/result/ScoreRadar';
import PQBadge from '@/components/result/PQBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Calendar, IndianRupee, Rocket, ArrowRight, AlertTriangle } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';

// Derive interest rate from risk band returned by XGBoost model
function getInterestRate(riskBand: string): string {
  switch (riskBand?.toUpperCase()) {
    case 'LOW':    return '8.5%';
    case 'MEDIUM': return '10.5%';
    case 'HIGH':   return '13.5%';
    default:       return '11%';
  }
}

// Build radar chart data from eligibility score components
function buildRadarData(score: Record<string, number>) {
  return [
    { subject: 'Academic', value: Math.round(score.academic ?? 0), fullMark: 100 },
    { subject: 'Financial', value: Math.round(score.financial ?? 0), fullMark: 100 },
    { subject: 'Potential', value: Math.round(score.pq ?? 0), fullMark: 100 },
    { subject: 'Doc Trust', value: Math.round(score.doc_trust ?? 0), fullMark: 100 },
    { subject: 'KYC', value: Math.round(score.kyc_completeness ?? 0), fullMark: 100 },
  ];
}

export default function ResultPage() {
  const router = useRouter();
  const { applicationId, resetStore } = useApplicationStore();
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState<{
    band: string;
    composite: number;
    risk_band: string;
    pq_override: boolean;
    fraud_flag: boolean;
    academic?: number;
    financial?: number;
    pq?: number;
    doc_trust?: number;
    kyc_completeness?: number;
  } | null>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [schedule, setSchedule] = useState<Array<{
    id: string;
    semester: number;
    amount: number;
    planned_date: string;
    actual_date: string;
    status: string;
  }>>([]);
  const [scholarships, setScholarships] = useState<Array<{
    id: string;
    name: string;
    amount: number;
    deadline: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Resolve appId from store or sessionStorage
  const appId = applicationId || (typeof window !== 'undefined' ? sessionStorage.getItem('app_id') : null);

  useEffect(() => {
    if (!appId) {
      setError('No application found. Please submit an application first.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [score, appStatus, flow, grants] = await Promise.all([
          getEligibilityScore(appId),
          getApplicationStatus(appId),
          getDisbursalSchedule(appId),
          getMatchedScholarships(appId),
        ]);

        setScoreData(score);
        setLoanAmount(appStatus?.loan_amount ?? 0);
        setSchedule(Array.isArray(flow) ? flow : []);
        setScholarships(Array.isArray(grants) ? grants : []);
      } catch (err) {
        console.error('Failed to fetch application results:', err);
        setError('Failed to load results. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [appId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
        <h2 className="text-2xl font-semibold animate-pulse">Calculating final decision...</h2>
        <p className="text-gray-400 mt-2">Running our AI eligibility engine</p>
      </div>
    );
  }

  // Error state
  if (error || !scoreData) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-2" />
        <h2 className="text-2xl font-semibold">{error || 'No result data available'}</h2>
        <p className="text-gray-400">Your application may still be processing.</p>
        <div className="flex gap-4 mt-4">
          <Button onClick={() => router.push('/application/status')} variant="outline">
            Check Status
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isApproved = scoreData.band === 'approved';
  const isRejected = scoreData.band === 'rejected';
  const interestRate = getInterestRate(scoreData.risk_band);
  const radarData = buildRadarData({
    academic: scoreData.academic ?? 0,
    financial: scoreData.financial ?? 0,
    pq: scoreData.pq ?? 0,
    doc_trust: scoreData.doc_trust ?? 0,
    kyc_completeness: scoreData.kyc_completeness ?? 0,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 space-y-8 animate-in fade-in duration-700">
      {/* Hero Banner */}
      <div className={`border rounded-2xl p-8 relative overflow-hidden ${
        isApproved
          ? 'bg-green-900/30 border-green-500/50'
          : isRejected
          ? 'bg-red-900/20 border-red-500/40'
          : 'bg-amber-900/20 border-amber-500/40'
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          {isApproved
            ? <CheckCircle className="w-48 h-48 text-green-400" />
            : isRejected
            ? <XCircle className="w-48 h-48 text-red-400" />
            : <AlertTriangle className="w-48 h-48 text-amber-400" />
          }
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${
            isApproved
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : isRejected
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            {isApproved && <><CheckCircle className="w-4 h-4" /> Application Approved</>}
            {isRejected && <><XCircle className="w-4 h-4" /> Application Rejected</>}
            {!isApproved && !isRejected && <><AlertTriangle className="w-4 h-4" /> Under Review</>}
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {isApproved && <>Congratulations! <br />Your loan has been approved.</>}
            {isRejected && <>We&apos;re sorry. <br />Your application was not approved.</>}
            {!isApproved && !isRejected && <>Your application is under review.</>}
          </h1>
          
          {isApproved && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 max-w-2xl">
              <div className="space-y-1">
                <p className="text-green-400/70 text-sm font-medium uppercase">Approved Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(loanAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-green-400/70 text-sm font-medium uppercase">Interest Rate</p>
                <p className="text-3xl font-bold">{interestRate} <span className="text-lg font-normal text-green-400/50">p.a.</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-green-400/70 text-sm font-medium uppercase">Composite Score</p>
                <p className="text-3xl font-bold">{Math.round(scoreData.composite ?? 0)}<span className="text-lg font-normal text-green-400/50">/100</span></p>
              </div>
            </div>
          )}

          {isRejected && (
            <p className="text-gray-300 mt-4 max-w-xl">
              Your composite score was {Math.round(scoreData.composite ?? 0)}/100. You may improve your profile and reapply after 90 days, or raise a grievance if you believe this is incorrect.
            </p>
          )}
        </div>
      </div>

      {/* Explainability Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Score Radar */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-white">
              <Rocket className="w-5 h-5 text-blue-400" /> AI Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center p-6">
            <ScoreRadar data={radarData} />
          </CardContent>
        </Card>

        {/* Right Column: PQ Badge */}
        <div className="flex flex-col justify-center">
          <PQBadge score={scoreData.pq ?? 0} overrideApplied={scoreData.pq_override ?? false} />
          <p className="mt-4 text-gray-400 text-sm text-center px-4">
            Our AI analyzed your academic trajectory and behavioral signals to determine your Potential Quotient.
            {scoreData.pq_override && ' Your exceptional PQ score boosted your eligibility to approved tier.'}
          </p>
          <div className="mt-4 px-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Risk Band</span>
              <span className={`font-bold ${
                scoreData.risk_band === 'LOW' ? 'text-green-400' :
                scoreData.risk_band === 'HIGH' ? 'text-red-400' : 'text-amber-400'
              }`}>{scoreData.risk_band ?? 'MEDIUM'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fraud Flag</span>
              <span className={`font-bold ${scoreData.fraud_flag ? 'text-red-400' : 'text-green-400'}`}>
                {scoreData.fraud_flag ? 'Flagged' : 'Clear'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disbursal Schedule */}
      {isApproved && schedule.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-400" /> Disbursal Schedule
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {schedule.map((item) => (
              <div 
                key={item.id ?? item.semester} 
                className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 group hover:border-gray-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-gray-700 text-xs font-bold px-2 py-1 rounded text-gray-300 uppercase">
                    Semester {item.semester}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    item.status === 'disbursed' ? 'bg-green-500/20 text-green-400' :
                    item.status === 'pending' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-700/50 text-gray-400'
                  }`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
                <div className="text-2xl font-bold mb-1">{formatCurrency(item.amount)}</div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {item.planned_date
                    ? new Date(item.planned_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                    : 'TBD'
                  }
                </div>
                {item.actual_date && item.status === 'disbursed' && (
                  <div className="text-xs text-green-400 mt-1">
                    Disbursed: {new Date(item.actual_date).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No disbursal schedule yet */}
      {isApproved && schedule.length === 0 && (
        <div className="p-6 rounded-2xl bg-gray-800/40 border border-gray-700 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Your disbursal schedule is being prepared...</p>
          <p className="text-gray-600 text-sm mt-1">Check back in a few minutes.</p>
        </div>
      )}

      {/* Matched Scholarships */}
      {scholarships.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-end">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <IndianRupee className="w-6 h-6 text-yellow-400" /> Matched Scholarships
            </h3>
            <p className="text-sm text-gray-400">Reduces your loan burden</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scholarships.map((scholarship) => (
              <div 
                key={scholarship.id}
                className="bg-gray-800/60 border-l-4 border-l-yellow-500 border-gray-700 rounded-lg p-6 flex flex-col md:flex-row justify-between items-center gap-6"
              >
                <div className="space-y-1 text-center md:text-left">
                  <h4 className="text-lg font-bold">{scholarship.name}</h4>
                  <p className="text-2xl text-yellow-400 font-bold">{formatCurrency(scholarship.amount)}</p>
                  {scholarship.deadline && (
                    <p className="text-xs text-gray-500">
                      Deadline: {new Date(scholarship.deadline).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 shrink-0"
                  onClick={() => router.push('/scholarships')}
                >
                  Apply Now <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Navigation */}
      <div className="pt-12 pb-8 flex flex-col sm:flex-row justify-center gap-4">
        {isRejected && (
          <Button
            onClick={() => router.push('/audit')}
            variant="outline"
            size="lg"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Raise a Grievance
          </Button>
        )}
        <Button 
          onClick={() => {
            resetStore();
            router.push('/dashboard');
          }}
          size="lg" 
          className="bg-white text-gray-900 hover:bg-gray-200 px-12 py-7 text-lg font-bold rounded-full transition-transform hover:scale-105"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
