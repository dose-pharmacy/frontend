import { createContext, useContext, useEffect, useState } from "react";
import { loginRequest, type AuthUser, type LoginCredentials } from "./authApi";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "pharmacy_token";
const USER_KEY = "pharmacy_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const user = sessionStorage.getItem(USER_KEY);
    return {
      user: user ? JSON.parse(user) : null,
      token,
      status: token ? "authenticated" : "idle",
      error: null,
    };
  });

  async function login(credentials: LoginCredentials) {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const { user, token } = await loginRequest(credentials);
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({ user, token, status: "authenticated", error: null });
      // resolved means success — caller can navigate
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setState((s) => ({ ...s, status: "error", error: message }));
      throw err; // re-throw so callers can react
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setState({ user: null, token: null, status: "idle", error: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
