'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { 
  Loader2, 
  Wallet, 
  GraduationCap, 
  School, 
  Building2, 
  Calendar, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  BrainCircuit
} from 'lucide-react';

const applicationSchema = z.object({
  loanAmount: z.number().min(1000, 'Minimum loan amount is 1000').max(500000, 'Maximum loan amount reached'),
  purpose: z.string().min(1, 'Please select a purpose'),
  university: z.string().min(3, 'University name is required'),
  course: z.string().min(2, 'Course name is required'),
  yearOfCompletion: z.string().regex(/^\d{4}$/, 'Enter a valid year'),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

export default function ApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      loanAmount: 10000,
    }
  });

  const loanAmount = watch('loanAmount');

  const onSubmit = async (data: ApplicationFormValues) => {
    console.log('Application submitted:', data);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    router.push('/assessment');
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 font-sans selection:bg-indigo-100 selection:text-indigo-700 pb-20">
      {/* Navbar Overlay */}
      <div className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">LendAI</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-40 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500" 
                  style={{ width: `${(step / 3) * 100}%` }}
                />
             </div>
             <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">STEP {step} / 3</span>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto mt-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">Loan Application</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">Complete the details below to begin your AI-powered assessment.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Loan Amount */}
          {step === 1 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
                  <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">How much do you need?</h3>
              </div>

              <div className="space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">$</span>
                  <span className="text-6xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
                    {loanAmount.toLocaleString()}
                  </span>
                </div>

                <input
                  type="range"
                  min="1000"
                  max="500000"
                  step="1000"
                  value={loanAmount}
                  onChange={(e) => setValue('loanAmount', parseInt(e.target.value))}
                  className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-600 transition-all hover:accent-indigo-700"
                />

                <div className="flex justify-between text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  <span>$1,000</span>
                  <span>$500,000</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Loan Purpose</label>
                <select
                  {...register('purpose')}
                  className="w-full p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                >
                  <option value="">Select a purpose</option>
                  <option value="tuition">Tuition Fees</option>
                  <option value="living">Living Expenses</option>
                  <option value="supplies">Study Supplies</option>
                  <option value="other">Other</option>
                </select>
                {errors.purpose && <p className="text-xs text-red-500 font-medium ml-1">{errors.purpose.message}</p>}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <span>Continue to Academic Info</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* Step 2: Academic Details */}
          {step === 2 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                  <GraduationCap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Academic Profile</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">University Name</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      {...register('university')}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                      placeholder="e.g. Stanford University"
                    />
                  </div>
                  {errors.university && <p className="text-xs text-red-500 font-medium ml-1">{errors.university.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Course of Study</label>
                  <div className="relative group">
                    <School className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      {...register('course')}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                      placeholder="e.g. Computer Science"
                    />
                  </div>
                  {errors.course && <p className="text-xs text-red-500 font-medium ml-1">{errors.course.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">Completion Year</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      {...register('yearOfCompletion')}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                      placeholder="e.g. 2027"
                    />
                  </div>
                  {errors.yearOfCompletion && <p className="text-xs text-red-500 font-medium ml-1">{errors.yearOfCompletion.message}</p>}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-4 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Review Application</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30">
                  <CheckCircle2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Review & Submit</h3>
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50">
                <div>
                  <dt className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Loan Amount</dt>
                  <dd className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">${loanAmount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Purpose</dt>
                  <dd className="text-lg font-bold text-zinc-900 dark:text-zinc-50 capitalize">{watch('purpose') || 'Not selected'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">University</dt>
                  <dd className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{watch('university') || 'Not entered'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Course</dt>
                  <dd className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{watch('course') || 'Not entered'}</dd>
                </div>
              </dl>

              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 flex gap-4">
                <BrainCircuit className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-sm text-indigo-950 dark:text-indigo-200 leading-relaxed italic">
                  "Our AI engine will analyze your academic profile and loan amount to provide an instant approval decision and customized interest rate."
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-4 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit for AI Assessment</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
