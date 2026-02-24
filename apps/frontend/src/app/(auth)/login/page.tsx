'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Stage = 'signin' | 'confirm';

export default function LoginPage() {
  const { signIn, confirmCode, resendCode, error, loading } = useAuthContext();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      if (msg.includes('not confirmed')) {
        setStage('confirm');
      } else {
        setLocalError(msg);
      }
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
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Janna AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your context-aware AI workspace
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {stage === 'signin' ? (
            <>
              <h2 className="mb-4 text-center text-base font-semibold text-foreground">
                Sign in to your account
              </h2>

              <form onSubmit={handleSignIn} className="flex flex-col gap-3">
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

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute bottom-2 right-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {displayError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400">
                    {displayError}
                  </p>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  Sign in
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="text-blue-600 hover:underline"
                >
                  Create one
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-center text-base font-semibold text-foreground">
                Confirm your email
              </h2>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                We sent a code to{' '}
                <span className="font-medium text-foreground">{email}</span>
              </p>

              <form onSubmit={handleConfirm} className="flex flex-col gap-3">
                <Input
                  label="Verification code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
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
                  Confirm
                </Button>

                <button
                  type="button"
                  onClick={() => resendCode(email)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Resend code
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
