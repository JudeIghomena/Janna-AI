"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminPage() {
  const qc = useQueryClient();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: adminApi.getMetrics,
    refetchInterval: 30_000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.getUsers({ pageSize: 50 }),
  });

  const disableMutation = useMutation({
    mutationFn: adminApi.disableUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const enableMutation = useMutation({
    mutationFn: adminApi.enableUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const metricCards = metrics
    ? [
        { label: "Total Users", value: metrics.totalUsers },
        { label: "Active Today", value: metrics.activeUsersToday },
        { label: "Conversations", value: metrics.totalConversations },
        { label: "Messages", value: metrics.totalMessages },
        {
          label: "Tokens Used",
          value: (metrics.totalTokensUsed / 1000).toFixed(1) + "k",
        },
        {
          label: "Est. Cost",
          value: "$" + metrics.estimatedCostUsd.toFixed(4),
        },
        {
          label: "Avg Latency",
          value: metrics.averageLatencyMs + "ms",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        </div>

        {/* Metrics */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Platform Metrics
          </h2>
          {metricsLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metricCards.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-border bg-surface-raised p-4"
                >
                  <div className="text-xs text-text-muted">{m.label}</div>
                  <div className="text-2xl font-bold text-text-primary mt-1">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Users */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Users</h2>
          {usersLoading ? (
            <Spinner />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-overlay">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                      Role
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                      Conversations
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users?.data.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-overlay">
                      <td className="px-4 py-2.5 text-text-primary">
                        {u.email}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            u.role === "ADMIN"
                              ? "bg-accent-100 text-accent-700 dark:bg-accent-700/20 dark:text-accent-400"
                              : "bg-surface-overlay text-text-muted"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {u.conversationCount}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            u.disabled
                              ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          }`}
                        >
                          {u.disabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {u.disabled ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => enableMutation.mutate(u.id)}
                            loading={enableMutation.isPending}
                          >
                            Enable
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => disableMutation.mutate(u.id)}
                            loading={disableMutation.isPending}
                            className="text-red-500 hover:text-red-600"
                          >
                            Disable
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
