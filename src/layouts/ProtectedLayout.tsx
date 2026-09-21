import { Navigate, Outlet } from "react-router";
import { useAuth } from "../features/auth/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "initializing") {
    // Restoring the session (get-session) — including right after the
    // Google OAuth redirect — so don't flash the login page.
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7A9076]" aria-hidden />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
