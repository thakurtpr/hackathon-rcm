import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  userId: string | null;
  intent: 'loan' | 'scholarship' | 'both' | null;
  kycStatus: string | null;
  isAuthenticated: boolean;
  login: (token: string, userData: User, intent?: string, kycStatus?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      userId: null,
      intent: null,
      kycStatus: null,
      isAuthenticated: false,
      login: (token, userData, intent, kycStatus) =>
        set({
          accessToken: token,
          user: userData,
          userId: userData.id,
          intent: (intent as AuthState['intent']) || 'loan',
          kycStatus: kycStatus || 'pending',
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          accessToken: null,
          user: null,
          userId: null,
          intent: null,
          kycStatus: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
