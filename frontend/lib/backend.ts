/* Alamat backend Go (Cloud Run) + token sesi login Google. NEXT_PUBLIC_* dibaca saat build. */
export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const TOKEN_KEY = 'tbv_token';

export const getToken = (): string => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t: string) => { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* mode privat */ } };

/** fetch ke backend dengan header Authorization; 401 memicu event agar UI keluar ke halaman login. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('tbv:unauthorized'));
  return res;
}
