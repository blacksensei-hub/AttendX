// client/src/components/layout/AdminLayout.jsx
import AppShell from './AppShell';

/**
 * Admin chrome. Same Roll Call shell as lecturers and students, with
 * the admin navigation and an "Admin" tag beside the wordmark.
 */
export default function AdminLayout() {
  return <AppShell role="admin" />;
}
