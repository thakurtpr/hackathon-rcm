'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  CloudUpload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  ShieldCheck,
  Zap,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type UploadState = 'idle' | 'uploading' | 'verifying' | 'success' | 'low_score';

export default function SemesterGatePage() {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation Logic
  useEffect(() => {
    if (uploadState === 'uploading') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploadState('verifying');
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
    
    if (uploadState === 'verifying') {
      const timeout = setTimeout(() => {
        // Randomly simulate success or low score (80% success for demo)
        const isSuccess = Math.random() > 0.2;
        setUploadState(isSuccess ? 'success' : 'low_score');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [uploadState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setUploadState('uploading');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
      setUploadState('uploading');
    }
  };

  const handleReset = () => {
     setUploadState('idle');
     setFile(null);
     setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 font-sans selection:bg-indigo-500/30 p-8 flex flex-col items-center">
      
      {/* Top Header & Navigation */}
      <div className="max-w-2xl w-full flex items-center justify-between mb-8">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-900 transition-colors group">
          <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-white" />
        </Link>
        <span className="text-xs font-black uppercase text-gray-500 tracking-[0.2em]">Semester Gate</span>
        <div className="w-9 h-9" /> {/* Spacer */}
      </div>

      <div className="max-w-2xl w-full space-y-8">
        {/* Header Section */}
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Semester 2 Verification</h1>
          <p className="text-gray-400 font-medium">Verify your Semester 1 academic performance to unlock next disbursal.</p>
        </header>

        {/* Warning Banner */}
        <div className="bg-amber-950/20 border-2 border-amber-500/30 rounded-2xl p-5 flex gap-4 items-start relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <AlertCircle className="w-16 h-16 text-amber-500" />
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 h-fit">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-1">
            <p className="text-amber-200 text-sm font-bold leading-relaxed">
              Upload your marksheet within 14 days to receive your next payment of ₹62,500.
            </p>
            <p className="text-[10px] text-amber-500/60 uppercase font-black tracking-widest">Urgent Requirement</p>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="bg-gray-900 border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
          <CardContent className="p-10">
            
            {uploadState === 'idle' && (
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-800 rounded-3xl p-12 flex flex-col items-center justify-center gap-6 hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] transition-all cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  hidden 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                
                <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
                  <CloudUpload className="w-10 h-10 text-indigo-400" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">Select Marksheet File</h3>
                  <p className="text-sm text-gray-500 font-medium tracking-wide">
                    Click or drag to upload <span className="text-gray-300">Marksheet (PDF/JPG)</span>
                  </p>
                </div>
                
                <div className="flex gap-4 mt-2">
                   <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-950 border border-gray-800 text-[10px] text-gray-500 font-black uppercase">
                      <ShieldCheck className="w-3 h-3" /> Secure
                   </div>
                   <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-950 border border-gray-800 text-[10px] text-gray-500 font-black uppercase">
                      <Zap className="w-3 h-3 text-amber-500" /> Instant
                   </div>
                </div>
              </div>
            )}

            {uploadState === 'uploading' && (
              <div className="py-12 space-y-8 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center animate-pulse">
                   <FileText className="w-8 h-8 text-indigo-400" />
                </div>
                
                <div className="w-full max-w-sm space-y-4">
                  <div className="flex justify-between text-xs font-black uppercase tracking-widest text-indigo-400">
                    <span>Uploading {file?.name}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-200" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-center text-gray-600 font-black uppercase">DO NOT REFRESH THIS PAGE</p>
                </div>
              </div>
            )}

            {uploadState === 'verifying' && (
              <div className="py-12 space-y-8 flex flex-col items-center">
                 <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                    <Loader2 className="w-20 h-20 text-indigo-400 animate-spin relative z-10" />
                 </div>
                 <div className="text-center space-y-3">
                   <h3 className="text-2xl font-black text-white">AI Verification in Progress</h3>
                   <p className="text-gray-400 text-sm font-medium">Scanning grades and authenticity using OCR technology...</p>
                 </div>
                 
                 <div className="bg-gray-950 border border-gray-800 rounded-2xl px-6 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-gray-500 whitespace-nowrap">Node #82 processing request</span>
                 </div>
              </div>
            )}

            {uploadState === 'success' && (
              <div className="py-8 space-y-8 flex flex-col items-center">
                 <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                 </div>
                 
                 <div className="text-center space-y-2">
                   <h3 className="text-3xl font-black text-white">Verification Success!</h3>
                   <p className="text-gray-400 font-medium">Marksheet verified with CGPA: <span className="text-white font-black">8.42</span></p>
                 </div>

                 <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-center w-full">
                    <p className="text-xs font-bold text-emerald-400 mb-1">PAYMENT INITIATED</p>
                    <p className="text-white font-black">₹62,500 will be credited in 24-48 hours.</p>
                 </div>

                 <div className="flex gap-4 w-full">
                    <Button 
                      asChild
                      className="flex-1 bg-white hover:bg-gray-100 text-gray-950 font-black py-6 rounded-2xl shadow-xl transition-all"
                    >
                      <Link href="/dashboard">Back to Dashboard</Link>
                    </Button>
                 </div>
              </div>
            )}

            {uploadState === 'low_score' && (
              <div className="py-8 space-y-8 flex flex-col items-center">
                 <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <TrendingDown className="w-12 h-12 text-red-400" />
                 </div>
                 
                 <div className="text-center space-y-2">
                   <h3 className="text-3xl font-black text-white">Action Required</h3>
                   <p className="text-gray-400 font-medium">Marksheet verified with GPA: <span className="text-red-400 font-black text-lg">6.2</span></p>
                 </div>

                 <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-200/80 leading-relaxed">
                        Your GPA is below the required 7.0 for this loan tier. Automated disbursal has been paused.
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 font-bold italic pl-8">Support has been notified to review your special case.</p>
                 </div>

                 <div className="flex flex-col gap-3 w-full">
                    <Button 
                      onClick={() => alert("Connecting with support agent...")}
                      className="w-full bg-gray-50 hover:bg-white text-gray-950 font-black py-6 rounded-2xl shadow-xl transition-all"
                    >
                      Speak with Advisor
                    </Button>
                    <button 
                      onClick={handleReset}
                      className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                    >
                      Re-upload (If incorrect file)
                    </button>
                 </div>
              </div>
            )}

          </CardContent>
        </Card>
        
        {/* Footer info */}
        <div className="text-center space-y-1">
           <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
             <ShieldCheck className="w-3 h-3" /> End-to-End Encrypted Verification
           </p>
        </div>
      </div>
    </div>
  );
}
