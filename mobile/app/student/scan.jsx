import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Vibration,
}                                                 from 'react-native';
import { CameraView, useCameraPermissions }       from 'expo-camera';
import * as Location                              from 'expo-location';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
  withSpring, FadeIn, FadeOut,
}                                                 from 'react-native-reanimated';
import {
  X, Camera as CameraIcon, ScanLine,
  CheckCircle2, XCircle, Loader2, MapPin,
}                                                 from 'lucide-react-native';

import api                                        from '../../services/api';
import { getDeviceId }                            from '../../src/lib/deviceId';
import { useTheme }                               from '../../src/theme/ThemeProvider';
import Screen                                     from '../../src/components/ui/Screen';
import Card                                       from '../../src/components/ui/Card';
import Button                                     from '../../src/components/ui/Button';
import IconTile                                   from '../../src/components/ui/IconTile';
import {
  SPRING, EASE, DURATION, TAP,
}                                                 from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ScanScreen — student-side QR scanner.
 *
 * Three states:
 *   1. No camera permission → themed prompt screen
 *   2. Scanning             → camera viewfinder with branded chrome
 *   3. Result (success/err) → overlay card with the outcome
 *
 * The viewfinder UI stays dark regardless of theme — bright
 * surfaces wash out a camera preview and ruin contrast for the
 * scan reticle. Only the permission screen and result feedback
 * respect theme tokens.
 *
 * Flow:
 *   • Camera scans QR → fires handleScan
 *   • Acquires GPS    → optional, sends lat/lng + isMockGps to backend
 *   • Reads stable deviceId → lets the backend detect proxy attendance
 *     (many different accounts marking from one physical device)
 *   • POST /attendance/mark with { sessionId, qrToken, location, deviceId }
 *   • Show result card → on success, redirect after 6s
 * ═════════════════════════════════════════════════════════════════
 */
export default function ScanScreen() {
  const t = useTheme();
  const { sessionId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();

  const [processing, setProcessing] = useState(false);
  const [result,     setResult]     = useState(null);  // 'success' | 'error'
  const [message,    setMessage]    = useState('');
  const hasScanned = useRef(false);

  // expo-camera's native preview can come back black on remount under
  // React Native's New Architecture — see expo/expo#31597. That report's
  // own description is specific: "the second time the camera mounts the
  // preview does not start up" — it's a SECOND-mount bug, not a general
  // remount bug.
  //
  // useFocusEffect fires on the very first focus too, not only on return
  // visits. An earlier version of this fix bumped cameraKey unconditionally
  // on every focus, which — on a screen's first-ever visit — immediately
  // unmounted the initial CameraView and mounted a second one, forcing
  // exactly the failure condition the upstream bug describes, on every
  // fresh navigation. hasFocusedBefore tracks whether this screen has
  // already been focused at least once, so the key only bumps on genuine
  // RETURN visits (navigate away, then back) — where the camera really
  // has been through a prior mount/unmount cycle and remounting is the
  // correct recovery. The very first visit leaves the initial CameraView
  // alone rather than manufacturing a second mount for no reason.
  const [cameraKey, setCameraKey] = useState(0);
  const hasFocusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedBefore.current) {
        hasFocusedBefore.current = true;
        return;
      }
      setCameraKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission?.granted, requestPermission]);

  const handleScan = async ({ data: qrToken }) => {
    if (hasScanned.current || processing) return;
    hasScanned.current = true;
    setProcessing(true);
    Vibration.vibrate(100);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude = 0, longitude = 0, isMock = false;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude  = loc.coords.latitude;
        longitude = loc.coords.longitude;
        isMock    = loc.mocked ?? false;
      }

      // Stable per-install identifier. getDeviceId never throws — it falls
      // back to a session ID rather than blocking the scan.
      const deviceId = await getDeviceId();

      const { data } = await api.post('/attendance/mark', {
        sessionId, qrToken, latitude, longitude, isMockGps: isMock, deviceId,
      });

      setResult('success');
      setMessage(data.message || 'Attendance marked');
      Vibration.vibrate([0, 100, 50, 100]);

      setTimeout(() => router.replace('/student'), 6000);
    } catch (err) {
      setResult('error');
      setMessage(err.response?.data?.message || 'Failed to mark attendance');

      // Reset for retry after 6s
      setTimeout(() => {
        hasScanned.current = false;
        setResult(null);
        setMessage('');
      }, 6000);
    } finally {
      setProcessing(false);
    }
  };

  // ── No permission yet — themed prompt ────────────────────────
  if (!permission?.granted) {
    return (
      <Screen scroll={false}>
        <View style={{
          flex:           1,
          alignItems:     'center',
          justifyContent: 'center',
          gap:            t.spacing.lg,
          padding:        t.spacing.lg,
        }}>
          <IconTile icon={CameraIcon} tone="brand" size="xl" shadow />

          <View style={{ alignItems: 'center', gap: 6, maxWidth: 320 }}>
            <Text style={{
              fontFamily:    t.fontFamily.displayBold,
              fontSize:      t.fontSize.xxl,
              color:         t.colors.textPrimary,
              letterSpacing: t.letterSpacing.tight,
              textAlign:     'center',
            }}>
              Camera access needed
            </Text>
            <Text style={{
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textMuted,
              textAlign:  'center',
              lineHeight: t.fontSize.sm * 1.5,
            }}>
              AttendX uses your camera to scan the QR code your lecturer displays. We don't record or store any video — only the code itself is processed.
            </Text>
          </View>

          <Button
            label="Grant camera permission"
            icon={CameraIcon}
            onPress={requestPermission}
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  // ── Camera + scanning UI (dark by design) ────────────────────
  return (
    <View style={s.container}>
      <CameraView
        key={cameraKey}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={!processing && !result ? handleScan : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dimming + framing overlay */}
      <View style={s.overlay}>

        {/* ── Top bar ─────────────────────────────────────── */}
        <View style={s.topBar}>
          <CloseButton onPress={() => router.replace('/student')} />

          <View style={s.topCenter}>
            <Text style={s.topTitle}>Scan QR code</Text>
            <Text style={s.topSubtitle}>Hold steady</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* ── Scan reticle ────────────────────────────────── */}
        <View style={s.frameWrap}>
          <ScanReticle scanning={!processing && !result} />
        </View>

        {/* ── Bottom feedback area ─────────────────────────── */}
        <View style={s.bottom}>
          {processing && <ProcessingCard />}
          {result === 'success' && <SuccessCard message={message} />}
          {result === 'error'   && <ErrorCard message={message} />}
          {!processing && !result && (
            <Hint />
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Close button ──────────────────────────────────────────────
function CloseButton({ onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        onTouchStart={() => { scale.value = withSpring(TAP.button, SPRING.snappy); }}
        onTouchEnd={()   => { scale.value = withSpring(1, SPRING.snappy); onPress(); }}
        style={s.closeBtn}
      >
        <X size={20} color="#fff" strokeWidth={2.4} />
      </View>
    </Animated.View>
  );
}

// ─── Scan reticle with animated corner pulse + sweeping line ──
function ScanReticle({ scanning }) {
  const sweepY = useSharedValue(0);
  const cornerOpacity = useSharedValue(1);

  useEffect(() => {
    if (scanning) {
      sweepY.value = withRepeat(
        withSequence(
          withTiming(220, { duration: 2000, easing: EASE.state }),
          withTiming(0,   { duration: 0    }),
        ),
        -1, false
      );
      cornerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 900, easing: EASE.state }),
          withTiming(1,    { duration: 900, easing: EASE.state }),
        ),
        -1, false
      );
    } else {
      sweepY.value = 0;
      cornerOpacity.value = 1;
    }
  }, [scanning, sweepY, cornerOpacity]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweepY.value }],
    opacity:   scanning ? 1 : 0,
  }));

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: cornerOpacity.value,
  }));

  return (
    <View style={s.frame}>
      {/* Sweeping scan line — only during active scanning */}
      <Animated.View style={[s.sweep, sweepStyle]} />

      {/* Four corner brackets — pulse softly while scanning */}
      <Animated.View style={[s.corner, s.tl, cornerStyle]} />
      <Animated.View style={[s.corner, s.tr, cornerStyle]} />
      <Animated.View style={[s.corner, s.bl, cornerStyle]} />
      <Animated.View style={[s.corner, s.br, cornerStyle]} />
    </View>
  );
}

// ─── Hint text + scanning indicator ────────────────────────────
function Hint() {
  return (
    <Animated.View entering={FadeIn.duration(DURATION.slow)}>
      <View style={s.hintBox}>
        <ScanLine size={16} color="#fff" strokeWidth={2.2} />
        <Text style={s.hintText}>
          Point your camera at the QR code on your lecturer's screen
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Processing card (spinner + label) ─────────────────────────
function ProcessingCard() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: EASE.linear }),
      -1, false
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.fast)}
      exiting={FadeOut.duration(DURATION.fast)}
      style={s.resultBox}
    >
      <Animated.View style={spinStyle}>
        <Loader2 size={24} color="#fff" strokeWidth={2.4} />
      </Animated.View>
      <Text style={s.resultText}>Verifying location…</Text>
      <View style={s.resultSubRow}>
        <MapPin size={11} color="rgba(255,255,255,0.6)" />
        <Text style={s.resultSub}>Checking you're inside the geofence</Text>
      </View>
    </Animated.View>
  );
}

// ─── Success card ──────────────────────────────────────────────
function SuccessCard({ message }) {
  const scale = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withSpring(1, SPRING.bounce);
  }, [scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base)}
      style={[s.resultBox, s.successBox]}
    >
      <Animated.View style={iconStyle}>
        <CheckCircle2 size={32} color={TEAL} strokeWidth={2.4} />
      </Animated.View>
      <Text style={s.resultText}>{message}</Text>
      <Text style={s.resultSub}>Redirecting to dashboard…</Text>
    </Animated.View>
  );
}

// ─── Error card ────────────────────────────────────────────────
function ErrorCard({ message }) {
  const shakeX = useSharedValue(0);

  useEffect(() => {
    shakeX.value = withSequence(
      withTiming(-6, { duration: 60 }),
      withTiming( 6, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming( 4, { duration: 60 }),
      withTiming( 0, { duration: 60 }),
    );
  }, [shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base)}
      style={[shakeStyle]}
    >
      <View style={[s.resultBox, s.errorBox]}>
        <XCircle size={32} color="#FF6B77" strokeWidth={2.4} />
        <Text style={s.resultText}>{message}</Text>
        <Text style={s.resultSub}>Try again in a moment</Text>
      </View>
    </Animated.View>
  );
}

// ─── Camera UI styles (intentionally NOT theme-aware) ─────────
//
// The scan camera uses a dark UI regardless of app theme. Bright
// surfaces wash out the camera preview and reduce contrast on the
// reticle. Apple's Code Scanner, Google Lens, and every QR app I
// can think of use the same convention.
const FRAME_SIZE = 240;
const CORNER_LEN = 32;
const CORNER_W   = 4;
const BRAND_COLOR = '#6F8BFF';   // the bracket blue from the AttendX mark
const TEAL        = '#14C9A6';   // the check: present

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#070D1F' },
  overlay:    { flex: 1, backgroundColor: 'rgba(7,13,31,0.45)' },

  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        16,
    paddingTop:     56,
  },
  closeBtn: {
    width:           40,
    height:          40,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.22)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  topCenter: { alignItems: 'center', gap: 2 },
  topTitle: {
    color:      '#EEF1F7',
    fontFamily: 'Bricolage-Bold',
    fontSize:   17,
    letterSpacing: -0.4,
  },
  topSubtitle: {
    color:      'rgba(238,241,247,0.56)',
    fontFamily: 'PlexMono',
    fontSize:   10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  frameWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame:      {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position:    'absolute',
    width:       CORNER_LEN,
    height:      CORNER_LEN,
    borderColor: BRAND_COLOR,
  },
  tl: { top: 0,    left: 0,  borderTopWidth: CORNER_W,    borderLeftWidth: CORNER_W,   borderTopLeftRadius: 14 },
  tr: { top: 0,    right: 0, borderTopWidth: CORNER_W,    borderRightWidth: CORNER_W,  borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0,  borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W,  borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: 14 },

  // The animated horizontal sweep line
  sweep: {
    position:        'absolute',
    left:            0,
    right:           0,
    top:             0,
    height:          2,
    backgroundColor: TEAL,
    shadowColor:     TEAL,
    shadowOpacity:   0.9,
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    8,
    elevation:       6,
  },
  bottom: {
    padding:       24,
    paddingBottom: 64,
    alignItems:    'center',
    minHeight:     120,
    justifyContent:'flex-end',
  },

  hintBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: 'rgba(8,12,26,0.6)',
    borderWidth:     1,
    borderColor:     'rgba(150,165,220,0.22)',
    borderRadius:    14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth:        320,
  },
  hintText: {
    color:      'rgba(238,241,247,0.85)',
    fontFamily: 'Figtree',
    fontSize:   13,
    flexShrink: 1,
    lineHeight: 16,
  },

  resultBox: {
    backgroundColor: 'rgba(7,13,31,0.9)',
    borderRadius:    20,
    paddingVertical:   20,
    paddingHorizontal: 24,
    alignItems:      'center',
    gap:             10,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    minWidth:        260,
    maxWidth:        320,
  },
  successBox: { borderColor: 'rgba(20,201,166,0.55)' },
  errorBox:   { borderColor: 'rgba(255,107,119,0.5)' },

  resultText: {
    color:      '#EEF1F7',
    fontFamily: 'Figtree-SemiBold',
    fontSize:   16,
    textAlign:  'center',
    lineHeight: 20,
  },
  resultSub: {
    color:    'rgba(238,241,247,0.56)',
    fontFamily: 'PlexMono',
    fontSize: 11,
    textAlign:'center',
  },
  resultSubRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
});