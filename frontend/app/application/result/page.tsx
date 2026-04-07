'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEligibilityScore, getDisbursalSchedule, getMatchedScholarships } from '@/lib/api';
import ScoreRadar from '@/components/result/ScoreRadar';
import PQBadge from '@/components/result/PQBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, Calendar, IndianRupee, Rocket, ArrowRight } from 'lucide-react';

export default function ResultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [score, flow, grants] = await Promise.all([
          getEligibilityScore('app-123'),
          getDisbursalSchedule('app-123'),
          getMatchedScholarships('app-123')
        ]);
        
        setScoreData(score);
        setSchedule(flow);
        setScholarships(grants);
      } catch (error) {
        console.error("Failed to fetch application results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-12 space-y-8 animate-in fade-in duration-700">
      {/* Hero Banner */}
      <div className="bg-green-900/30 border border-green-500/50 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <CheckCircle className="w-48 h-48 text-green-400" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium border border-green-500/30">
            <CheckCircle className="w-4 h-4" /> Application Approved
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Congratulations! <br /> Your loan has been approved.
          </h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 max-w-2xl">
            <div className="space-y-1">
              <p className="text-green-400/70 text-sm font-medium uppercase">Approved Amount</p>
              <p className="text-4xl font-bold">{formatCurrency(scoreData.approvedAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-green-400/70 text-sm font-medium uppercase">Interest Rate</p>
              <p className="text-4xl font-bold">{scoreData.interestRate} <span className="text-lg font-normal text-green-400/50">p.a.</span></p>
            </div>
          </div>
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
            <ScoreRadar data={scoreData.radarData} />
          </CardContent>
        </Card>

        {/* Right Column: PQ Badge */}
        <div className="flex flex-col justify-center">
          <PQBadge score={scoreData.pqScore} overrideApplied={scoreData.overrideApplied} />
          <p className="mt-4 text-gray-400 text-sm text-center px-4">
            Our AI analyzed your academic trajectory and behavioral signals to determine your Potential Quotient. 
            Your drive and consistency have earned you a premium eligibility tier.
          </p>
        </div>
      </div>

      {/* Disbursal Schedule */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-indigo-400" /> Disbursal Schedule
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {schedule.map((item) => (
            <div 
              key={item.semester} 
              className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 group hover:border-gray-500 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="bg-gray-700 text-xs font-bold px-2 py-1 rounded text-gray-300 uppercase">
                  Semester {item.semester}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  item.status === 'pending' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(item.amount)}</div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {new Date(item.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matched Scholarships */}
      <div className="space-y-4 pt-4">
        <div className="flex justify-between items-end">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-yellow-400" /> Matched Scholarships
          </h3>
          <p className="text-sm text-gray-400">Add to your loan for 0% repayment burden</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {scholarships.map((scholarship) => (
            <div 
              key={scholarship.id}
              className="bg-gray-800/60 border-l-4 border-l-yellow-500 border-gray-700 rounded-lg p-6 flex flex-col md:flex-row justify-between items-center gap-6"
            >
              <div className="space-y-1 text-center md:text-left">
                <h4 className="text-lg font-bold">{scholarship.name}</h4>
                <p className="text-2xl text-yellow-400 font-bold">{formatCurrency(scholarship.amount)}</p>
                <p className="text-xs text-gray-500">Deadline: {new Date(scholarship.deadline).toLocaleDateString()}</p>
              </div>
              <Button variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 shrink-0">
                Apply Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Final Navigation */}
      <div className="pt-12 pb-8 flex justify-center">
        <Button 
          onClick={() => router.push('/dashboard')}
          size="lg" 
          className="bg-white text-gray-900 hover:bg-gray-200 px-12 py-7 text-lg font-bold rounded-full transition-transform hover:scale-105"
        >
          Go to Student Dashboard
        </Button>
      </div>
    </div>
  );
}
