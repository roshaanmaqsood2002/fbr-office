import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center h-screen animate-pulse-soft text-fbr-text-light">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}