import type {
  ConversationSummary,
  ConversationDetail,
  MessageDetail,
  AttachmentSummary,
  PresignResponse,
  PaginatedResponse,
  AdminMetrics,
  AdminUser,
} from '@janna/shared';

const API_BASE =
  typeof window !== 'undefined'
    ? '/api'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';

let _token: string | null = null;

export function setApiToken(token: string | null) {
  _token = token;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorBody: { error: string; code: string };
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { error: res.statusText, code: 'HTTP_ERROR' };
    }
    const err = new Error(errorBody.error) as Error & {
      code: string;
      statusCode: number;
    };
    err.code = errorBody.code;
    err.statusCode = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Conversations ─────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    archived?: boolean;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.archived !== undefined) q.set('archived', String(params.archived));
    if (params?.search) q.set('search', params.search);
    return request<PaginatedResponse<ConversationSummary>>(
      `/conversations?${q.toString()}`
    );
  },

  create: (title?: string) =>
    request<ConversationSummary>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  update: (id: string, data: { title?: string; archived?: boolean; starred?: boolean; projectId?: string | null }) =>
    request<ConversationSummary>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/conversations/${id}`, { method: 'DELETE' }),

  messages: (id: string) =>
    request<MessageDetail[]>(`/conversations/${id}/messages`),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  // Returns a Response with a readable stream
  stream: (body: {
    conversationId: string;
    message: string;
    modelId?: string;
    ragEnabled?: boolean;
    temperature?: number;
    maxTokens?: number;
    attachmentIds?: string[];
  }): Promise<Response> => {
    return fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...((_token) ? { Authorization: `Bearer ${_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  },

  feedback: (messageId: string, thumbsUp: boolean | null) =>
    request<{ ok: boolean }>(`/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ thumbsUp }),
    }),

  editMessage: (messageId: string, content: string) =>
    request<{ conversationId: string; messageId: string }>(
      `/messages/${messageId}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    ),
};

// ─── Attachments ──────────────────────────────────────────────────────────────
export const attachmentsApi = {
  presign: (data: {
    filename: string;
    mimeType: string;
    size: number;
    conversationId?: string;
  }) =>
    request<PresignResponse>('/attachments/presign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  complete: (attachmentId: string) =>
    request<{ attachmentId: string; status: string }>('/attachments/complete', {
      method: 'POST',
      body: JSON.stringify({ attachmentId }),
    }),

  get: (id: string) =>
    request<AttachmentSummary & { downloadUrl?: string }>(`/attachments/${id}`),

  list: (params?: { conversationId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.conversationId) q.set('conversationId', params.conversationId);
    if (params?.status) q.set('status', params.status);
    return request<AttachmentSummary[]>(`/attachments?${q.toString()}`);
  },

  delete: (id: string) =>
    request<void>(`/attachments/${id}`, { method: 'DELETE' }),

  // Upload file directly to S3 presigned URL
  uploadToS3: async (
    file: File,
    uploadUrl: string,
    onProgress?: (pct: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('S3 upload network error'));
      xhr.send(file);
    });
  },
};

// ─── Generic REST client ──────────────────────────────────────────────────────
// Used by hooks that talk to new resource endpoints (profile, projects, extensions)
const FULL_BASE =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export const apiClient = {
  get: <T>(path: string) =>
    request<T>(path.replace(/^\/api/, '')) as Promise<T>,
  post: <T>(path: string, body?: unknown) =>
    request<T>(path.replace(/^\/api/, ''), {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }) as Promise<T>,
  put: <T>(path: string, body?: unknown) =>
    request<T>(path.replace(/^\/api/, ''), {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }) as Promise<T>,
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path.replace(/^\/api/, ''), {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }) as Promise<T>,
  delete: (path: string) =>
    request<void>(path.replace(/^\/api/, ''), { method: 'DELETE' }),
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const profileApi = {
  get: () => apiClient.get('/api/profile'),
  update: (data: unknown) => apiClient.put('/api/profile', data),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (archived = false) =>
    apiClient.get(`/api/projects?archived=${archived}`),
  create: (data: unknown) => apiClient.post('/api/projects', data),
  get: (id: string) => apiClient.get(`/api/projects/${id}`),
  update: (id: string, data: unknown) =>
    apiClient.patch(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
};

// ─── Extensions ───────────────────────────────────────────────────────────────
export const extensionsApi = {
  list: () => apiClient.get('/api/extensions'),
  toggle: (id: string, enabled: boolean, config?: unknown) =>
    apiClient.put(`/api/extensions/${id}`, { enabled, config }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  metrics: () => request<AdminMetrics>('/admin/metrics'),
  users: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.search) q.set('search', params.search);
    return request<PaginatedResponse<AdminUser>>(`/admin/users?${q.toString()}`);
  },
  disableUser: (id: string) =>
    request<{ ok: boolean }>(`/admin/users/${id}/disable`, { method: 'POST' }),
  enableUser: (id: string) =>
    request<{ ok: boolean }>(`/admin/users/${id}/enable`, { method: 'POST' }),
  setRole: (id: string, role: 'user' | 'admin') =>
    request<{ ok: boolean }>(`/admin/users/${id}/set-role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
};
