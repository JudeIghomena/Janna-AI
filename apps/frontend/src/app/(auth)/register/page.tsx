'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Stage = 'register' | 'confirm';

export default function RegisterPage() {
  const { signUp, confirmCode, signIn, error, loading } = useAuthContext();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      const result = await signUp(email, password);
      // In dev mode signUp also signs in — skip confirmation and go home
      if ((result as { isSignUpComplete?: boolean })?.isSignUpComplete) {
        router.replace('/');
      } else {
        setStage('confirm');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      await confirmCode(email, code);
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Confirmation failed');
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join Janna AI today
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {stage === 'register' ? (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />

              {displayError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">
                  {displayError}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Create account
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="flex flex-col gap-3">
              <p className="text-center text-sm text-muted-foreground">
                Enter the 6-digit code sent to{' '}
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <Input
                label="Verification code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                required
                autoFocus
                maxLength={6}
              />

              {displayError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {displayError}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Verify & sign in
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
