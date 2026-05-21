// client/src/router/index.jsx
import { useState, useEffect, lazy }      from 'react';
import {
  createBrowserRouter, RouterProvider, Navigate,
}                                         from 'react-router-dom';

import { useAuthStore }                   from '../store/authStore';
import { ROUTE_IMPORTS }                  from './prefetch';

import AppLayout          from '../components/layout/AppLayout';
import AuthLayout         from '../components/auth/AuthLayout';
import AdminLayout        from '../components/layout/AdminLayout';
import ProtectedRoute     from './ProtectedRoute';
import ErrorBoundary      from '../components/ErrorBoundary';
import AdminUsers         from '../pages/admin/Users';
import AdminAtRisk        from '../pages/admin/AtRisk';
import AdminHeatmap       from '../pages/admin/Heatmap';
import AdminAnnouncements from '../pages/admin/Announcements';
import AdminAuditPage      from '../pages/admin/AdminAuditPage';
import AdminAnalyticsPage  from '../pages/admin/AdminAnalyticsPage';

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
const ClassPerformancePage   = lazy(() => import('../pages/lecturer/ClassPerformancePage'));
const LecturerPerformancePage = lazy(() => import('../pages/lecturer/LecturerPerformancePage'));

const StudentDashboard       = lazy(ROUTE_IMPORTS['/student']);
const MyClassesPage          = lazy(ROUTE_IMPORTS['/student/classes']);
const AttendanceHistoryPage  = lazy(ROUTE_IMPORTS['/student/history']);
const ScanPage               = lazy(ROUTE_IMPORTS['/student/scan']);

const AdminDashboard         = lazy(ROUTE_IMPORTS['/admin']);
const AdminClasses           = lazy(ROUTE_IMPORTS['/admin/classes']);
const AdminSessions          = lazy(ROUTE_IMPORTS['/admin/sessions']);

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  const [hydrated, setHydrated]   = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  if (!hydrated) return null;
  if (!isAuthenticated)          return <Navigate to="/login"    replace />;
  if (user?.role === 'admin')    return <Navigate to="/admin"    replace />;
  if (user?.role === 'lecturer') return <Navigate to="/lecturer" replace />;
  return                               <Navigate to="/student"   replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },

  {
    element: <AuthLayout />,
    children: [
      { path: '/login',    element: <LoginPage />    },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  {
    element: <ProtectedRoute role="admin" />,
    children: [{
      element: <AdminLayout />,
      children: [
        { path: '/admin',               element: <AdminDashboard />     },
        { path: '/admin/users',         element: <AdminUsers />         },
        { path: '/admin/classes',       element: <AdminClasses />       },
        { path: '/admin/sessions',      element: <AdminSessions />      },
        { path: '/admin/at-risk',       element: <AdminAtRisk />        },
        { path: '/admin/heatmap',       element: <AdminHeatmap />       },
        { path: '/admin/announcements', element: <AdminAnnouncements /> },
        { path: '/admin/audit',         element: <AdminAuditPage />     },
        { path: '/admin/analytics',     element: <AdminAnalyticsPage />  },
      ],
    }],
  },

  {
    element: <ProtectedRoute role="lecturer" />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/lecturer',                            element: <LecturerDashboard />    },
        { path: '/lecturer/classes',                    element: <ClassesPage />          },
        { path: '/lecturer/sessions',                   element: <LiveSessionsPage />     },
        { path: '/lecturer/session/:sessionId',         element: <LiveSessionPage />      },
        { path: '/lecturer/session/:sessionId/roster',  element: <SessionRosterPage />    },
        { path: '/lecturer/classes/:classId/performance', element: <ClassPerformancePage /> },
        { path: '/lecturer/performance',                element: <LecturerPerformancePage /> },
        { path: '/lecturer/appeals',                    element: <AppealsPage />          },
        { path: '/lecturer/alerts',                     element: <AtRiskPage />           },
        { path: '/lecturer/reports',                    element: <ReportsPage />          },
      ],
    }],
  },

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

  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}