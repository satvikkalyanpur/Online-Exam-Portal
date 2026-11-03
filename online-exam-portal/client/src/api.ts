// Talks to the Express API. In development Vite forwards /api to http://localhost:4000
// (see vite.config.ts); set VITE_API_URL to call a different server.
const API_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'exam-portal:token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session just won't survive a refresh.
  }
}

/** Called when the server says the session is no longer valid. */
let onUnauthorized: (message: string) => void = () => {};
export function setUnauthorizedHandler(handler: (message: string) => void) {
  onUnauthorized = handler;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and that the API is running.');
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (e.g. proxy error page)
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) ?? `Request failed (${response.status}).`;
    if (response.status === 401 && path !== '/auth/login') onUnauthorized(message);
    throw new ApiError(response.status, message);
  }
  return data as T;
}
