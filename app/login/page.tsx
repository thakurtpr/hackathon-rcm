'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

// --- Zod Schema ---
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log('Login attempt:', data.email, 'Password:', data.password);
    
    // Simulate API call with a 2-second delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Successful "login" navigation
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-zinc-950 p-4 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Background Orbs for Rich Aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[20%] w-[35rem] h-[35rem] bg-sky-200/20 dark:bg-sky-900/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Card Container */}
        <div className="bg-white/80 dark:bg-zinc-900/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-200/50 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
          {/* Header Section */}
          <div className="p-8 pb-4 text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-900/50">
              <LogIn className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Welcome Back</h2>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400 font-medium">Please enter your details to sign in</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 pt-4 space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@email.com"
                  autoComplete="email"
                  className={`block w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all duration-300 ${errors.email ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs font-medium text-red-500 mt-1.5 ml-1">{errors.email.message}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Password</label>
                <Link href="#" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`block w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all duration-300 ${errors.password ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.password && <p className="text-xs font-medium text-red-500 mt-1.5 ml-1">{errors.password.message}</p>}
            </div>

            {/* Remember Me Toggle (Optional Aesthetic Addition) */}
            <div className="flex items-center gap-3 ml-1">
              <input type="checkbox" id="remember" className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer" />
              <label htmlFor="remember" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">Remember for 30 days</label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Footer Section */}
          <div className="p-8 pt-0 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-900 px-4 text-zinc-500 font-bold tracking-widest">Or</span>
              </div>
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold hover:underline transition-all decoration-2 underline-offset-4"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Optional Footer Text */}
        <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600 font-medium">
          © 2026 AI Student Loan System. Secure & Encrypted.
        </p>
      </div>
    </div>
  );
}
