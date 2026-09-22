// ── Better Auth API client ───────────────────────────────────────────────────
// Talks to the pharmacy backend's Better Auth endpoints (HTTP-only cookie
// sessions — no token is stored client-side).
//
// Endpoints used (see the backend OpenAPI docs):
//   POST /api/auth/sign-up/email    { name, email, password }
//   POST /api/auth/sign-in/email    { email, password }
//   POST /api/auth/sign-in/social   { provider: "google", callbackURL }
//   POST /api/auth/sign-out
//   GET  /api/auth/get-session      -> { user, session } | null
//
// The backend validates the browser's Origin header against its configured
// FRONTEND_URL (trusted origins) and rejects mismatches with 403
// INVALID_ORIGIN. Browsers send Origin automatically on cross-origin
// requests, so make sure the origin this app is served from is trusted by
// the backend. Override the backend URL with VITE_API_URL if needed.

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://backend-p89g.onrender.com";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthSession {
  id: string;
  expiresAt: string;
}

export interface SessionPayload {
  user: AuthUser;
  session: AuthSession;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export class AuthError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "AuthError";
    this.code = options.code;
    this.status = options.status;
  }
}

async function parseErrorResponse(res: Response): Promise<AuthError> {
  let message = `Authentication failed (HTTP ${res.status}).`;
  let code: string | undefined;

  try {
    const data = (await res.json()) as { message?: string; code?: string } | null;
    if (data?.message) message = data.message;
    code = data?.code;
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  if (code === "INVALID_ORIGIN") {
    message =
      `The server rejected this app's origin ("${window.location.origin}"). ` +
      "Add it to the backend's FRONTEND_URL / trusted origins, then try again.";
  }

  return new AuthError(message, { code, status: res.status });
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AuthError(
      "Cannot reach the authentication server. Please check your connection and try again.",
    );
  }

  if (!res.ok) throw await parseErrorResponse(res);

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Registers a user; Better Auth starts a session automatically. */
export async function signUpEmail(input: SignUpInput): Promise<SessionPayload> {
  return authRequest<SessionPayload>("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
  });
}

/** Signs in with email + password; the response sets the session cookie. */
export async function signInEmail(input: SignInInput): Promise<SessionPayload> {
  return authRequest<SessionPayload>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      ...(input.rememberMe ? { rememberMe: true } : {}),
    }),
  });
}

/** Returns the current session, or null when there is no valid session. */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    return await authRequest<SessionPayload | null>("/api/auth/get-session");
  } catch (err) {
    // Some Better Auth configs answer 401 instead of `null` when signed out.
    if (err instanceof AuthError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Invalidates the session server-side (POST /api/auth/sign-out, with the
 * session cookie). Throws an AuthError when the request fails so callers can
 * tell the user logout did not actually happen.
 */
export async function signOut(): Promise<void> {
  await authRequest<unknown>("/api/auth/sign-out", {
    method: "POST",
    body: "{}",
  });
}

/**
 * Starts the Google OAuth flow and returns the consent-screen URL.
 * After Google authenticates, the backend handles
 * /api/auth/callback/google, sets the session cookie, and redirects the
 * browser to `callbackURL` (defaults to this app's origin).
 */
export async function startGoogleSignIn(
  callbackURL: string = window.location.origin,
): Promise<string> {
  const data = await authRequest<{ url?: string; redirect?: boolean }>(
    "/api/auth/sign-in/social",
    {
      method: "POST",
      body: JSON.stringify({ provider: "google", callbackURL }),
    },
  );
  if (!data?.url) {
    throw new AuthError("Could not start Google sign-in. Please try again.");
  }
  return data.url;
}
