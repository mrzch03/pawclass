const TOKEN_KEY = "pawclass_token";
const USER_KEY = "pawclass_user";
const ROLE_KEY = "pawclass_role";

// Clerk session token (set by useClerkAuth hook)
let clerkToken: string | null = null;

export function setClerkToken(token: string | null) {
  clerkToken = token;
}

export function getToken(): string | null {
  return clerkToken || localStorage.getItem(TOKEN_KEY);
}

export function getUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setAuth(token: string, userId: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, userId);
}

export function setRole(role: string) {
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  clerkToken = null;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Fetch wrapper that adds Authorization header */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...opts, headers });
}
