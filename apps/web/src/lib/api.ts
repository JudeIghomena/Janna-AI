// ============================================================
// Janna AI - API Client
// ============================================================
import { fetchAuthSession } from "aws-amplify/auth";
import type {
  Conversation,
  Message,
  Attachment,
  PaginatedResponse,
  AdminMetrics,
  ModelConfig,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getToken(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? "";
  } catch {
    return "";
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// Conversations
export const conversationsApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][]
    );
    return apiRequest<PaginatedResponse<Conversation>>(
      `/api/conversations?${qs}`
    );
  },

  create: (data: { title?: string; parentConversationId?: string }) =>
    apiRequest<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: { title?: string; archived?: boolean }
  ) =>
    apiRequest<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/conversations/${id}`, { method: "DELETE" }),

  getMessages: (id: string, params?: { cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][]
    );
    return apiRequest<{ data: Message[]; conversationId: string }>(
      `/api/conversations/${id}/messages?${qs}`
    );
  },

  export: async (id: string, format: "markdown") => {
    const token = await getToken();
    const res = await fetch(
      `${API_URL}/api/conversations/${id}/export?format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.text();
  },
};

// Chat
export const chatApi = {
  streamUrl: `${API_URL}/api/chat/stream`,

  getModels: () =>
    apiRequest<{ data: ModelConfig[] }>("/api/models"),
};

// Attachments
export const attachmentsApi = {
  presign: (data: {
    filename: string;
    mimeType: string;
    size: number;
    conversationId?: string;
  }) =>
    apiRequest<{
      attachmentId: string;
      uploadUrl: string;
      s3Key: string;
    }>("/api/attachments/presign", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  complete: (attachmentId: string) =>
    apiRequest<{ attachmentId: string; status: string }>(
      "/api/attachments/complete",
      { method: "POST", body: JSON.stringify({ attachmentId }) }
    ),

  get: (id: string) =>
    apiRequest<Attachment & { downloadUrl: string }>(`/api/attachments/${id}`),

  list: (conversationId?: string) =>
    apiRequest<{ data: Attachment[] }>(
      `/api/attachments${conversationId ? `?conversationId=${conversationId}` : ""}`
    ),

  upload: async (
    file: File,
    conversationId?: string
  ): Promise<{ attachmentId: string }> => {
    // 1) Get presigned URL
    const { attachmentId, uploadUrl } = await attachmentsApi.presign({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      conversationId,
    });

    // 2) Upload to S3
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    // 3) Mark complete
    await attachmentsApi.complete(attachmentId);

    return { attachmentId };
  },
};

// Admin
export const adminApi = {
  getMetrics: () => apiRequest<AdminMetrics>("/api/admin/metrics"),
  getUsers: (params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][]
    );
    return apiRequest<PaginatedResponse<{
      id: string;
      email: string;
      role: string;
      disabled: boolean;
      createdAt: string;
      conversationCount: number;
    }>>(`/api/admin/users?${qs}`);
  },
  disableUser: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/admin/users/${id}/disable`, {
      method: "POST",
    }),
  enableUser: (id: string) =>
    apiRequest<{ success: boolean }>(`/api/admin/users/${id}/enable`, {
      method: "POST",
    }),
};
