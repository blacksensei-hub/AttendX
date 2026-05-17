import { useState }                           from 'react';
import { View, Text, Alert }                  from 'react-native';
import Animated, {
  FadeInUp,
}                                             from 'react-native-reanimated';
import { router, Link }                       from 'expo-router';
import {
  Mail, Lock, LogIn, ArrowRight,
  Eye, EyeOff,
}                                             from 'lucide-react-native';

import api                                    from '../../services/api';
import { useAuthStore }                       from '../../store/authStore';

import { useTheme }                           from '../../src/theme/ThemeProvider';
import Card                                   from '../../src/components/ui/Card';
import Button                                 from '../../src/components/ui/Button';
import Input                                  from '../../src/components/ui/Input';
import IconTile                               from '../../src/components/ui/IconTile';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LoginScreen — mobile.
 *
 * Role-based routing:
 *   • student  → /student
 *   • lecturer → /lecturer
 *   • admin    → /auth/use-web (admin tools are web-only)
 *
 * Two demo autofill buttons are exposed so the same APK can be used
 * to demo both the student flow and the lecturer flow without typing
 * credentials each time.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LoginScreen() {
  const t       = useTheme();
  const setAuth = useAuthStore(s => s.setAuth);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      await setAuth(data.user, data.token);

      // Route by role — admins get bounced to web; everyone else
      // has a mobile experience.
      if (data.user.role === 'student') {
        router.replace('/student');
      } else if (data.user.role === 'lecturer') {
        router.replace('/lecturer');
      } else {
        router.replace('/auth/use-web');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Check your credentials and try again';
      setError(msg);
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // Demo autofill helpers — both accounts share the same password
  // (demo1234) which is set up by the seed script in src/scripts/seed.js
  const fillDemoStudent = () => {
    setEmail('student@demo.com');
    setPassword('demo1234');
    setError('');
  };

  const fillDemoLecturer = () => {
    setEmail('lecturer@demo.com');
    setPassword('demo1234');
    setError('');
  };

  return (
    <View style={{ gap: t.spacing.lg }}>

      {/* ── Hero ───────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(DURATION.slow)}
        style={{ alignItems: 'flex-start', gap: t.spacing.sm }}
      >
        <IconTile icon={LogIn} tone="brand" size="lg" shadow />
        <View style={{ gap: 4 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
            lineHeight:    t.fontSize.xxl * 1.1,
          }}>
            Welcome back
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
            lineHeight: t.fontSize.sm * 1.5,
          }}>
            Sign in to AttendX to mark your attendance.
          </Text>
        </View>
      </Animated.View>

      {/* ── Form card ──────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(100).duration(DURATION.slow)}>
        <Card accent="brand" accentIntensity="subtle">
          <View style={{ gap: t.spacing.md }}>
            <Input
              label="Email address"
              icon={Mail}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              placeholder="you@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error && !email ? 'Email is required' : null}
            />

            <Input
              label="Password"
              icon={Lock}
              iconRight={showPw ? EyeOff : Eye}
              onIconRightPress={() => setShowPw(!showPw)}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder="Enter your password"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete="password"
              mono={showPw}
              error={error && !password ? 'Password is required' : null}
            />

            <Button
              label="Sign in"
              iconRight={ArrowRight}
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>
        </Card>
      </Animated.View>

      {/* ── Demo credentials ───────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(200).duration(DURATION.slow)}>
        <Card variant="raised" padded>
          <Text style={{
            fontFamily:    t.fontFamily.mono,
            fontSize:      10,
            color:         t.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight:    '700',
            marginBottom:  t.spacing.sm,
          }}>
            Demo credentials · tap to autofill
          </Text>
          <View style={{ gap: t.spacing.xs + 2 }}>
            <Button
              label="student@demo.com"
              variant="secondary"
              size="sm"
              onPress={fillDemoStudent}
              fullWidth
            />
            <Button
              label="lecturer@demo.com"
              variant="secondary"
              size="sm"
              onPress={fillDemoLecturer}
              fullWidth
            />
          </View>
        </Card>
      </Animated.View>

      {/* ── Register link ──────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(DURATION.slow)}
        style={{ alignItems: 'center', paddingTop: t.spacing.sm }}
      >
        <Link href="/auth/register" asChild>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
          }}>
            New to AttendX?{' '}
            <Text style={{
              color:      t.colors.brandText,
              fontFamily: t.fontFamily.bodySemibold,
            }}>
              Create an account
            </Text>
          </Text>
        </Link>
      </Animated.View>
    </View>
  );
}