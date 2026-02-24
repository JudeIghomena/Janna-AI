'use client';

import { createContext, useContext, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/types';

// Configure Amplify only when real Cognito credentials are present.
// When NEXT_PUBLIC_DEV_AUTH=true the app uses the backend dev bypass instead.
const isDev = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';
if (typeof window !== 'undefined' && !isDev) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
        loginWith: { email: true },
        signUpVerificationMethod: 'code',
      },
    },
  });
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<unknown>;
  confirmCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
