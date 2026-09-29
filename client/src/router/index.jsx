import { useSyncExternalStore, lazy, Suspense }                from 'react';
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
import ForceLogoutListener from '../components/ForceLogoutListener';

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
const LandingPage            = lazy(() => import('../pages/landing/LandingPage'));
const LoginPage              = lazy(ROUTE_IMPORTS['/login']);
const RegisterPage           = lazy(ROUTE_IMPORTS['/register']);

const LecturerDashboard      = lazy(ROUTE_IMPORTS['/lecturer']);
const ClassesPage            = lazy(ROUTE_IMPORTS['/lecturer/classes']);
const LiveSessionsPage       = lazy(ROUTE_IMPORTS['/lecturer/sessions']);
const ReportsPage            = lazy(ROUTE_IMPORTS['/lecturer/reports']);
const RequestsPage           = lazy(ROUTE_IMPORTS['/lecturer/requests']);
const AtRiskPage             = lazy(ROUTE_IMPORTS['/lecturer/alerts']);
const LecturerTimetable      = lazy(ROUTE_IMPORTS['/lecturer/timetable']);

const LiveSessionPage        = lazy(() => import('../pages/lecturer/LiveSessionPage'));
const SessionRosterPage      = lazy(() => import('../pages/lecturer/SessionRosterPage'));
const ClassHubPage           = lazy(() => import('../pages/lecturer/ClassHubPage'));
const StudentDetailPage      = lazy(() => import('../pages/lecturer/StudentDetailPage'));
const ProjectorPage          = lazy(() => import('../pages/lecturer/ProjectorPage'));

const StudentDashboard       = lazy(ROUTE_IMPORTS['/student']);
const MyClassesPage          = lazy(ROUTE_IMPORTS['/student/classes']);
const AttendanceHistoryPage  = lazy(ROUTE_IMPORTS['/student/history']);
const ScanPage               = lazy(ROUTE_IMPORTS['/student/scan']);
const StudentTimetable       = lazy(ROUTE_IMPORTS['/student/timetable']);
const StudentRequests        = lazy(ROUTE_IMPORTS['/student/requests']);

const AdminDashboard         = lazy(ROUTE_IMPORTS['/admin']);
const AdminClasses           = lazy(ROUTE_IMPORTS['/admin/classes']);
const AdminSessions          = lazy(ROUTE_IMPORTS['/admin/sessions']);
const AdminUsers             = lazy(ROUTE_IMPORTS['/admin/users']);
const AdminAtRisk            = lazy(ROUTE_IMPORTS['/admin/at-risk']);
const AdminHeatmap           = lazy(ROUTE_IMPORTS['/admin/heatmap']);
const AdminAuditLog          = lazy(ROUTE_IMPORTS['/admin/audit']);
const AdminImportUsers       = lazy(ROUTE_IMPORTS['/admin/users/import']);
const AdminCalendar          = lazy(ROUTE_IMPORTS['/admin/calendar']);
const AdminAnalytics         = lazy(ROUTE_IMPORTS['/admin/analytics']);
const AdminFraudReview       = lazy(ROUTE_IMPORTS['/admin/fraud']);
const AdminAnnouncements     = lazy(ROUTE_IMPORTS['/admin/announcements']);
const AdminSettings          = lazy(ROUTE_IMPORTS['/admin/settings']);
const AdminHealth            = lazy(ROUTE_IMPORTS['/admin/health']);
const AdminOpsWall           = lazy(ROUTE_IMPORTS['/admin/ops']);
const InvitePage             = lazy(() => import('../pages/auth/InvitePage'));

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
  // Without this, an empty store would fall through to the /student
  // default even for admin/lecturer accounts.
  const hydrated = useSyncExternalStore(
    (onChange) => useAuthStore.persist?.onFinishHydration?.(onChange) ?? (() => {}),
    () => useAuthStore.persist?.hasHydrated?.() ?? true,
  );
  if (!hydrated) return null;

  // Signed-out visitors get the public landing page; everyone else
  // goes straight to their own dashboard.
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#070D1F' }} />}>
        <LandingPage />
      </Suspense>
    );
  }
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
      { path: '/invite/:token', element: <InvitePage /> },
    ],
  },

  // Admin routes
  {
    element: <ProtectedRoute role="admin" />,
    children: [
      // The ops wall is full screen, outside the console chrome.
      {
        path: '/admin/ops',
        element: (
          <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
            <AdminOpsWall />
          </Suspense>
        ),
      },
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin',                element: <AdminDashboard />     },
          { path: '/admin/users',          element: <AdminUsers />         },
          { path: '/admin/users/import',   element: <AdminImportUsers />   },
          { path: '/admin/classes',        element: <AdminClasses />       },
          { path: '/admin/sessions',       element: <AdminSessions />      },
          { path: '/admin/calendar',       element: <AdminCalendar />      },
          { path: '/admin/analytics',      element: <AdminAnalytics />     },
          { path: '/admin/at-risk',        element: <AdminAtRisk />        },
          { path: '/admin/heatmap',        element: <AdminHeatmap />       },
          { path: '/admin/fraud',          element: <AdminFraudReview />   },
          { path: '/admin/audit',          element: <AdminAuditLog />      },
          { path: '/admin/announcements',  element: <AdminAnnouncements /> },
          { path: '/admin/settings',       element: <AdminSettings />      },
          { path: '/admin/health',         element: <AdminHealth />        },
        ],
      },
    ],
  },

  // Lecturer routes
  {
    element: <ProtectedRoute role="lecturer" />,
    children: [
      // Projector mode is full screen, outside the app chrome.
      {
        path: '/lecturer/session/:sessionId/projector',
        element: (
          <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#050A18' }} />}>
            <ProjectorPage />
          </Suspense>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          { path: '/lecturer',                            element: <LecturerDashboard /> },
          { path: '/lecturer/classes',                    element: <ClassesPage />       },
          { path: '/lecturer/classes/:classId',           element: <ClassHubPage />      },
          { path: '/lecturer/classes/:classId/students/:studentId', element: <StudentDetailPage /> },
          { path: '/lecturer/timetable',                  element: <LecturerTimetable /> },
          { path: '/lecturer/sessions',                   element: <LiveSessionsPage />  },
          { path: '/lecturer/session/:sessionId',         element: <LiveSessionPage />   },
          { path: '/lecturer/session/:sessionId/roster',  element: <SessionRosterPage /> },
          { path: '/lecturer/requests',                   element: <RequestsPage />      },
          // Old bookmark and email links
          { path: '/lecturer/appeals',                    element: <Navigate to="/lecturer/requests" replace /> },
          { path: '/lecturer/alerts',                     element: <AtRiskPage />        },
          { path: '/lecturer/reports',                    element: <ReportsPage />       },
        ],
      },
    ],
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
        { path: '/student/timetable', element: <StudentTimetable />    },
        { path: '/student/requests',  element: <StudentRequests />     },
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
      {/* Sits outside the route tree so it stays mounted across every
          navigation — a revoked session must be caught on any page. */}
      <ForceLogoutListener />
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}