'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  BarChart3,
  DollarSign,
  MessageSquare,
  Shield,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatNumber } from '@/lib/utils';

export default function AdminPage() {
  const { isAdmin } = useAuthContext();
  const [userSearch, setUserSearch] = useState('');
  const qc = useQueryClient();

  const { data: metrics } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => adminApi.metrics(),
    enabled: isAdmin,
  });

  const { data: users } = useQuery({
    queryKey: ['admin', 'users', userSearch],
    queryFn: () => adminApi.users({ search: userSearch || undefined }),
    enabled: isAdmin,
  });

  const { mutate: disableUser, isPending: disabling } = useMutation({
    mutationFn: (id: string) => adminApi.disableUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const { mutate: enableUser, isPending: enabling } = useMutation({
    mutationFn: (id: string) => adminApi.enableUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Shield className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Admin access required
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const statCards = [
    {
      icon: Users,
      label: 'Total users',
      value: formatNumber(metrics?.totalUsers ?? 0),
      sub: `${metrics?.activeUsers24h ?? 0} active today`,
    },
    {
      icon: MessageSquare,
      label: 'Messages',
      value: formatNumber(metrics?.totalMessages ?? 0),
      sub: `in ${formatNumber(metrics?.totalConversations ?? 0)} conversations`,
    },
    {
      icon: BarChart3,
      label: 'Total tokens',
      value: formatNumber(metrics?.totalTokensUsed ?? 0),
      sub: 'across all users',
    },
    {
      icon: DollarSign,
      label: 'Est. cost',
      value: `$${(metrics?.estimatedCostUsd ?? 0).toFixed(2)}`,
      sub: 'all time',
    },
  ];

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-xl font-semibold text-foreground">
          Admin Dashboard
        </h1>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {s.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Top models */}
        {metrics?.topModels && metrics.topModels.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Top models
            </h2>
            <div className="flex flex-wrap gap-2">
              {metrics.topModels.map((m) => (
                <div
                  key={m.modelId}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <span className="text-sm text-foreground">{m.modelId}</span>
                  <Badge variant="info">{m.count} calls</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User management */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Users</h2>
            <div className="w-64">
              <Input
                placeholder="Search by email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Messages
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.data.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 text-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={u.role === 'admin' ? 'warning' : 'default'}
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.messageCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.disabled ? 'error' : 'success'}>
                        {u.disabled ? 'Disabled' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {u.disabled ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => enableUser(u.id)}
                            loading={enabling}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Enable
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              if (
                                confirm(
                                  `Disable ${u.email}? They won't be able to access Janna AI.`
                                )
                              ) {
                                disableUser(u.id);
                              }
                            }}
                            loading={disabling}
                            disabled={u.role === 'admin'}
                          >
                            <Ban className="h-3 w-3" />
                            Disable
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!users?.data || users.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
