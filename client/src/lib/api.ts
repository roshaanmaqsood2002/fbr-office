import axios, { AxiosError } from 'axios';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  firmId: string;
  firmName: string;
}
export interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let inflight: Promise<AuthResponse | null> | null = null;
export function refreshSession(): Promise<AuthResponse | null> {
  if (!inflight) {
    inflight = axios
      .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true })
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return r.data;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const NO_RETRY = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !NO_RETRY.includes(original.url ?? '')) {
      original._retry = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.message ?? 'Network error, please try again';
  return 'Something went wrong';
}