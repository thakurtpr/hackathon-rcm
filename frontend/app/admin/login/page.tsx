'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { adminLogin } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminLogin(email, password);
      sessionStorage.setItem('admin_token', res.access_token);
      router.replace('/admin/colleges');
    } catch {
      setError('Invalid admin credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 ring-1 ring-white/10">
            <LayoutDashboard size={30} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tighter text-white">
              ADMIN<span className="text-indigo-400">.</span>HACKFORGE
            </h1>
            <p className="text-xs text-gray-500 font-semibold mt-1 uppercase tracking-widest">Control Panel</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="p-8 pb-6 border-b border-gray-800/60">
            <h2 className="text-lg font-bold text-white">Sign in to Admin</h2>
            <p className="text-sm text-gray-500 mt-1">Use your admin credentials to continue</p>
          </div>

          {/* Default credentials hint */}
          <div className="mx-6 mt-5 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-400">Default Credentials</span>
            </div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 w-16 shrink-0">Email</span>
                <span className="text-gray-300 bg-gray-950/60 px-2 py-0.5 rounded-lg">admin@hackforge.in</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 w-16 shrink-0">Password</span>
                <span className="text-gray-300 bg-gray-950/60 px-2 py-0.5 rounded-lg">Admin@123</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 font-medium">
              Override with <code className="text-gray-500">ADMIN_EMAIL</code> / <code className="text-gray-500">ADMIN_PASSWORD</code> env vars.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={15} className="text-gray-600" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hackforge.in"
                  required
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-800 bg-gray-950/60 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={15} className="text-gray-600" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-10 pr-12 py-3 rounded-xl border border-gray-800 bg-gray-950/60 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Admin
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6 font-medium">
          Not an admin?{' '}
          <a href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">
            Go to user login
          </a>
        </p>
      </div>
    </div>
  );
}
