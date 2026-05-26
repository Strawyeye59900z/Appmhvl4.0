import { getSession, clearSession, saveSession, parseJwtPayload } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    // Tenta refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retrySession = getSession();
      if (retrySession) headers['Authorization'] = `Bearer ${retrySession.accessToken}`;
      const retry = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
      if (!retry.ok) throw await toError(retry);
      return retry.json() as Promise<T>;
    }
    clearSession();
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    const payload = parseJwtPayload(accessToken);
    if (!payload) return false;
    saveSession({ accessToken, role: payload.role, sub: payload.sub });
    return true;
  } catch {
    return false;
  }
}

async function toError(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    return new Error(body.message ?? res.statusText);
  } catch {
    return new Error(res.statusText);
  }
}

// Auth
export const auth = {
  loginAdmin: (body: { username: string; password: string }) =>
    request<{ accessToken: string }>('/auth/admin', { method: 'POST', body: JSON.stringify(body) }),
  loginFuncionario: (body: { funcionarioId: string; password: string }) =>
    request<{ accessToken: string } | { primeiroAcesso: true }>('/auth/funcionario', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  loginMorador: (body: { apartamentoId: string; password: string }) =>
    request<{ accessToken: string } | { primeiroAcesso: true }>('/auth/morador', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFuncionarios: () => request<{ id: string; nome: string }[]>('/auth/funcionarios'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
};

// Apartamentos
export const apartamentos = {
  list: (ativo?: boolean) =>
    request<any[]>(`/apartamentos${ativo !== undefined ? `?ativo=${ativo}` : ''}`),
  get: (id: string) => request<any>(`/apartamentos/${id}`),
  create: (body: { numero: string; bloco?: string }) =>
    request<any>('/apartamentos', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/apartamentos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/apartamentos/${id}`, { method: 'DELETE' }),
};

// Moradores
export const moradores = {
  list: (apartamentoId?: string) =>
    request<any[]>(`/moradores${apartamentoId ? `?apartamentoId=${apartamentoId}` : ''}`),
  get: (id: string) => request<any>(`/moradores/${id}`),
  create: (body: object) => request<any>('/moradores', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/moradores/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/moradores/${id}`, { method: 'DELETE' }),
};

// Funcionários
export const funcionarios = {
  list: () => request<any[]>('/funcionarios'),
  get: (id: string) => request<any>(`/funcionarios/${id}`),
  create: (body: { nome: string }) =>
    request<any>('/funcionarios', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/funcionarios/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/funcionarios/${id}`, { method: 'DELETE' }),
};
