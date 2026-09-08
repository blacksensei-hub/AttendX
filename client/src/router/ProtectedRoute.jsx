import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/ui/Spinner';

/**
 * ProtectedRoute
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>           -- just checks auth
 *   <Route element={<ProtectedRoute role="lecturer" />}>  -- checks role too
 */
export default function ProtectedRoute({ role }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user?.role !== role) {
    // Wrong role — redirect to their dashboard
    const home = user?.role === 'lecturer' ? '/lecturer' : '/student';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}