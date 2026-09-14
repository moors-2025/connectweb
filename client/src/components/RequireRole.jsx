import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
