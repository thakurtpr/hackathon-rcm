import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  userId: string | null;
  intent: 'loan' | 'scholarship' | 'both' | null;
  kycStatus: string | null;
  isAuthenticated: boolean;
  login: (token: string, userData: User, intent?: string, kycStatus?: string, refreshToken?: string) => void;
  setRefreshToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      userId: null,
      intent: null,
      kycStatus: null,
      isAuthenticated: false,
      login: (token, userData, intent, kycStatus, refreshToken) =>
        set((state) => ({
          accessToken: token,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          user: userData,
          userId: userData.id,
          intent: intent ? (intent as AuthState['intent']) : state.intent,
          kycStatus: kycStatus || state.kycStatus || 'pending',
          isAuthenticated: true,
        })),
      setRefreshToken: (token) => set({ refreshToken: token }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
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
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        userId: state.userId,
        intent: state.intent,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
