// mobile/app/student/scan.jsx
import { useState, useEffect, useRef }            from 'react';
import {
  View, Text, StyleSheet, Vibration,
}                                                 from 'react-native';
import { CameraView, useCameraPermissions }       from 'expo-camera';
import * as Location                              from 'expo-location';
import { router, useLocalSearchParams }           from 'expo-router';
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
import { useTheme }                               from '../../src/theme/ThemeProvider';
import Screen                                     from '../../src/components/ui/Screen';
import Card                                       from '../../src/components/ui/Card';
import Button                                     from '../../src/components/ui/Button';
import IconTile                                   from '../../src/components/ui/IconTile';
import {
  SPRING, EASE, DURATION, TAP,
}                                                 from '../../src/lib/motion';

export default function ScanScreen() {
  const t = useTheme();
  const { sessionId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();

  const [processing,   setProcessing]   = useState(false);
  const [result,       setResult]       = useState(null);   // 'success' | 'error'
  const [message,      setMessage]      = useState('');
  const [hasGeofence,  setHasGeofence]  = useState(false);  // true only when geo coords exist
  const hasScanned = useRef(false);

  // ── Pre-fetch session to check geofence status ───────────────
  // We need to know BEFORE scanning whether to request GPS.
  // If we request GPS unnecessarily, it takes 3-4 seconds and the
  // QR token rotates in that time, causing "Session not found".
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/sessions/${sessionId}`)
      .then(res => {
        const session = res.data?.data?.session ?? res.data?.session ?? {};
        const geo = session.geo_lat && session.geo_lng && session.geo_radius;
        setHasGeofence(Boolean(geo));
      })
      .catch(() => {
        // If we can't fetch session details, assume no geofence
        setHasGeofence(false);
      });
  }, [sessionId]);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission?.granted, requestPermission]);

  const handleScan = async ({ data: qrToken }) => {
    if (hasScanned.current || processing) return;
    hasScanned.current = true;
    setProcessing(true);
    Vibration.vibrate(100);

    try {
      let latitude = 0, longitude = 0, isMock = false;

      // Only acquire GPS when the session actually has a geofence.
      // Skipping this saves 3-4 seconds and prevents the QR token
      // from expiring before the mark request reaches the server.
      if (hasGeofence) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          latitude  = loc.coords.latitude;
          longitude = loc.coords.longitude;
          isMock    = loc.mocked ?? false;
        }
      }

      const { data } = await api.post('/attendance/mark', {
        sessionId, qrToken, latitude, longitude, isMockGps: isMock,
      });

      setResult('success');
      setMessage(data.message || 'Attendance marked');
      Vibration.vibrate([0, 100, 50, 100]);
      setTimeout(() => router.replace({ pathname: '/student', params: { scanned: '1' } }), 2500);
    } catch (err) {
      setResult('error');
      setMessage(err.response?.data?.message || 'Failed to mark attendance');
      setTimeout(() => {
        hasScanned.current = false;
        setResult(null);
        setMessage('');
      }, 3000);
    } finally {
      setProcessing(false);
    }
  };

  // ── No permission yet ─────────────────────────────────────────
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

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={!processing && !result ? handleScan : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={s.overlay}>

        {/* Top bar */}
        <View style={s.topBar}>
          <CloseButton onPress={() => router.replace('/student')} />
          <View style={s.topCenter}>
            <Text style={s.topTitle}>Scan QR code</Text>
            <Text style={s.topSubtitle}>Hold steady</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Scan reticle */}
        <View style={s.frameWrap}>
          <ScanReticle scanning={!processing && !result} />
        </View>

        {/* Bottom feedback area */}
        <View style={s.bottom}>
          {processing && <ProcessingCard hasGeofence={hasGeofence} />}
          {result === 'success' && <SuccessCard message={message} />}
          {result === 'error'   && <ErrorCard message={message} />}
          {!processing && !result && <Hint />}
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

// ─── Scan reticle ──────────────────────────────────────────────
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
      <Animated.View style={[s.sweep, sweepStyle]} />
      <Animated.View style={[s.corner, s.tl, cornerStyle]} />
      <Animated.View style={[s.corner, s.tr, cornerStyle]} />
      <Animated.View style={[s.corner, s.bl, cornerStyle]} />
      <Animated.View style={[s.corner, s.br, cornerStyle]} />
    </View>
  );
}

// ─── Hint ──────────────────────────────────────────────────────
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

// ─── Processing card ───────────────────────────────────────────
// Shows "Verifying location" only when geofence is active;
// shows "Marking attendance" when no geofence is needed.
function ProcessingCard({ hasGeofence }) {
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
      <Text style={s.resultText}>
        {hasGeofence ? 'Verifying location…' : 'Marking attendance…'}
      </Text>
      {hasGeofence && (
        <View style={s.resultSubRow}>
          <MapPin size={11} color="rgba(255,255,255,0.6)" />
          <Text style={s.resultSub}>Checking you're inside the geofence</Text>
        </View>
      )}
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
        <CheckCircle2 size={32} color="#10b981" strokeWidth={2.4} />
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
        <XCircle size={32} color="#ef4444" strokeWidth={2.4} />
        <Text style={s.resultText}>{message}</Text>
        <Text style={s.resultSub}>Try again in a moment</Text>
      </View>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const FRAME_SIZE  = 240;
const CORNER_LEN  = 32;
const CORNER_W    = 4;
const BRAND_COLOR = '#3b82f6';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },

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
  topCenter:   { alignItems: 'center', gap: 2 },
  topTitle:    { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  topSubtitle: {
    color: 'rgba(255,255,255,0.55)', fontSize: 10,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2,
  },

  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame:     { width: FRAME_SIZE, height: FRAME_SIZE, position: 'relative', overflow: 'hidden' },

  corner:    { position: 'absolute', width: CORNER_LEN, height: CORNER_LEN, borderColor: BRAND_COLOR },
  tl: { top: 0,    left: 0,  borderTopWidth: CORNER_W,    borderLeftWidth: CORNER_W  },
  tr: { top: 0,    right: 0, borderTopWidth: CORNER_W,    borderRightWidth: CORNER_W },
  bl: { bottom: 0, left: 0,  borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W  },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },

  sweep: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 2,
    backgroundColor: BRAND_COLOR,
    shadowColor: BRAND_COLOR, shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, elevation: 6,
  },

  bottom: {
    padding: 24, paddingBottom: 64,
    alignItems: 'center', minHeight: 120, justifyContent: 'flex-end',
  },

  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 320,
  },
  hintText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, flexShrink: 1, lineHeight: 16 },

  resultBox: {
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 18,
    paddingVertical: 20, paddingHorizontal: 24,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 260, maxWidth: 320,
  },
  successBox: { borderColor: 'rgba(16,185,129,0.5)' },
  errorBox:   { borderColor: 'rgba(239,68,68,0.5)'  },

  resultText: { color: '#fff', fontSize: 15, textAlign: 'center', fontWeight: '600', lineHeight: 20 },
  resultSub:  { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center' },
  resultSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});