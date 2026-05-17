import { useState }                           from 'react';
import { View, Text, Alert }                  from 'react-native';
import Animated, {
  FadeInUp, FadeIn, FadeOut,
}                                             from 'react-native-reanimated';
import { router, Link }                       from 'expo-router';
import {
  User, Mail, Lock, Hash, UserPlus,
  ArrowRight, Eye, EyeOff, GraduationCap,
  Check, X,
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
 * RegisterScreen — mobile.
 *
 * Student-only registration. The role selector is gone (replaced
 * by a friendly "Signing up as Student" notice) since mobile only
 * supports students.
 *
 * Live password strength checklist gives immediate feedback on
 * which requirements are met — matches the web's pattern.
 * ═════════════════════════════════════════════════════════════════
 */
export default function RegisterScreen() {
  const t       = useTheme();
  const setAuth = useAuthStore(s => s.setAuth);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPw: '',
    role: 'student', studentId: '',
  });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const update = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setError('');
  };

  // Live password strength checks
  const checks = [
    { label: '8+ chars',    pass: form.password.length >= 8          },
    { label: '1 uppercase', pass: /[A-Z]/.test(form.password)         },
    { label: '1 number',    pass: /[0-9]/.test(form.password)         },
  ];

  const passwordsMatch = form.confirmPw.length > 0
    && form.password === form.confirmPw;

  const handleRegister = async () => {
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (checks.some(c => !c.pass)) {
      setError('Password must be 8+ chars, 1 uppercase, 1 number');
      return;
    }
    if (form.password !== form.confirmPw) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        ...form,
        name:  form.name.trim(),
        email: form.email.trim(),
      });
      await setAuth(data.user, data.token);
      router.replace('/student');
    } catch (err) {
      const msg = err.response?.data?.message || 'Please try again';
      setError(msg);
      Alert.alert('Registration failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: t.spacing.lg }}>

      {/* ── Hero ───────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(DURATION.slow)}
        style={{ alignItems: 'flex-start', gap: t.spacing.sm }}
      >
        <IconTile icon={UserPlus} tone="brand" size="lg" shadow />
        <View style={{ gap: 4 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
            lineHeight:    t.fontSize.xxl * 1.1,
          }}>
            Create your account
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
            lineHeight: t.fontSize.sm * 1.5,
          }}>
            Join AttendX to track your class attendance.
          </Text>
        </View>
      </Animated.View>

      {/* ── Student-only notice ────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
        <View style={{
          flexDirection:   'row',
          alignItems:      'center',
          gap:             t.spacing.sm,
          padding:         t.spacing.sm,
          backgroundColor: t.colors.brandSubtle,
          borderWidth:     1,
          borderColor:     t.colors.brandBorder,
          borderRadius:    t.radius.atomic,
        }}>
          <IconTile icon={GraduationCap} tone="brand" size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: t.fontFamily.bodySemibold,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textPrimary,
            }}>
              Signing up as Student
            </Text>
            <Text style={{
              fontFamily: t.fontFamily.body,
              fontSize:   11,
              color:      t.colors.textMuted,
              marginTop:  2,
              lineHeight: 14,
            }}>
              Lecturers and admins, use the web app at attendx.app
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Form card ──────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(160).duration(DURATION.slow)}>
        <Card accent="brand" accentIntensity="subtle">
          <View style={{ gap: t.spacing.md }}>

            <Input
              label="Full name"
              icon={User}
              value={form.name}
              onChangeText={v => update('name', v)}
              placeholder="Kwame Mensah"
              autoCapitalize="words"
              autoComplete="name"
            />

            <Input
              label="Email"
              icon={Mail}
              value={form.email}
              onChangeText={v => update('email', v)}
              placeholder="you@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Student ID (optional)"
              icon={Hash}
              value={form.studentId}
              onChangeText={v => update('studentId', v)}
              placeholder="10XXXXXX"
              autoCapitalize="characters"
              mono
            />

            <View style={{ gap: 8 }}>
              <Input
                label="Password"
                icon={Lock}
                iconRight={showPw ? EyeOff : Eye}
                onIconRightPress={() => setShowPw(!showPw)}
                value={form.password}
                onChangeText={v => update('password', v)}
                placeholder="Create a password"
                secureTextEntry={!showPw}
                autoCapitalize="none"
                mono={showPw}
              />

              {/* Live strength pills — shown once user starts typing */}
              {form.password.length > 0 && (
                <Animated.View
                  entering={FadeIn.duration(DURATION.base)}
                  exiting={FadeOut.duration(DURATION.fast)}
                  style={{
                    flexDirection: 'row',
                    flexWrap:      'wrap',
                    gap:           6,
                  }}
                >
                  {checks.map(c => (
                    <StrengthPill key={c.label} t={t} pass={c.pass} label={c.label} />
                  ))}
                </Animated.View>
              )}
            </View>

            <Input
              label="Confirm password"
              icon={Lock}
              value={form.confirmPw}
              onChangeText={v => update('confirmPw', v)}
              placeholder="Repeat your password"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              error={
                form.confirmPw.length > 0 && !passwordsMatch
                  ? 'Passwords do not match'
                  : null
              }
              hint={passwordsMatch ? 'Passwords match ✓' : null}
            />

            {error ? (
              <Text style={{
                fontFamily: t.fontFamily.mono,
                fontSize:   11,
                color:      t.colors.red,
              }}>
                {error}
              </Text>
            ) : null}

            <Button
              label="Create account"
              iconRight={ArrowRight}
              onPress={handleRegister}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>
        </Card>
      </Animated.View>

      {/* ── Sign in link ───────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.delay(240).duration(DURATION.slow)}
        style={{ alignItems: 'center' }}
      >
        <Link href="/auth/login" asChild>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
          }}>
            Already have an account?{' '}
            <Text style={{
              color:      t.colors.brandText,
              fontFamily: t.fontFamily.bodySemibold,
            }}>
              Sign in
            </Text>
          </Text>
        </Link>
      </Animated.View>
    </View>
  );
}

// ─── Password strength pill ────────────────────────────────────
function StrengthPill({ t, pass, label }) {
  const color  = pass ? t.colors.green        : t.colors.textMuted;
  const bg     = pass ? t.colors.greenBg      : t.colors.bgRaised;
  const border = pass ? t.colors.greenBorder  : t.colors.border;
  const Icon   = pass ? Check                 : X;

  return (
    <View style={{
      flexDirection:     'row',
      alignItems:        'center',
      gap:               4,
      paddingVertical:   3,
      paddingHorizontal: 8,
      backgroundColor:   bg,
      borderWidth:       1,
      borderColor:       border,
      borderRadius:      t.radius.pill,
    }}>
      <Icon size={10} color={color} strokeWidth={3} />
      <Text style={{
        fontFamily:    t.fontFamily.mono,
        fontSize:      10,
        fontWeight:    '700',
        color,
      }}>
        {label}
      </Text>
    </View>
  );
}