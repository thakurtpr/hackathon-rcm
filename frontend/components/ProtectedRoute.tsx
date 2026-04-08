'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);

  // One-time session validation on mount.
  // Reads sessionStorage directly to bypass zustand's async persist rehydration timing.
  useEffect(() => {
    const runCheck = async () => {
      // Step 1: synchronous sessionStorage read — no zustand race condition
      const raw = window.sessionStorage.getItem('auth-storage');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
          if (parsed?.state?.accessToken) {
            setSessionValid(true);
            setAuthChecked(true);
            return;
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      // Step 2: attempt silent token refresh
      const refreshToken =
        useAuthStore.getState().refreshToken ||
        window.sessionStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/backend';
          const resp = await fetch(`${apiBase}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { access_token: string; refresh_token?: string };
            const s = useAuthStore.getState();
            s.login(
              data.access_token,
              s.user || { id: s.userId || '', name: '' },
              s.intent ?? undefined,
              s.kycStatus ?? undefined,
              data.refresh_token,
            );
            setSessionValid(true);
            setAuthChecked(true);
            return;
          }
        } catch {
          // refresh failed — fall through
        }
      }

      // Step 3: no valid session found
      setSessionValid(false);
      setAuthChecked(true);
    };

    runCheck();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect once session is confirmed invalid
  useEffect(() => {
    if (authChecked && !sessionValid) {
      router.replace('/login');
    }
  }, [authChecked, sessionValid, router]);

  // Live logout detection: re-check sessionStorage whenever isAuthenticated changes
  useEffect(() => {
    if (!authChecked || !sessionValid) return;
    const raw = window.sessionStorage.getItem('auth-storage');
    if (!raw) {
      setSessionValid(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
      if (!parsed?.state?.accessToken) {
        setSessionValid(false);
      }
    } catch {
      setSessionValid(false);
    }
  }, [isAuthenticated, authChecked, sessionValid]);

  if (!authChecked || !sessionValid) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
        <p className="text-gray-400 font-medium animate-pulse uppercase tracking-[0.2em] text-xs">
          Verifying Session...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
