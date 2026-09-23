// client/src/components/layout/AppLayout.jsx
import AppShell         from './AppShell';
import { useAuthStore } from '../../store/authStore';

/**
 * Lecturer + student chrome. The shell itself lives in AppShell.jsx;
 * this wrapper only picks which role's navigation to show.
 */
export default function AppLayout() {
  const role = useAuthStore(s => s.user?.role);
  return <AppShell role={role === 'lecturer' ? 'lecturer' : 'student'} />;
}
