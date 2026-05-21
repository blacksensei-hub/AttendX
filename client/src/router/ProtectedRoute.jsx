// client/src/router/ProtectedRoute.jsx
import { useState, useEffect }            from 'react';
import { Navigate, Outlet, useLocation }  from 'react-router-dom';
import { useAuthStore }                   from '../store/authStore';

/**
 * ProtectedRoute
 *
 * Waits for Zustand to rehydrate from localStorage before checking
 * auth state. Without this guard, a page refresh on any protected
 * route briefly sees isAuthenticated:false (the Zustand initial value
 * before localStorage is read) and redirects to /login, which then
 * immediately redirects back to the role home — losing the original URL.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *   <Route element={<ProtectedRoute role="lecturer" />}>
 */
export default function ProtectedRoute({ role }) {
  const { isAuthenticated, user } = useAuthStore();
  const location                  = useLocation();
  const [hydrated, setHydrated]   = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  // Return nothing on the first render — Zustand is still reading
  // localStorage. Once the effect fires the component re-renders with
  // the real auth state and takes the correct branch.
  if (!hydrated) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user?.role !== role) {
    const home = user?.role === 'admin'
      ? '/admin'
      : user?.role === 'lecturer'
        ? '/lecturer'
        : '/student';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}