'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode,
} from 'aws-amplify/auth';
import { setApiToken } from '@/lib/api';
import type { AuthUser } from '@/types';

// ─── Dev auth helpers ──────────────────────────────────────────────────────────
// When NEXT_PUBLIC_DEV_AUTH=true the backend accepts tokens shaped
// "dev:<userId>:<email>" without hitting Cognito at all.

const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';
const DEV_SESSION_KEY = 'janna_dev_session';

function makeDevToken(email: string): string {
  // Stable deterministic userId from email (simple hash — not cryptographic)
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (Math.imul(31, hash) + email.charCodeAt(i)) | 0;
  }
  const userId = `dev-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  return `dev:${userId}:${email}`;
}

interface DevSession {
  token: string;
  email: string;
  userId: string;
}

function saveDevSession(token: string, email: string) {
  const userId = token.split(':')[1];
  localStorage.setItem(DEV_SESSION_KEY, JSON.stringify({ token, email, userId }));
}

function loadDevSession(): DevSession | null {
  try {
    const raw = localStorage.getItem(DEV_SESSION_KEY);
    return raw ? (JSON.parse(raw) as DevSession) : null;
  } catch {
    return null;
  }
}

function clearDevSession() {
  localStorage.removeItem(DEV_SESSION_KEY);
}

// ─── Auth State ────────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // ── Dev mode: restore session from localStorage ──────────────────────────────
  const loadDevUser = useCallback(() => {
    const session = loadDevSession();
    if (session) {
      const user: AuthUser = {
        id: session.userId,
        email: session.email,
        role: 'user',
        token: session.token,
      };
      setApiToken(session.token);
      setState({ user, loading: false, error: null });
    } else {
      setApiToken(null);
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  // ── Cognito mode: resolve from Amplify session ───────────────────────────────
  const loadCognitoUser = useCallback(async () => {
    try {
      const cognitoUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? '';
      const payload = session.tokens?.idToken?.payload;

      const user: AuthUser = {
        id: cognitoUser.userId,
        email: (payload?.email as string) ?? cognitoUser.username,
        role: ((payload?.['cognito:groups'] as string[]) ?? []).includes('admin')
          ? 'admin'
          : 'user',
        token,
      };

      setApiToken(token);
      setState({ user, loading: false, error: null });
    } catch {
      setApiToken(null);
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const loadUser = DEV_AUTH ? loadDevUser : loadCognitoUser;

  useEffect(() => {
    if (DEV_AUTH) {
      loadDevUser();
    } else {
      loadCognitoUser();
    }
  }, [loadDevUser, loadCognitoUser]);

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (DEV_AUTH) {
        // Any password accepted in dev mode — backend doesn't verify it
        const token = makeDevToken(email);
        saveDevSession(token, email);
        loadDevUser();
      } else {
        await amplifySignIn({ username: email, password });
        await loadCognitoUser();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  };

  // ── Sign up ──────────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (DEV_AUTH) {
        // Dev sign-up immediately signs in — no email confirmation needed
        const token = makeDevToken(email);
        saveDevSession(token, email);
        loadDevUser();
        return { isSignUpComplete: true };
      }
      const result = await amplifySignUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setState((s) => ({ ...s, loading: false }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  };

  // ── Confirm code (Cognito only — no-op in dev) ───────────────────────────────
  const confirmCode = async (email: string, code: string) => {
    if (DEV_AUTH) return;
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      setState((s) => ({ ...s, error: message }));
      throw err;
    }
  };

  // ── Resend code (Cognito only — no-op in dev) ────────────────────────────────
  const resendCode = async (email: string) => {
    if (DEV_AUTH) return;
    try {
      await resendSignUpCode({ username: email });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resend failed';
      setState((s) => ({ ...s, error: message }));
      throw err;
    }
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      if (DEV_AUTH) {
        clearDevSession();
        setApiToken(null);
        setState({ user: null, loading: false, error: null });
      } else {
        await amplifySignOut();
        setApiToken(null);
        setState({ user: null, loading: false, error: null });
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.role === 'admin',
    signIn,
    signUp,
    confirmCode,
    resendCode,
    signOut,
    refresh: loadUser,
  };
}
