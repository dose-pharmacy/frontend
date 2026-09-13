import { Navigate, Outlet } from "react-router";
import { useAuth } from "../features/auth/AuthContext";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "initializing") {
    // Restoring the session (get-session) — including right after the
    // Google OAuth redirect — so don't flash the login page.
    return (
      <div className="flex h-full items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-[#49B0C1]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
