/**
 * ═════════════════════════════════════════════════════════════════
 * Route prefetching — preload lazy chunks before the user clicks.
 *
 * How it works:
 *   1. ROUTE_IMPORTS maps each route path to its dynamic import().
 *   2. router/index.jsx uses these same functions inside React.lazy().
 *   3. Sidebar.jsx calls prefetchRoute(path) on mouseenter/focus.
 *
 * Because JavaScript module imports are cached at the module level,
 * calling import('./Foo') twice triggers the network request once —
 * the second call resolves from cache. So when the user hovers a
 * link, the chunk download starts; by the time they click (typically
 * 80-300ms later), it's ready, and React.lazy resolves instantly.
 *
 * No new dependencies, no bundle weight, no animation cost.
 *
 * Only sidebar-reachable routes are prefetchable — dynamic routes
 * like /lecturer/session/:id can't be prefetched by path because
 * the path doesn't exist until the user navigates somewhere with
 * a real ID. They'll still lazy-load on click as before.
 * ═════════════════════════════════════════════════════════════════
 */

export const ROUTE_IMPORTS = {
  // Auth
  '/login':              () => import('../pages/auth/LoginPage'),
  '/register':           () => import('../pages/auth/RegisterPage'),

  // Lecturer
  '/lecturer':           () => import('../pages/lecturer/LecturerDashboard'),
  '/lecturer/classes':   () => import('../pages/lecturer/ClassesPage'),
  '/lecturer/sessions':  () => import('../pages/lecturer/LiveSessionsPage'),
  '/lecturer/appeals':   () => import('../pages/lecturer/AppealsPage'),
  '/lecturer/alerts':    () => import('../pages/lecturer/AtRiskPage'),
  '/lecturer/reports':   () => import('../pages/lecturer/ReportsPage'),

  // Student
  '/student':            () => import('../pages/student/StudentDashboard'),
  '/student/classes':    () => import('../pages/student/MyClassesPage'),
  '/student/history':    () => import('../pages/student/AttendanceHistoryPage'),
  '/student/scan':       () => import('../pages/student/ScanPage'),

  // Admin
  '/admin':              () => import('../pages/admin/AdminDashboard'),
  '/admin/users':        () => import('../pages/admin/Users'),
  '/admin/classes':      () => import('../pages/admin/AdminClasses'),
  '/admin/sessions':     () => import('../pages/admin/AdminSessions'),
};

// Tracks which routes have already been prefetched in this session
// so repeated hovers don't trigger redundant work. The Set is just
// a hint — the browser/Vite already cache module imports, but this
// avoids even the function call overhead for known-warm routes.
const prefetched = new Set();

/**
 * Trigger an early download of the chunk for the given route path.
 * Safe to call repeatedly; no-ops after the first call per session.
 * Does nothing if the path isn't in ROUTE_IMPORTS (e.g. dynamic routes).
 */
export function prefetchRoute(path) {
  if (prefetched.has(path)) return;

  const importFn = ROUTE_IMPORTS[path];
  if (!importFn) return;

  prefetched.add(path);

  // Fire and forget. The promise resolves when the chunk arrives,
  // but we don't need to await it — React.lazy will pick it up
  // from the module cache when the route actually renders.
  importFn().catch(() => {
    // If prefetch fails (network blip, offline), remove it from the
    // tracking set so a real navigation will retry the import.
    prefetched.delete(path);
  });
}