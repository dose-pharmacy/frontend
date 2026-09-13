import { createContext, useContext, useEffect, useState } from "react";
import {
  getSession,
  signInEmail,
  signOut,
  signUpEmail,
  startGoogleSignIn,
  type AuthUser,
  type SessionPayload,
  type SignInInput,
  type SignUpInput,
} from "./authApi";

type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
}

interface AuthContextValue extends AuthState {
  login: (credentials: SignInInput) => Promise<void>;
  signup: (input: SignUpInput) => Promise<void>;
  loginWithGoogle: (callbackURL?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(
  payload: SessionPayload | null,
  setState: React.Dispatch<React.SetStateAction<AuthState>>,
) {
  if (payload?.user) {
    setState({
      user: payload.user,
      status: "authenticated",
    });
  } else {
    setState({
      user: null,
      status: "unauthenticated",
    });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    status: "initializing",
  });

  async function refresh() {
    try {
      const session = await getSession();
      applySession(session, setState);
    } catch {
      setState({
        user: null,
        status: "unauthenticated",
      });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(credentials: SignInInput) {
    const payload = await signInEmail(credentials);
    applySession(payload, setState);
  }

  async function signup(input: SignUpInput) {
    const payload = await signUpEmail(input);
    applySession(payload, setState);
  }

  async function loginWithGoogle(callbackURL?: string) {
    const url = await startGoogleSignIn(
      callbackURL ?? window.location.origin,
    );

    window.location.assign(url);
  }

  async function logout() {
    try {
      await signOut();
    } finally {
      setState({
        user: null,
        status: "unauthenticated",
      });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        loginWithGoogle,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}