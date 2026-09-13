import { Navigate, Outlet } from "react-router";
import { useAuth } from "../features/auth/AuthContext";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
