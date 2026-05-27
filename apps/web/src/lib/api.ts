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
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
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
  loginMorador: (body: { numeroApartamento: string; password: string }) =>
    request<{ accessToken: string } | { primeiroAcesso: true }>('/auth/morador', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFuncionarios: () => request<{ id: string; nome: string }[]>('/auth/funcionarios'),
  setupFuncionario: (body: { funcionarioId: string; novaSenha: string }) =>
    request<{ accessToken: string }>('/auth/funcionario/setup', { method: 'POST', body: JSON.stringify(body) }),
  setupMorador: (body: { apartamentoId: string; novaSenha: string }) =>
    request<{ accessToken: string }>('/auth/morador/setup', { method: 'POST', body: JSON.stringify(body) }),
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
  resetSenha: (id: string) =>
    request<any>(`/apartamentos/${id}/reset-senha`, { method: 'PATCH' }),
  remove: (id: string) => request<any>(`/apartamentos/${id}`, { method: 'DELETE' }),
};

// Moradores
export const moradores = {
  list: (apartamentoId?: string) =>
    request<any[]>(`/moradores${apartamentoId ? `?apartamentoId=${apartamentoId}` : ''}`),
  meus: () => request<any[]>('/moradores/meus'),
  get: (id: string) => request<any>(`/moradores/${id}`),
  create: (body: object) => request<any>('/moradores', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/moradores/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/moradores/${id}`, { method: 'DELETE' }),
};

// Encomendas
export const encomendas = {
  criar: (body: { moradorId: string; descricao?: string }) =>
    request<any>('/encomendas', { method: 'POST', body: JSON.stringify(body) }),
  confirmarRetirada: (id: string) =>
    request<any>(`/encomendas/${id}/retirada`, { method: 'PATCH' }),
  listar: (params?: { status?: string; moradorId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.moradorId) qs.set('moradorId', params.moradorId);
    const query = qs.toString();
    return request<any[]>(`/encomendas${query ? `?${query}` : ''}`);
  },
  pendentes: () => request<any[]>('/encomendas/pendentes'),
  minhas: () => request<any[]>('/encomendas/minhas'),
};

// Reservas
export const reservas = {
  espacos: () => request<any[]>('/reservas/espacos'),
  disponibilidade: (espacoId: string, data: string) =>
    request<any>(`/reservas/disponibilidade?espacoId=${espacoId}&data=${data}`),
  criar: (body: { espacoReservaId: string; data: string; horaInicio?: string; duracao?: number; observacao?: string; apartamentoId?: string }) =>
    request<any>('/reservas', { method: 'POST', body: JSON.stringify(body) }),
  cancelar: (id: string) => request<any>(`/reservas/${id}`, { method: 'DELETE' }),
  listar: (params?: { espacoId?: string; data?: string; apartamentoId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.espacoId) qs.set('espacoId', params.espacoId);
    if (params?.data) qs.set('data', params.data);
    if (params?.apartamentoId) qs.set('apartamentoId', params.apartamentoId);
    const query = qs.toString();
    return request<any[]>(`/reservas${query ? `?${query}` : ''}`);
  },
  minhas: () => request<any[]>('/reservas/minhas'),
};

// WhatsApp
export const whatsapp = {
  status: () => request<{ connected: boolean }>('/whatsapp/status'),
  qr: () => request<{ qr: string } | null>('/whatsapp/qr'),
};

// Funcionários
export const funcionarios = {
  list: () => request<any[]>('/funcionarios'),
  get: (id: string) => request<any>(`/funcionarios/${id}`),
  create: (body: { nome: string }) =>
    request<any>('/funcionarios', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/funcionarios/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetSenha: (id: string, senha: string) =>
    request<any>(`/funcionarios/${id}/senha`, { method: 'PATCH', body: JSON.stringify({ senha }) }),
  remove: (id: string) => request<any>(`/funcionarios/${id}`, { method: 'DELETE' }),
};
