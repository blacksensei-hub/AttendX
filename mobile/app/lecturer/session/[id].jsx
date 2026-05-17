import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Alert, Dimensions }            from 'react-native';
import { router, useLocalSearchParams }             from 'expo-router';
import Animated, {
  FadeInUp, FadeIn, SlideInRight,
  useSharedValue, useAnimatedStyle, withSequence,
  withSpring, withTiming, withDelay,
}                                                   from 'react-native-reanimated';
import QRCode                                       from 'react-native-qrcode-svg';
import {
  ArrowLeft, Radio, Users, CheckCircle,
  StopCircle, RefreshCw, Wifi, WifiOff,
}                                                   from 'lucide-react-native';
import { format }                                   from 'date-fns';

import api          from '../../../services/api';
import socket       from '../../../services/socket';

import { useTheme }  from '../../../src/theme/ThemeProvider';
import Screen        from '../../../src/components/ui/Screen';
import Card          from '../../../src/components/ui/Card';
import Button        from '../../../src/components/ui/Button';
import IconTile      from '../../../src/components/ui/IconTile';
import StatusPill    from '../../../src/components/ui/StatusPill';
import { DURATION } from '../../../src/lib/motion';

// Polling intervals — see the data fetching block for why both exist.
const POLL_INTERVAL_FAST_MS   = 3000;  // when sockets are NOT connected
const POLL_INTERVAL_SLOW_MS   = 30000; // when sockets ARE connected (safety net)

/**
 * ═════════════════════════════════════════════════════════════════
 * Live session view — the demo centerpiece, now with real-time scans.
 *
 * Data flow:
 *
 *   On mount:
 *     1. Initial fetch of session, QR, and attendance records in parallel.
 *     2. Connect socket, join `session:{id}` room.
 *     3. Subscribe to 'attendance:marked' events for live scan pushes.
 *
 *   While running:
 *     • Each socket event prepends the new scan to records, plays
 *       a slide-in animation, bounces the relevant counter, and
 *       briefly highlights the new row.
 *     • A "safety net" poll runs every 30s when sockets are connected
 *       (catches anything we missed during a disconnect window) and
 *       every 3s when sockets are not connected (dumb fallback mode).
 *     • The QR token still rotates server-side. We refetch the token
 *       on the same polling cadence — the backend returns the same
 *       value if it's still valid, so this is cheap.
 *
 *   Dedup:
 *     We use the attendance record id as the dedup key. If the socket
 *     event arrives first AND the safety-net poll fetches the same
 *     record a few seconds later, the merge function below skips the
 *     duplicate so the row doesn't appear twice and counters stay correct.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LiveSessionScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams();

  const [session,     setSession]     = useState(null);
  const [token,       setToken]       = useState(null);
  const [records,     setRecords]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [closing,     setClosing]     = useState(false);
  const [socketLive,  setSocketLive]  = useState(false);

  // Track most-recently-added scan id so we can highlight it briefly.
  const [highlightId, setHighlightId] = useState(null);

  // Animation triggers for the counters. Each is a counter for "how many
  // times this stat has changed", used as a dependency in StatBlock so it
  // can run a bounce animation on every change.
  const presentBumpRef = useRef(0);
  const lateBumpRef    = useRef(0);
  const totalBumpRef   = useRef(0);

  // QR size — square, capped at 280px for readability on big phones
  const screenWidth = Dimensions.get('window').width;
  const qrSize = Math.min(screenWidth - t.spacing.lg * 4, 280);

  /* ── Merge helper: dedupe by id ────────────────────────────
   * Used in two places:
   *   - Initial fetch + safety-net polls overwrite the full list (dedup
   *     happens implicitly because there's only one source).
   *   - Socket events prepend a single new record; we use this helper
   *     to ensure we don't duplicate if a concurrent poll already added it. */
  const upsertRecord = (current, incoming) => {
    if (current.some(r => r.id === incoming.id)) return current;
    return [incoming, ...current];
  };

  /* ── Data fetch ───────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const [sessionRes, qrRes, attendanceRes] = await Promise.allSettled([
        api.get(`/sessions/${id}`),
        api.get(`/sessions/${id}/qr`),
        api.get(`/sessions/${id}/attendance`),
      ]);

      if (sessionRes.status === 'fulfilled') {
        const payload = sessionRes.value.data?.data ?? sessionRes.value.data ?? {};
        setSession(payload.session ?? null);
      }

      if (qrRes.status === 'fulfilled') {
        const payload = qrRes.value.data?.data ?? qrRes.value.data ?? {};
        setToken(payload.token ?? null);
      } else {
        setToken(null);
      }

      if (attendanceRes.status === 'fulfilled') {
        const payload = attendanceRes.value.data?.data ?? attendanceRes.value.data ?? {};
        const fetched = payload.records ?? [];
        // Replace wholesale — server is source of truth. Any socket-pushed
        // records will already be in this list because they hit the DB
        // before being broadcast.
        setRecords(fetched);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ── Initial fetch + adaptive polling ──────────────────── */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    // Polling cadence depends on socket health: fast when offline, slow
    // when online (safety net for reconciliation).
    const interval = socketLive ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_FAST_MS;
    const handle   = setInterval(fetchAll, interval);
    return () => clearInterval(handle);
  }, [fetchAll, socketLive]);

  /* ── Socket: connect, join room, subscribe ───────────────── */
  useEffect(() => {
    if (!id) return;

    const sock = socket.connect();
    if (!sock) return; // No token yet — caller will retry on next mount

    socket.joinSession(id);

    const onConnect    = () => setSocketLive(true);
    const onDisconnect = () => setSocketLive(false);

    // If socket is already connected when this effect runs, mark live.
    // Without this we'd miss the initial 'connect' event because it fired
    // before this useEffect attached the listener.
    if (sock.connected) setSocketLive(true);

    const offConnect    = socket.on('connect', onConnect);
    const offDisconnect = socket.on('disconnect', onDisconnect);

    // The main event we care about. Backend emits this from
    // attendanceController step 11 immediately after a successful scan.
    const offAttendance = socket.on('attendance:marked', (payload) => {
      // Build a record matching the shape returned by GET /sessions/:id/attendance
      // so the same ScanRow component can render it without branching.
      const record = {
        id:                payload.id ?? `${payload.sessionId}-${payload.studentId}`,
        studentId:         payload.studentId,
        studentName:       payload.studentName,
        studentEmail:      payload.studentEmail,
        studentId_display: payload.studentId_display,
        status:            payload.status,
        marked_at:         payload.marked_at,
      };

      setRecords(curr => {
        const next = upsertRecord(curr, record);
        // Only run the side effects below if we actually added a new row.
        if (next === curr) return curr;

        // Bump the relevant counter to trigger its bounce animation.
        if (record.status === 'present') presentBumpRef.current++;
        else if (record.status === 'late') lateBumpRef.current++;
        totalBumpRef.current++;

        // Highlight the new row for ~2s, then clear.
        setHighlightId(record.id);
        setTimeout(() => setHighlightId(prev => prev === record.id ? null : prev), 2000);

        return next;
      });
    });

    return () => {
      offConnect();
      offDisconnect();
      offAttendance();
      socket.leaveSession(id);
      // Note: we don't disconnect the socket itself — it's a singleton
      // shared with potential future screens. The next consumer's
      // socket.connect() call is a no-op if already connected.
    };
  }, [id]);

  /* ── Close session (PUT, not POST!) ───────────────────── */
  const handleClose = () => {
    Alert.alert(
      'Close session?',
      'Students will no longer be able to mark attendance for this session.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close session', style: 'destructive', onPress: confirmClose },
      ],
    );
  };

  const confirmClose = async () => {
    setClosing(true);
    try {
      await api.put(`/sessions/${id}/close`);
      router.replace('/lecturer');
    } catch (err) {
      Alert.alert(
        'Failed',
        err.response?.data?.message || 'Could not close session'
      );
      setClosing(false);
    }
  };

  /* ── Derived stats ────────────────────────────────────── */
  const present = records.filter(r => r.status === 'present').length;
  const late    = records.filter(r => r.status === 'late').length;
  const total   = records.length;

  const isOpen    = session?.status === 'open';
  const className = session?.class?.name ?? session?.class_name_snapshot ?? 'Loading…';
  const openAt    = session?.open_at;

  return (
    <Screen gap={t.spacing.md}>
      {/* ── Back ────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Button
          label="Back"
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
      </View>

      {/* ── Session header ──────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <View style={{
          flexDirection:  'row',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            t.spacing.sm,
        }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{
              fontFamily:    t.fontFamily.displayBold,
              fontSize:      t.fontSize.xl,
              color:         t.colors.textPrimary,
              letterSpacing: t.letterSpacing.tight,
            }}>
              {className}
            </Text>
            <Text style={{
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textMuted,
            }}>
              {session?.title || 'Attendance session'}
              {openAt ? ` · started ${format(new Date(openAt), 'HH:mm')}` : ''}
            </Text>
          </View>
          {isOpen && <StatusPill status="live" size="md" />}
        </View>
      </Animated.View>

      {/* ── QR card (only when session is open) ─────────── */}
      {isOpen && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <Card accent="brand" accentIntensity="subtle">
            <View style={{ alignItems: 'center', gap: t.spacing.md }}>
              <View style={{
                flexDirection: 'row',
                alignItems:    'center',
                gap:           t.spacing.xs,
              }}>
                {socketLive ? (
                  <Wifi size={12} color={t.colors.green} />
                ) : (
                  <RefreshCw size={12} color={t.colors.brandText} />
                )}
                <Text style={{
                  fontFamily:    t.fontFamily.mono,
                  fontSize:      10,
                  fontWeight:    '700',
                  color:         socketLive ? t.colors.green : t.colors.brandText,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {socketLive ? 'Live · real-time updates' : 'Polling · offline mode'}
                </Text>
              </View>

              {/*
                White background behind the QR — react-native-qrcode-svg
                draws on whatever's behind it, and dark theme + dark QR
                makes it unscannable. White always works.
              */}
              <View style={{
                padding:         t.spacing.md,
                backgroundColor: '#fff',
                borderRadius:    t.radius.molecular,
              }}>
                {token ? (
                  <QRCode
                    value={token}
                    size={qrSize}
                    backgroundColor="#fff"
                    color="#000"
                  />
                ) : (
                  <View style={{
                    width:          qrSize,
                    height:         qrSize,
                    alignItems:     'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: t.fontFamily.body, color: '#666' }}>
                      {loading ? 'Loading…' : 'No token'}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{
                fontFamily: t.fontFamily.body,
                fontSize:   t.fontSize.xs,
                color:      t.colors.textMuted,
                textAlign:  'center',
              }}>
                Show this to your students. The code refreshes
                automatically — screenshots won't work for long.
              </Text>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* ── Live stats ──────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(160).duration(DURATION.slow)}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <StatBlock
            t={t} label="Present" count={present} tone="green"
            icon={CheckCircle} bumpKey={presentBumpRef.current}
          />
          <StatBlock
            t={t} label="Late" count={late} tone="amber"
            icon={Radio} bumpKey={lateBumpRef.current}
          />
          <StatBlock
            t={t} label="Total" count={total} tone="brand"
            icon={Users} bumpKey={totalBumpRef.current}
          />
        </View>
      </Animated.View>

      {/* ── Recent scans list ───────────────────────────── */}
      {records.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(240).duration(DURATION.slow)}
          style={{ gap: t.spacing.sm }}
        >
          <Text style={{
            fontFamily:    t.fontFamily.mono,
            fontSize:      10,
            fontWeight:    '700',
            color:         t.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Recent scans · last {Math.min(records.length, 10)}
          </Text>

          {records.slice(0, 10).map((r) => (
            <ScanRow
              key={r.id}
              t={t}
              record={r}
              isHighlighted={r.id === highlightId}
            />
          ))}
        </Animated.View>
      )}

      {/* ── Close session button ────────────────────────── */}
      {isOpen && (
        <Animated.View entering={FadeInUp.delay(320).duration(DURATION.slow)}>
          <Button
            label="Close session"
            icon={StopCircle}
            variant="danger"
            size="lg"
            fullWidth
            loading={closing}
            onPress={handleClose}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

/* ─── Stat block (with bounce on change) ──────────────────── */
function StatBlock({ t, label, count, tone, icon, bumpKey }) {
  const valueColor =
    tone === 'green' ? t.colors.green :
    tone === 'amber' ? t.colors.amber :
    t.colors.brandText;

  // Scale animation that runs whenever bumpKey changes. We use a
  // short scale-up-then-back sequence to draw the eye without being
  // jarring. withSpring on the way back gives a natural settle.
  const scale = useSharedValue(1);
  useEffect(() => {
    if (bumpKey === 0) return; // skip initial render
    scale.value = withSequence(
      withTiming(1.18, { duration: 120 }),
      withSpring(1, { damping: 8, stiffness: 180 }),
    );
  }, [bumpKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ flex: 1 }}>
      <Card accent={tone} accentIntensity="subtle" elevation="sm">
        <IconTile icon={icon} tone={tone} size="sm" />
        <Animated.Text style={[{
          fontFamily: t.fontFamily.displayBold,
          fontSize:   t.fontSize.xl,
          color:      valueColor,
          marginTop:  t.spacing.xs + 2,
          lineHeight: t.fontSize.xl * 1.05,
        }, animatedStyle]}>
          {count}
        </Animated.Text>
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.xs,
          color:      t.colors.textMuted,
          marginTop:  2,
        }}>
          {label}
        </Text>
      </Card>
    </View>
  );
}

/* ─── Scan row (with highlight flash on new arrivals) ────── */
function ScanRow({ t, record, isHighlighted }) {
  // Background pulse: when the row is freshly added, briefly tint
  // the card with the brand subtle color, then fade back to default.
  const highlight = useSharedValue(0);
  useEffect(() => {
    if (isHighlighted) {
      highlight.value = withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1200, withTiming(0, { duration: 600 })),
      );
    }
  }, [isHighlighted]);

  const wrapperStyle = useAnimatedStyle(() => ({
    backgroundColor: highlight.value > 0
      ? t.colors.brandSubtle
      : 'transparent',
    borderRadius: t.radius.molecular,
    opacity: 1 - highlight.value * 0.0, // keep 1 always; bg drives the pulse
  }));

  return (
    <Animated.View
      entering={isHighlighted ? SlideInRight.duration(DURATION.medium) : FadeIn.duration(DURATION.medium)}
      style={wrapperStyle}
    >
      <Card padded>
        <View style={{
          flexDirection: 'row',
          alignItems:    'center',
          gap:           t.spacing.sm,
        }}>
          <View style={{
            width:           32,
            height:          32,
            borderRadius:    t.radius.atomic,
            backgroundColor: t.colors.brandSubtle,
            borderWidth:     1,
            borderColor:     t.colors.brandBorder,
            alignItems:      'center',
            justifyContent:  'center',
          }}>
            <Text style={{
              fontFamily: t.fontFamily.displayBold,
              fontSize:   t.fontSize.xs,
              color:      t.colors.brandText,
            }}>
              {record.studentName?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: t.fontFamily.bodySemibold,
                fontSize:   t.fontSize.sm,
                color:      t.colors.textPrimary,
              }}
            >
              {record.studentName ?? 'Unknown student'}
            </Text>
            {record.marked_at && (
              <Text style={{
                fontFamily: t.fontFamily.mono,
                fontSize:   t.fontSize.xs,
                color:      t.colors.textMuted,
              }}>
                {format(new Date(record.marked_at), 'HH:mm:ss')}
              </Text>
            )}
          </View>

          <StatusPill status={record.status} size="sm" />
        </View>
      </Card>
    </Animated.View>
  );
}