import { useEffect, useState }           from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router }                        from 'expo-router';

import { useAuthStore }                  from '../store/authStore';
import api                               from '../services/api';
import { useTheme }                      from '../src/theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * Entry-point router.
 *
 * Runs once at app boot. Decides where to send the user:
 *
 *   1. No token in SecureStore       → /auth/login
 *   2. Token exists but /auth/me 401 → /auth/login (token invalid)
 *   3. Token valid + role=student    → /student
 *   4. Token valid + role=lecturer   → /lecturer
 *   5. Token valid + role=admin      → /auth/use-web (admin tools are web-only)
 *
 * While deciding, shows a branded loading splash so there's never
 * a blank screen between app boot and the first real route.
 * ═════════════════════════════════════════════════════════════════
 */
export default function Index() {
  const t                       = useTheme();
  const loadToken               = useAuthStore(s => s.loadToken);
  const setAuth                 = useAuthStore(s => s.setAuth);
  const logout                  = useAuthStore(s => s.logout);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await loadToken();

        // No token → straight to login
        if (!token) {
          if (!cancelled) router.replace('/auth/login');
          return;
        }

        // Token exists → verify it and fetch the user
        const { data } = await api.get('/auth/me');
        if (cancelled) return;

        await setAuth(data.user, token);

        // Route by role — students and lecturers both have mobile
        // experiences; admins still get bounced to the web app.
        if (data.user.role === 'student') {
          router.replace('/student');
        } else if (data.user.role === 'lecturer') {
          router.replace('/lecturer');
        } else {
          router.replace('/auth/use-web');
        }
      } catch {
        // Token is invalid/expired, or network failed — treat as logged out
        if (!cancelled) {
          await logout();
          router.replace('/auth/login');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{
      flex:            1,
      backgroundColor: t.colors.bg,
      alignItems:      'center',
      justifyContent:  'center',
      gap:             t.spacing.md,
    }}>
      {/* Brand mark */}
      <View style={{
        width:           72,
        height:          72,
        borderRadius:    t.radius.molecular,
        backgroundColor: t.colors.brand,
        alignItems:      'center',
        justifyContent:  'center',
        ...t.shadow.brand,
      }}>
        <Text style={{
          fontFamily: t.fontFamily.displayBold,
          fontSize:   t.fontSize.xxl,
          color:      '#fff',
          lineHeight: t.fontSize.xxl,
        }}>
          A
        </Text>
      </View>

      <Text style={{
        fontFamily:    t.fontFamily.displayBold,
        fontSize:      t.fontSize.xl,
        color:         t.colors.textPrimary,
        letterSpacing: t.letterSpacing.tight,
      }}>
        AttendX
      </Text>

      {checking && (
        <ActivityIndicator
          size="small"
          color={t.colors.textMuted}
          style={{ marginTop: t.spacing.xs }}
        />
      )}
    </View>
  );
}