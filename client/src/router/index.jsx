import { useState, useEffect, lazy }                           from 'react';
import {
  createBrowserRouter, RouterProvider, Navigate,
}                                         from 'react-router-dom';

import { useAuthStore }                   from '../store/authStore';
import { ROUTE_IMPORTS }                  from './prefetch';

// Eagerly-loaded
import AppLayout    from '../components/layout/AppLayout';
import AuthLayout   from '../components/auth/AuthLayout';
import AdminLayout  from '../components/layout/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import ErrorBoundary  from '../components/ErrorBoundary';
import AdminUsers   from '../pages/admin/Users';      
import AdminAtRisk  from '../pages/admin/AtRisk';
import AdminHeatmap from '../pages/admin/Heatmap';

// ─── Lazily-loaded pages ──────────────────────────────────────
//
// Pages reachable from a sidebar nav link share their import
// function with prefetch.js — see ROUTE_IMPORTS there. This means
// when the sidebar prefetches a route on hover, React.lazy here
// gets the same cached promise on click.
//
// Dynamic-path pages (session detail, roster) define their own
// imports inline because they aren't in ROUTE_IMPORTS — they're
// reached via a click on a class card or a Reports table row,
// not via the sidebar.
const LoginPage              = lazy(ROUTE_IMPORTS['/login']);
const RegisterPage           = lazy(ROUTE_IMPORTS['/register']);

const LecturerDashboard      = lazy(ROUTE_IMPORTS['/lecturer']);
const ClassesPage            = lazy(ROUTE_IMPORTS['/lecturer/classes']);
const LiveSessionsPage       = lazy(ROUTE_IMPORTS['/lecturer/sessions']);
const ReportsPage            = lazy(ROUTE_IMPORTS['/lecturer/reports']);
const AppealsPage            = lazy(ROUTE_IMPORTS['/lecturer/appeals']);
const AtRiskPage             = lazy(ROUTE_IMPORTS['/lecturer/alerts']);

const LiveSessionPage        = lazy(() => import('../pages/lecturer/LiveSessionPage'));
const SessionRosterPage      = lazy(() => import('../pages/lecturer/SessionRosterPage'));

const StudentDashboard       = lazy(ROUTE_IMPORTS['/student']);
const MyClassesPage          = lazy(ROUTE_IMPORTS['/student/classes']);
const AttendanceHistoryPage  = lazy(ROUTE_IMPORTS['/student/history']);
const ScanPage               = lazy(ROUTE_IMPORTS['/student/scan']);

const AdminDashboard         = lazy(ROUTE_IMPORTS['/admin']);
const AdminClasses           = lazy(ROUTE_IMPORTS['/admin/classes']);
const AdminSessions          = lazy(ROUTE_IMPORTS['/admin/sessions']);

/**
 * ═════════════════════════════════════════════════════════════════
 * Router — role-based routing for AttendX.
 *
 * Each layout (AppLayout / AdminLayout) owns its own Suspense
 * boundary internally — see AppLayout.jsx for why. We pass lazy
 * components directly as route elements without any wrapper.
 *
 * Route prefetching: sidebar nav items prefetch their target chunk
 * on hover. See router/prefetch.js for the mechanism.
 *
 * Error handling: the entire RouterProvider is wrapped in
 * ErrorBoundary so any uncaught render error in any route shows
 * a friendly fallback UI instead of a white page of death.
 * ═════════════════════════════════════════════════════════════════
 */

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  // Wait for Zustand to rehydrate from localStorage before redirecting.
  // Without this, the store is briefly empty on first render and falls
  // through to the /student default even for admin/lecturer accounts.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  if (!hydrated) return null;

  if (!isAuthenticated)          return <Navigate to="/login"    replace />;
  if (user?.role === 'admin')    return <Navigate to="/admin"    replace />;
  if (user?.role === 'lecturer') return <Navigate to="/lecturer" replace />;
  return                               <Navigate to="/student"   replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },

  // Public auth routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',    element: <LoginPage />    },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  // Admin routes
  {
    element: <ProtectedRoute role="admin" />,
    children: [{
      element: <AdminLayout />,
      children: [
        { path: '/admin',          element: <AdminDashboard /> },
        { path: '/admin/users',    element: <AdminUsers />     },
        { path: '/admin/classes',  element: <AdminClasses />   },
        { path: '/admin/sessions', element: <AdminSessions />  },
        { path: '/admin/at-risk',  element: <AdminAtRisk />    },  // ← ADD
        { path: '/admin/heatmap',  element: <AdminHeatmap />   },  // ← ADD
      ],
    }],
  },

  // Lecturer routes
  {
    element: <ProtectedRoute role="lecturer" />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/lecturer',                            element: <LecturerDashboard /> },
        { path: '/lecturer/classes',                    element: <ClassesPage />       },
        { path: '/lecturer/sessions',                   element: <LiveSessionsPage />  },
        { path: '/lecturer/session/:sessionId',         element: <LiveSessionPage />   },
        { path: '/lecturer/session/:sessionId/roster',  element: <SessionRosterPage /> },
        { path: '/lecturer/appeals',                    element: <AppealsPage />       },
        { path: '/lecturer/alerts',                     element: <AtRiskPage />        },
        { path: '/lecturer/reports',                    element: <ReportsPage />       },
      ],
    }],
  },

  // Student routes
  {
    element: <ProtectedRoute role="student" />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/student',         element: <StudentDashboard />      },
        { path: '/student/classes', element: <MyClassesPage />         },
        { path: '/student/history', element: <AttendanceHistoryPage /> },
        { path: '/student/scan',    element: <ScanPage />              },
      ],
    }],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  // ErrorBoundary wraps the entire RouterProvider so any uncaught
  // render error in any route — including layouts — shows the
  // friendly fallback UI rather than crashing the whole app to
  // a blank page.
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}