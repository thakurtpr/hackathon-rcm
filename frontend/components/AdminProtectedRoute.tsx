'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (!token) {
      setChecked(true);
      setValid(false);
      return;
    }
    // Basic expiry check by decoding the JWT payload (no crypto verify needed — server enforces)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem('admin_token');
        setValid(false);
      } else {
        setValid(true);
      }
    } catch {
      sessionStorage.removeItem('admin_token');
      setValid(false);
    }
    setChecked(true);
  }, []);

  useEffect(() => {
    if (checked && !valid) router.replace('/admin/login');
  }, [checked, valid, router]);

  if (!checked || !valid) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
        <p className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] animate-pulse">
          Verifying Admin Session...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
