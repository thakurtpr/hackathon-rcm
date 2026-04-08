'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { loginUser, verifyOTP } from '@/lib/api';

// --- Zod Schema ---
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [apiError, setApiError] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError('');
    try {
      const res = await loginUser({ email: data.email, password: data.password });
      login(res.access_token, { id: res.user_id, name: data.email });
      if (typeof window !== 'undefined') sessionStorage.setItem('user_id', res.user_id);
      router.push('/chat');
    } catch (err: unknown) {
      const errData = (err as { response?: { status?: number; data?: { error?: string; otp_token?: string; user_id?: string } } })?.response;
      if (errData?.status === 403 && errData?.data?.otp_token) {
        setOtpToken(errData.data.otp_token);
        setPendingUserId(errData.data.user_id || '');
        setOtpStep(true);
        setApiError('');
        return;
      }
      const msg = errData?.data?.error || 'Invalid credentials';
      setApiError(msg);
    }
  };

  const handleVerifyOTP = async () => {
    setApiError('');
    try {
      const res = await verifyOTP({ otp_token: otpToken, otp_code: otpCode });
      login(res.access_token, { id: res.user_id || pendingUserId, name: '' });
      if (typeof window !== 'undefined') sessionStorage.setItem('user_id', res.user_id || pendingUserId);
      router.push('/onboarding');
    } catch {
      setApiError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-sans selection:bg-indigo-500/30">
      {/* Background Orbs for Rich Aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[20%] w-[35rem] h-[35rem] bg-sky-200/20 dark:bg-sky-900/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="w-full max-w-lg relative">
        {/* Card Container */}
        <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Header Section */}
          <div className="p-8 pb-4 text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
              <LogIn className="h-8 w-8 text-indigo-400" />
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="mt-3 text-gray-400 font-medium">Please enter your details to sign in</p>
          </div>

          {apiError && (
            <div className="mx-8 mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {apiError}
            </div>
          )}

          {otpStep ? (
            <div className="p-8 pt-4 space-y-5">
              <p className="text-gray-400 text-sm">Your account is not yet verified. A new OTP has been sent to your email. Check your inbox or the backend console log for the OTP.</p>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="block w-full px-4 py-3 rounded-xl border border-gray-800 bg-gray-950/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={handleVerifyOTP}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-all"
              >
                Verify OTP
              </button>
            </div>
          ) : (
          <>
          {/* Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 pt-4 space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors duration-200" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={`block w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-800 bg-gray-950/50 text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all duration-300 ${errors.email ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs font-medium text-red-500 mt-1.5 ml-1">{errors.email.message}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-semibold text-gray-300">Password</label>
                <Link href="#" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
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
                  className={`block w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-800 bg-gray-950/50 text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all duration-300 ${errors.password ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.password && <p className="text-xs font-medium text-red-500 mt-1.5 ml-1">{errors.password.message}</p>}
            </div>

            {/* Remember Me Toggle (Optional Aesthetic Addition) */}
            <div className="flex items-center gap-3 ml-1">
              <input type="checkbox" id="remember" className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer" />
              <label htmlFor="remember" className="text-sm font-medium text-gray-400 cursor-pointer select-none">Remember for 30 days</label>
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
          </>
          )}

          {/* Footer Section */}
          <div className="p-8 pt-0 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-900 px-4 text-gray-500 font-bold tracking-widest">Or</span>
              </div>
            </div>

            <p className="text-sm text-gray-400 font-medium">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-all decoration-2 underline-offset-4"
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
