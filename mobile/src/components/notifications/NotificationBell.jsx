// mobile/src/components/notifications/NotificationBell.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView,
}                                                    from 'react-native';
import { SafeAreaView }                              from 'react-native-safe-area-context';
import Animated, {
  FadeIn, FadeOut, FadeInUp,
}                                                    from 'react-native-reanimated';
import {
  Bell, X, CheckCheck, Trash2,
  Radio, CheckCircle, Clock,
}                                                    from 'lucide-react-native';
import { formatDistanceToNow }                       from 'date-fns';

import api            from '../../../services/api';
import socketManager   from '../../../services/socket';
import { useTheme }   from '../../theme/ThemeProvider';
import IconTile       from '../ui/IconTile';

/**
 * ═════════════════════════════════════════════════════════════════
 * NotificationBell — mobile counterpart to the web NotificationPanel.
 *
 * Same contract, same backend endpoints (GET /notifications,
 * PUT /notifications/:id/read, PUT /notifications/read-all,
 * DELETE /notifications), same "open = mark all read" behaviour.
 * Presented as a bottom sheet rather than a dropdown, since that's
 * the native pattern for this kind of transient list on mobile.
 *
 * Updates instantly via socket, not polling. notificationService.js's
 * createNotification already emits 'notification:new' to the user's
 * personal room (user:${userId}) the moment any notification is
 * created server-side — this component just needs to listen. A
 * light 60s poll remains as a safety net for the rare case the
 * socket connection drops silently, but the socket event is what
 * actually drives real-time updates; the student shouldn't need to
 * pull-to-refresh to see "Attendance confirmed" appear.
 *
 * socketManager is a shared singleton (see services/socket.js) — this
 * component calls .connect() defensively on mount (a no-op if some
 * other screen, e.g. a live session view, already connected it) and
 * never disconnects on unmount, since other parts of the app may
 * still need the connection.
 * ═════════════════════════════════════════════════════════════════
 */

const TYPE_META = (t) => ({
  session_opened: {
    icon: Radio, color: t.colors.green, bg: t.colors.greenBg, border: t.colors.greenBorder,
  },
  attendance_confirmed: {
    icon: CheckCircle, color: t.colors.brandText, bg: t.colors.brandSubtle, border: t.colors.brandBorder,
  },
  session_closing_soon: {
    icon: Clock, color: t.colors.amber, bg: t.colors.amberBg, border: t.colors.amberBorder,
  },
  default: {
    icon: Bell, color: t.colors.textSecondary, bg: t.colors.bgRaised, border: t.colors.border,
  },
});

// Safety-net poll interval. The socket event is what actually drives
// real-time updates — this only covers the rare case of a silently
// dropped connection that hasn't reconnected yet.
const SAFETY_POLL_MS = 60_000;

// Removes duplicate notifications by id, keeping the first occurrence.
// Small, local, and used both on fetch and on socket delivery — see the
// comments at each call site for why duplicates can occur at all.
function dedupeById(list) {
  const seen = new Set();
  return list.filter(n => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

export default function NotificationBell() {
  const t = useTheme();
  const meta = TYPE_META(t);

  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      // De-duped defensively even on a fresh fetch — belt and braces
      // alongside the socket-handler de-dupe below, in case the API
      // itself ever returns an overlapping page.
      setNotifications(dedupeById(data?.notifications ?? []));
      setUnreadCount(data?.unreadCount ?? 0);
    } catch (err) {
      console.warn('[NotificationBell] fetch failed:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Ensure the shared socket is connected. Safe to call even if
    // another screen already connected it — connect() no-ops when
    // socket.connected is already true.
    socketManager.connect();

    // New notification arrived — prepend it and bump the unread count
    // immediately, rather than waiting for a full refetch. This is
    // what makes "Attendance confirmed" appear the instant a scan
    // succeeds, without leaving the Scan screen.
    const unsubscribe = socketManager.on('notification:new', (incoming) => {
      setNotifications(prev => {
        // Guard against redelivery — e.g. the brief reconnect seen after
        // a "transport error" can cause the same event to arrive twice.
        // Without this check, the duplicate id crashed React's list
        // reconciliation (LogBox: "two children with the same key").
        if (prev.some(n => n.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
      setUnreadCount(prev => prev + 1);
    });

    // Safety-net poll — covers a dropped/reconnecting socket.
    const pollId = setInterval(fetchNotifications, SAFETY_POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(pollId);
    };
  }, [fetchNotifications]);

  // ── Open the sheet, and mark everything read (mirrors web) ──────
  const handleOpen = () => {
    setOpen(true);
    if (unreadCount > 0) {
      api.put('/notifications/read-all')
        .then(fetchNotifications)
        .catch(err => console.warn('[NotificationBell] mark-all failed:', err.message));
    }
  };

  const handleMarkOne = (id) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.read) return;
    api.put(`/notifications/${id}/read`)
      .then(fetchNotifications)
      .catch(err => console.warn('[NotificationBell] mark-one failed:', err.message));
  };

  const handleClearAll = () => {
    api.delete('/notifications')
      .then(fetchNotifications)
      .catch(err => console.warn('[NotificationBell] clear failed:', err.message));
  };

  return (
    <>
      {/* ── Bell button ─────────────────────────────────── */}
      <Pressable
        onPress={handleOpen}
        hitSlop={8}
        style={{
          width:           40,
          height:          40,
          borderRadius:    t.radius.atomic,
          backgroundColor: t.colors.bgRaised,
          borderWidth:     1,
          borderColor:     t.colors.border,
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        <Bell size={18} color={t.colors.textSecondary} strokeWidth={2.2} />

        {unreadCount > 0 && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{
              position:        'absolute',
              top:             -4,
              right:           -4,
              minWidth:        18,
              height:          18,
              paddingHorizontal: 4,
              borderRadius:    t.radius.pill,
              backgroundColor: t.colors.red,
              alignItems:      'center',
              justifyContent:  'center',
              borderWidth:     2,
              borderColor:     t.colors.bg,
            }}
          >
            <Text style={{
              fontSize:   10,
              fontWeight: '700',
              color:      '#fff',
              fontFamily: t.fontFamily.body,
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </Animated.View>
        )}
      </Pressable>

      {/* ── Bottom sheet ────────────────────────────────── */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex:            1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent:  'flex-end',
          }}
        >
          <Pressable onPress={() => {}}>
            <SafeAreaView
              edges={['bottom']}
              style={{
                backgroundColor:      t.colors.bgCard,
                borderTopLeftRadius:  24,
                borderTopRightRadius: 24,
                maxHeight:            '75%',
              }}
            >
              {/* Header */}
              <View style={{
                flexDirection:   'row',
                alignItems:      'center',
                justifyContent:  'space-between',
                paddingHorizontal: t.spacing.md,
                paddingTop:        t.spacing.sm,
                paddingBottom:     t.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: t.colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} color={t.colors.textMuted} />
                  <Text style={{
                    fontFamily: t.fontFamily.displayBold,
                    fontSize:   t.fontSize.md,
                    color:      t.colors.textPrimary,
                  }}>
                    Notifications
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {notifications.length > 0 && (
                    <>
                      <HeaderIconButton t={t} icon={CheckCheck} onPress={() => api.put('/notifications/read-all').then(fetchNotifications)} />
                      <HeaderIconButton t={t} icon={Trash2} onPress={handleClearAll} />
                    </>
                  )}
                  <HeaderIconButton t={t} icon={X} onPress={() => setOpen(false)} />
                </View>
              </View>

              {/* List */}
              {notifications.length === 0 ? (
                <View style={{
                  paddingVertical:   t.spacing.xl ?? 40,
                  paddingHorizontal: t.spacing.md,
                  alignItems:        'center',
                  gap:               t.spacing.sm,
                }}>
                  <IconTile icon={Bell} tone="neutral" size="lg" />
                  <Text style={{
                    fontFamily: t.fontFamily.displayBold,
                    fontSize:   t.fontSize.sm,
                    color:      t.colors.textPrimary,
                  }}>
                    You're all caught up
                  </Text>
                  <Text style={{
                    fontFamily: t.fontFamily.body,
                    fontSize:   t.fontSize.xs,
                    color:      t.colors.textMuted,
                    textAlign:  'center',
                    maxWidth:   260,
                    lineHeight: 18,
                  }}>
                    You'll be notified when sessions open, or when your attendance is confirmed.
                  </Text>
                </View>
              ) : (
                // Plain ScrollView + map rather than FlatList: FlatList
                // nested inside this Modal's stacked Pressables threw a
                // native rendering error in practice (a known problematic
                // combination — FlatList wants to own touch/scroll handling
                // in a way that conflicts with nested Pressable responders).
                // The notification list is always small, so virtualization
                // isn't needed — a plain map avoids the conflict entirely.
                <ScrollView contentContainerStyle={{ paddingBottom: t.spacing.lg }}>
                  {notifications.map((item, index) => (
                    <NotificationRow
                      key={String(item.id)}
                      t={t}
                      meta={meta}
                      notification={item}
                      isLast={index === notifications.length - 1}
                      onPress={() => handleMarkOne(item.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Header icon button ────────────────────────────────────────
function HeaderIconButton({ t, icon: Icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        padding:      6,
        borderRadius: t.radius.atomic,
      }}
    >
      <Icon size={16} color={t.colors.textMuted} strokeWidth={2.2} />
    </Pressable>
  );
}

// ─── Single notification row ────────────────────────────────────
function NotificationRow({ t, meta, notification: n, isLast, onPress }) {
  const cfg  = meta[n.type] ?? meta.default;
  const Icon = cfg.icon;

  return (
    <Animated.View entering={FadeInUp.duration(200)}>
      <Pressable
        onPress={onPress}
        style={{
          flexDirection:      'row',
          gap:                t.spacing.sm,
          paddingHorizontal:  t.spacing.md,
          paddingVertical:    t.spacing.sm,
          borderBottomWidth:  isLast ? 0 : 1,
          borderBottomColor:  t.colors.border,
          backgroundColor:    !n.read ? t.colors.brandSubtle : 'transparent',
        }}
      >
        <View style={{
          width:          36,
          height:         36,
          borderRadius:   t.radius.atomic,
          backgroundColor: cfg.bg,
          borderWidth:    1,
          borderColor:    cfg.border,
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}>
          <Icon size={16} color={cfg.color} strokeWidth={2.2} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{
            flexDirection:  'row',
            alignItems:     'flex-start',
            justifyContent: 'space-between',
            gap:            8,
          }}>
            <Text
              numberOfLines={2}
              style={{
                flex:       1,
                fontFamily: !n.read ? t.fontFamily.displayBold : t.fontFamily.bodySemibold,
                fontSize:   t.fontSize.sm,
                color:      t.colors.textPrimary,
                lineHeight: 18,
              }}
            >
              {n.title}
            </Text>
            {!n.read && (
              <View style={{
                width: 8, height: 8, borderRadius: t.radius.pill,
                backgroundColor: t.colors.brand, marginTop: 4, flexShrink: 0,
              }} />
            )}
          </View>

          <Text
            numberOfLines={2}
            style={{
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.xs,
              color:      t.colors.textSecondary,
              lineHeight: 16,
            }}
          >
            {n.message}
          </Text>

          <Text style={{
            fontFamily: t.fontFamily.mono,
            fontSize:   10,
            color:      t.colors.textMuted,
            marginTop:  2,
          }}>
            {n.createdAt
              ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
              : '—'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}