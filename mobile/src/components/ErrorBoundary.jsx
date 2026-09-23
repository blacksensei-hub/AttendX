import { Component } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react-native';

import { useAuthStore } from '../../store/authStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * ErrorBoundary — mobile counterpart to the web ErrorBoundary.
 *
 * Why a class component:
 *   React's error boundary API is only available on class components.
 *   No hook equivalent, so this is the one place in the mobile app
 *   that uses class syntax.
 *
 * Recovery strategy on mobile:
 *   We can't "reload the page" the way the web app can. Two recovery
 *   paths instead:
 *
 *     • Try again — clear the error state, attempt to re-render the
 *       tree below. Works for transient errors (e.g. one bad API
 *       response that never gets retried).
 *
 *     • Sign out — clear auth and bounce to /auth/login. This is the
 *       nuclear option for errors that come from corrupted user data
 *       or stale tokens. After sign-in the tree is fresh.
 *
 * Theming:
 *   We deliberately don't use the theme tokens here. If the error
 *   originates inside ThemeProvider's render, useTheme() would itself
 *   throw and we'd loop infinitely. Hardcoded dark colours keep the
 *   fallback always renderable.
 *
 * The error itself is logged to the JS console for development. In
 * production this would be wired to an error reporter (Sentry, etc.).
 * ═════════════════════════════════════════════════════════════════
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleSignOut = async () => {
    // Hard reset: clear auth, then clear the error so the next
    // render falls into the auth flow naturally (the auth state
    // change will route via _layout's auth guard if there is one,
    // or the next API call will 401 and trigger a redirect).
    try {
      await useAuthStore.getState().clearAuth();
    } catch {
      // Even if clearAuth throws, we still want to drop the error
      // state so the user isn't stuck on this screen.
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={{
        flex:            1,
        backgroundColor: '#0A0A0F', // matches dark theme bg
        padding:         24,
      }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow:        1,
            justifyContent:  'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Icon tile */}
          <View style={{
            width:           64,
            height:          64,
            borderRadius:    14,
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            borderWidth:     1,
            borderColor:     'rgba(239, 68, 68, 0.32)',
            alignItems:      'center',
            justifyContent:  'center',
            alignSelf:       'center',
            marginBottom:    16,
          }}>
            <AlertTriangle size={28} color="#ef4444" />
          </View>

          <Text style={{
            color:         '#fff',
            fontSize:      22,
            fontWeight:    '700',
            textAlign:     'center',
            marginBottom:  6,
            letterSpacing: -0.3,
          }}>
            Something went wrong
          </Text>

          <Text style={{
            color:        'rgba(255, 255, 255, 0.6)',
            fontSize:     14,
            textAlign:    'center',
            lineHeight:   20,
            marginBottom: 20,
            maxWidth:     380,
            alignSelf:    'center',
          }}>
            AttendX hit an unexpected error. Try again, or sign out and
            back in if it keeps happening.
          </Text>

          {/* Error detail in mono — same pattern as web */}
          {this.state.error?.message && (
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderWidth:     1,
              borderColor:     'rgba(255, 255, 255, 0.08)',
              borderRadius:    10,
              padding:         12,
              marginBottom:    20,
              alignSelf:       'stretch',
              maxWidth:        420,
              width:           '100%',
            }}>
              <Text style={{
                color:         'rgba(255, 255, 255, 0.5)',
                fontSize:      10,
                fontWeight:    '700',
                letterSpacing: 1,
                marginBottom:  4,
              }}>
                ERROR DETAIL
              </Text>
              <Text style={{
                color:    'rgba(255, 255, 255, 0.8)',
                fontSize: 12,
                fontFamily: 'JetBrainsMono',
              }}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          <View style={{
            flexDirection:  'row',
            gap:            10,
            justifyContent: 'center',
            flexWrap:       'wrap',
          }}>
            <Pressable
              onPress={this.handleRetry}
              style={({ pressed }) => ({
                flexDirection:    'row',
                alignItems:       'center',
                gap:              8,
                paddingVertical:   12,
                paddingHorizontal: 18,
                borderRadius:      10,
                backgroundColor:   pressed ? '#3563ec' : '#4f7fff',
              })}
            >
              <RefreshCw size={15} color="#fff" />
              <Text style={{
                color:      '#fff',
                fontSize:   14,
                fontWeight: '600',
              }}>
                Try again
              </Text>
            </Pressable>

            <Pressable
              onPress={this.handleSignOut}
              style={({ pressed }) => ({
                flexDirection:    'row',
                alignItems:       'center',
                gap:              8,
                paddingVertical:   12,
                paddingHorizontal: 18,
                borderRadius:      10,
                backgroundColor:   pressed
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.04)',
                borderWidth:       1,
                borderColor:       'rgba(255, 255, 255, 0.12)',
              })}
            >
              <LogOut size={15} color="rgba(255, 255, 255, 0.7)" />
              <Text style={{
                color:      'rgba(255, 255, 255, 0.7)',
                fontSize:   14,
                fontWeight: '600',
              }}>
                Sign out
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }
}