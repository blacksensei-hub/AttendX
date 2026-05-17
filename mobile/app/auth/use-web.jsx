import { useState }                           from 'react';
import { View, Text, Linking, Alert }         from 'react-native';
import Animated, { FadeInUp }                 from 'react-native-reanimated';
import { router }                             from 'expo-router';
import {
  Globe, Copy, Check, LogOut,
}                                             from 'lucide-react-native';
import * as Clipboard                         from 'expo-clipboard';

import { useAuthStore }                       from '../../store/authStore';
import { useTheme }                           from '../../src/theme/ThemeProvider';
import Card                                   from '../../src/components/ui/Card';
import Button                                 from '../../src/components/ui/Button';
import IconTile                               from '../../src/components/ui/IconTile';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * UseWebScreen — shown when a lecturer or admin logs in on mobile.
 *
 * Mobile is student-only. Rather than quietly failing or showing
 * a broken lecturer area, we surface a clean message explaining
 * the situation and offering:
 *   • Copy the web URL to clipboard
 *   • Open the web app in the default browser
 *   • Log out and sign in as a different account
 * ═════════════════════════════════════════════════════════════════
 */
const WEB_URL = 'https://attendx.app';  // adjust when deployed

export default function UseWebScreen() {
  const t      = useTheme();
  const user   = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(WEB_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Copy failed', 'Could not copy to clipboard.');
    }
  };

  const handleOpen = () => {
    Linking.openURL(WEB_URL).catch(() =>
      Alert.alert('Could not open browser', WEB_URL)
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const roleLabel = user?.role === 'lecturer' ? 'Lecturer'
                  : user?.role === 'admin'    ? 'Administrator'
                  :                             'Staff';

  return (
    <View style={{ gap: t.spacing.lg }}>
      <Animated.View
        entering={FadeInUp.duration(DURATION.slow)}
        style={{ alignItems: 'center', gap: t.spacing.md }}
      >
        <IconTile icon={Globe} tone="brand" size="xl" shadow />

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
            textAlign:     'center',
          }}>
            Use the web app
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
            textAlign:  'center',
            lineHeight: t.fontSize.sm * 1.5,
            maxWidth:   300,
          }}>
            The mobile app is for students. {roleLabel} accounts work best on the full AttendX web app.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100).duration(DURATION.slow)}>
        <Card accent="brand" accentIntensity="bold">
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{
              fontFamily:    t.fontFamily.mono,
              fontSize:      10,
              color:         t.colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontWeight:    '700',
            }}>
              Web URL
            </Text>

            <View style={{
              padding:         t.spacing.sm,
              backgroundColor: t.colors.bgRaised,
              borderRadius:    t.radius.atomic,
              borderWidth:     1,
              borderColor:     t.colors.border,
            }}>
              <Text style={{
                fontFamily: t.fontFamily.mono,
                fontSize:   t.fontSize.sm,
                color:      t.colors.brandText,
                fontWeight: '700',
              }}>
                {WEB_URL}
              </Text>
            </View>

            <Button
              label={copied ? 'Copied ✓' : 'Copy URL'}
              icon={copied ? Check : Copy}
              variant="secondary"
              onPress={handleCopy}
              fullWidth
            />
            <Button
              label="Open in browser"
              icon={Globe}
              onPress={handleOpen}
              fullWidth
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(DURATION.slow)}>
        <Button
          label="Sign out"
          icon={LogOut}
          variant="ghost"
          onPress={handleLogout}
          fullWidth
        />
      </Animated.View>
    </View>
  );
}