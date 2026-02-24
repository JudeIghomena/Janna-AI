'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { profileApi } from '@/lib/api';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  User,
  Camera,
  Save,
  BarChart3,
  MessageSquare,
  FolderOpen,
  Zap,
  DollarSign,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  preferences: {
    theme?: string;
    defaultModel?: string;
  };
  stats: {
    conversations: number;
    projects: number;
    totalTokens: number;
    totalCost: number;
    totalRequests: number;
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className={cn('rounded-xl p-2.5', color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuthContext();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => profileApi.get() as Promise<UserProfile>,
    enabled: !!user,
  });

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      });
    }
  }, [profile]);

  const { mutate: updateProfile, isPending } = useMutation({
    mutationFn: (data: typeof form) => profileApi.update(data) as Promise<UserProfile>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const initials = (profile?.displayName ?? profile?.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
          {/* ── Header ── */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your personal information and preferences
            </p>
          </div>

          {/* ── Avatar + name ── */}
          <div className="flex items-center gap-6 rounded-2xl border border-border bg-surface p-6">
            <div className="relative">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt={initials}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full avatar-gradient flex items-center justify-center text-white text-2xl font-bold">
                  {initials}
                </div>
              )}
              <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-sm hover:bg-[var(--accent-hover)] transition-colors">
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {profile?.displayName ?? profile?.email?.split('@')[0]}
              </p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <span className="mt-1 inline-block rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)] capitalize">
                {profile?.role ?? 'user'}
              </span>
            </div>
          </div>

          {/* ── Stats ── */}
          {profile?.stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={MessageSquare}
                label="Conversations"
                value={profile.stats.conversations}
                color="bg-blue-500"
              />
              <StatCard
                icon={FolderOpen}
                label="Projects"
                value={profile.stats.projects}
                color="bg-purple-500"
              />
              <StatCard
                icon={Zap}
                label="Requests"
                value={profile.stats.totalRequests}
                color="bg-orange-500"
              />
              <StatCard
                icon={BarChart3}
                label="Tokens Used"
                value={profile.stats.totalTokens.toLocaleString()}
                color="bg-green-500"
              />
            </div>
          )}

          {/* ── Edit form ── */}
          <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Display Name
                </label>
                <input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder="Your display name"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Tell Janna AI a bit about yourself so it can tailor responses…"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Avatar URL
                </label>
                <input
                  value={form.avatarUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, avatarUrl: e.target.value }))
                  }
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <button
              onClick={() => updateProfile(form)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all',
                saved
                  ? 'bg-green-500'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]',
                isPending && 'opacity-70 cursor-not-allowed'
              )}
            >
              <Save className="h-4 w-4" />
              {saved ? 'Saved!' : isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {/* ── Danger zone ── */}
          <div className="rounded-2xl border border-destructive/30 bg-red-50 dark:bg-red-950/20 p-6">
            <h2 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button
              onClick={() =>
                alert(
                  'Account deletion is handled via your administrator. Please contact support.'
                )
              }
              className="rounded-xl border border-destructive px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive hover:text-white transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
