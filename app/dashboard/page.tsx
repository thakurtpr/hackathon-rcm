'use client';

import React from 'react';
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
  Search,
  Bell,
  User,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const scholarships = [
    { id: 1, title: "Sitaram Jindal Scholarship", amount: "₹25,000", match: "95%" },
    { id: 2, title: "HDFC Badhte Kadam", amount: "₹45,000", match: "88%" }
  ];

  const timelineSteps = [
    { 
      semester: "Semester 1", 
      status: "Completed", 
      amount: "₹62,500", 
      date: "Paid on Aug 15, 2025",
      type: "completed" 
    },
    { 
      semester: "Semester 2", 
      status: "Current - Awaiting Marksheet", 
      amount: "₹62,500", 
      date: "Due by Jan 20, 2026",
      type: "current" 
    },
    { 
      semester: "Semester 3", 
      status: "Locked", 
      amount: "₹62,500", 
      date: "Tentative Aug 2026",
      type: "locked" 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">StudentPortal</span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
                <Search className="w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search..." className="bg-transparent border-none focus:ring-0 text-sm w-32" />
             </div>
             <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-gray-950"></span>
             </button>
             <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-400" />
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Header Section */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
            Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">Student</span>
          </h1>
          <p className="text-gray-400 text-lg font-medium">
            You're currently in your 2nd Semester. Everything looks on track for your next disbursal.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Loan Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="md:col-span-3 bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                    <IndianRupee className="w-48 h-48 -rotate-12" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-indigo-400 mb-6">
                      <TrendingUp className="w-5 h-5" />
                      <span className="text-sm font-bold uppercase tracking-wider">Loan Performance Overview</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <p className="text-gray-500 text-sm font-semibold mb-1">Total Approved</p>
                        <p className="text-4xl font-black text-white">₹5,00,000</p>
                      </div>
                      <div className="border-l-0 md:border-l border-gray-800 md:pl-8">
                        <p className="text-gray-500 text-sm font-semibold mb-1">Disbursed So Far</p>
                        <p className="text-4xl font-black text-emerald-400">₹62,500</p>
                      </div>
                      <div className="border-l-0 md:border-l border-gray-800 md:pl-8">
                        <p className="text-gray-500 text-sm font-semibold mb-1">Remaining</p>
                        <p className="text-4xl font-black text-indigo-400">₹4,37,500</p>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-gray-800">
                       <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
                          <span>Disbursal Progress</span>
                          <span>12.5%</span>
                       </div>
                       <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[12.5%] rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                       </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Disbursal Timeline */}
            <Card className="bg-gray-900 border-gray-800 rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-gray-800 px-8 py-6">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  Disbursal Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="relative space-y-12">
                  {/* Vertical Line */}
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-800" />
                  
                  {timelineSteps.map((step, idx) => (
                    <div key={idx} className="relative flex gap-8 group">
                      {/* Icon Node */}
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-gray-900 shadow-xl ${
                        step.type === 'completed' ? 'bg-emerald-500 text-white' : 
                        step.type === 'current' ? 'bg-amber-500 text-white animate-pulse' : 
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {step.type === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                         step.type === 'current' ? <AlertCircle className="w-5 h-5" /> : 
                         <Lock className="w-5 h-5" />}
                      </div>

                      <div className="flex-1 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                          <h4 className={`text-lg font-bold ${
                            step.type === 'locked' ? 'text-gray-500' : 'text-white'
                          }`}>{step.semester}</h4>
                          <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                             step.type === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                             step.type === 'current' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                             'bg-gray-800 text-gray-500'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-2xl font-black text-gray-300 mb-1">
                           <IndianRupee className="w-5 h-5" />
                           {step.amount}
                        </div>
                        <p className="text-sm text-gray-500 font-medium">{step.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            
            {/* ACTION REQUIRED Card */}
            <div className="bg-amber-900/10 border border-amber-500/30 rounded-3xl p-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <AlertCircle className="w-20 h-20 text-amber-500 rotate-12" />
               </div>
               
               <div className="relative z-10">
                  <div className="flex items-center gap-2 text-amber-500 mb-4">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-widest">Immediate Action Required</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">Semester 2 Verification</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8">
                    Upload your Semester 1 marksheet to unlock your next disbursal of <span className="text-white font-bold">₹62,500</span>. Our AI will verify it instantly.
                  </p>
                  
                  <Button 
                    onClick={() => alert("Opens upload modal")}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-black py-6 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
                  >
                    Upload Marksheet
                  </Button>
               </div>
            </div>

            {/* Matched Scholarships Card */}
            <Card className="bg-gray-900 border-gray-800 rounded-3xl overflow-hidden">
               <CardHeader className="px-6 py-6 border-b border-gray-800">
                  <CardTitle className="text-lg font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                       <GraduationCap className="w-5 h-5 text-indigo-400" />
                       AI Match Prep
                    </span>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">NEW</span>
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <div className="space-y-4">
                     {scholarships.map(scholarship => (
                        <div key={scholarship.id} className="p-4 rounded-2xl bg-gray-950 border border-gray-800 hover:border-gray-700 transition-colors group">
                           <div className="flex justify-between items-start mb-2">
                              <h5 className="font-bold text-sm text-gray-200 group-hover:text-indigo-400 transition-colors">{scholarship.title}</h5>
                              <span className="text-[10px] font-black text-emerald-400">{scholarship.match} Match</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <p className="text-lg font-black text-white">{scholarship.amount}</p>
                              <button className="text-xs font-bold text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all">
                                 Apply <ChevronRight className="w-3 h-3" />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
                  
                  <button className="w-full mt-6 text-xs font-bold text-gray-500 hover:text-white flex items-center justify-center gap-2 transition-colors">
                     View All Scholarships <ExternalLink className="w-3 h-3" />
                  </button>
               </CardContent>
            </Card>

            {/* Support Widget */}
            <div className="p-6 rounded-3xl border border-gray-800 bg-gray-900/50 flex items-center justify-between group cursor-pointer hover:bg-gray-900 transition-all">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                     <GraduationCap className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-white">Need Help?</p>
                     <p className="text-xs text-gray-500">Chat with AI Support</p>
                  </div>
               </div>
               <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-all transform group-hover:translate-x-1" />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
