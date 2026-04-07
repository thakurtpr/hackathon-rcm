'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, User, Phone, Mail, Calendar, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { registerUser, verifyOTP } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// --- Zod Schema ---
const registerSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number. Must be 10 digits starting with 6-9'),
  email: z.string().email('Invalid email address'),
  dob: z.string().refine((val) => {
    const dob = new Date(val);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 16;
  }, 'You must be at least 16 years old'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine((val) => /[0-9]/.test(val), 'Password must contain at least one number')
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [apiError, setApiError] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setApiError('');
    try {
      const res = await registerUser({
        full_name: data.fullName,
        mobile: data.mobile,
        email: data.email,
        dob: data.dob,
        password: data.password,
        intent: 'loan',
      });
      setUserId(res.user_id);
      setOtpToken(res.otp_token);
      setOtpStep(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed';
      setApiError(msg);
    }
  };

  const handleVerifyOTP = async () => {
    setApiError('');
    try {
      const res = await verifyOTP({ otp_token: otpToken, otp_code: otpCode });
      login(res.access_token, { id: res.user_id, name: '' });
      if (typeof window !== 'undefined') sessionStorage.setItem('user_id', res.user_id);
      router.push('/onboarding');
    } catch {
      setApiError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-lg relative">
        {/* Card */}
        <div className="bg-gray-900 shadow-2xl border border-gray-800 rounded-3xl overflow-hidden backdrop-blur-sm">
          <div className="p-8 pb-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">Create Your Account</h2>
            <p className="mt-2 text-gray-400 font-medium">Join our AI-powered student loan platform today.</p>
          </div>

          {apiError && (
            <div className="mx-8 mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {apiError}
            </div>
          )}

          {otpStep ? (
            <div className="p-8 pt-4 space-y-5">
              <p className="text-gray-400 text-sm">Enter the 6-digit OTP sent to your mobile. (Dev: use 123456)</p>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="block w-full px-4 py-3 rounded-xl border border-gray-800 bg-gray-950/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button onClick={handleVerifyOTP} className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-all">
                Verify OTP
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 pt-4 space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-300 ml-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="John Doe"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-800 bg-gray-950/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.fullName ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.fullName && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.fullName.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Mobile */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Mobile Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    {...register('mobile')}
                    type="tel"
                    placeholder="9123456789"
                    className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.mobile ? 'border-red-500/50 ring-red-500/10' : ''}`}
                  />
                </div>
                {errors.mobile && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.mobile.message}</p>}
              </div>

              {/* DOB */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Date of Birth</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    {...register('dob')}
                    type="date"
                    className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-800 bg-gray-950/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.dob ? 'border-red-500/50 ring-red-500/10' : ''}`}
                  />
                </div>
                {errors.dob && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.dob.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@email.com"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.email ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.password ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.password && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheck className="h-4 w-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 ${errors.confirmPassword ? 'border-red-500/50 ring-red-500/10' : ''}`}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          )}

          <div className="p-8 pt-2 text-center">
            <p className="text-sm text-gray-400 font-medium">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors decoration-2 underline-offset-4"
              >
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
