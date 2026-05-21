// mobile/app/student/history.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  Modal, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isYesterday } from 'date-fns';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import {
  Clock, Filter, Calendar, MessageSquare,
  CheckCircle2, AlertTriangle, XCircle, X,
  ChevronDown, Send,
} from 'lucide-react-native';
import {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';

import api            from '../../services/api';
import { useTheme }   from '../../src/theme/ThemeProvider';
import Card           from '../../src/components/ui/Card';
import IconTile       from '../../src/components/ui/IconTile';
import StatusPill     from '../../src/components/ui/StatusPill';
import Button         from '../../src/components/ui/Button';
import { DURATION, SPRING, TAP } from '../../src/lib/motion';

const FILTERS = [
  { key: 'all',     label: 'All'     },
  { key: 'present', label: 'Present' },
  { key: 'late',    label: 'Late'    },
  { key: 'absent',  label: 'Absent'  },
];

// Maps appeal status → display config
const APPEAL_CONFIG = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  approved: { label: 'Approved', color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

export default function HistoryScreen() {
  const t = useTheme();

  const [records,    setRecords]    = useState([]);
  const [appeals,    setAppeals]    = useState([]); // student's existing appeals
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  // Appeal modal state
  const [appealTarget, setAppealTarget] = useState(null); // the record being appealed

  // ── Fetch both history and existing appeals in parallel ──────
  const fetchData = useCallback(async () => {
    try {
      const [histRes, appealRes] = await Promise.allSettled([
        api.get('/reports/student-history'),
        api.get('/appeals/my'),
      ]);

      if (histRes.status === 'fulfilled') {
        const d = histRes.value.data;
        setRecords(d?.records ?? d?.data?.records ?? []);
      }
      if (appealRes.status === 'fulfilled') {
        const d = appealRes.value.data;
        setAppeals(d?.appeals ?? d?.data?.appeals ?? []);
      }
    } catch (err) {
      console.error('[History] fetchData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Build a quick lookup: attendanceId → appeal
  const appealByAttendanceId = useMemo(() => {
    const map = new Map();
    for (const a of appeals) {
      const key = a.attendanceId ?? a.attendance_id ?? a.id;
      if (key) map.set(String(key), a);
    }
    return map;
  }, [appeals]);

  // ── Filter + group into flat FlatList items ──────────────────
  const items = useMemo(() => {
    const filtered = filter === 'all'
      ? records
      : records.filter(r => r.status === filter);

    if (filtered.length === 0) return [];

    const groups = new Map();
    for (const r of filtered) {
      const dateKey = r.marked_at
        ? format(new Date(r.marked_at), 'yyyy-MM-dd')
        : 'undated';
      if (!groups.has(dateKey)) groups.set(dateKey, { date: r.marked_at ? new Date(r.marked_at) : null, records: [] });
      groups.get(dateKey).records.push(r);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
    const flat = [];
    for (const key of sortedKeys) {
      const { date, records: recs } = groups.get(key);
      flat.push({ type: 'header', key: `h-${key}`, date, count: recs.length });
      const byTime = [...recs].sort((a, b) =>
        new Date(b.marked_at || 0) - new Date(a.marked_at || 0)
      );
      for (const r of byTime) {
        flat.push({
          type:   'record',
          key:    `r-${r.id}`,
          record: r,
          appeal: appealByAttendanceId.get(String(r.id)),
        });
      }
    }
    return flat;
  }, [records, filter, appealByAttendanceId]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    for (const r of records) if (c[r.status] !== undefined) c[r.status] += 1;
    return c;
  }, [records]);

  // After a successful appeal submission, add the new appeal to state
  // without refetching — instant optimistic update.
  const onAppealSubmitted = (attendanceId, appeal) => {
    setAppeals(prev => [...prev, { ...appeal, attendanceId }]);
    setAppealTarget(null);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.colors.bg }}>

      {/* Header */}
      <Animated.View
        entering={FadeInUp.duration(DURATION.slow)}
        style={{ paddingHorizontal: t.spacing.md, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm, gap: t.spacing.sm }}
      >
        <View>
          <Text style={{ fontFamily: t.fontFamily.displayBold, fontSize: t.fontSize.xxl, color: t.colors.textPrimary, letterSpacing: t.letterSpacing.tight, lineHeight: t.fontSize.xxl * 1.1 }}>
            History
          </Text>
          <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.sm, color: t.colors.textMuted, marginTop: 4 }}>
            {loading
              ? 'Loading…'
              : records.length === 0
                ? 'No records yet'
                : `${records.length} total · ${counts.present} present · ${counts.late} late · ${counts.absent} absent`}
          </Text>
        </View>

        {/* Filter pills */}
        {records.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <FilterPill key={f.key} t={t} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </View>
        )}
      </Animated.View>

      {/* List */}
      {loading ? (
        <LoadingSkeleton t={t} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingHorizontal: t.spacing.md, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.colors.brand}
              colors={[t.colors.brand]}
              progressBackgroundColor={t.colors.bgCard}
            />
          }
          ListEmptyComponent={<EmptyState t={t} filter={filter} />}
          renderItem={({ item, index }) =>
            item.type === 'header'
              ? <DateHeader t={t} date={item.date} count={item.count} />
              : (
                <RecordRow
                  t={t}
                  record={item.record}
                  appeal={item.appeal}
                  index={index}
                  onAppeal={() => setAppealTarget(item.record)}
                />
              )
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Appeal modal */}
      {appealTarget && (
        <AppealModal
          t={t}
          record={appealTarget}
          onClose={() => setAppealTarget(null)}
          onSuccess={onAppealSubmitted}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Filter pill ───────────────────────────────────────────────
function FilterPill({ t, label, active, onPress }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={()  => { scale.value = withSpring(TAP.button, SPRING.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING.snappy); }}
        onPress={onPress}
        style={{
          paddingHorizontal: 12, paddingVertical: 6,
          borderRadius: t.radius.pill,
          backgroundColor: active ? t.colors.brand : t.colors.bgRaised,
          borderWidth: 1,
          borderColor: active ? t.colors.brand : t.colors.border,
        }}
      >
        <Text style={{ fontFamily: active ? t.fontFamily.bodySemibold : t.fontFamily.body, fontSize: t.fontSize.xs, color: active ? '#fff' : t.colors.textSecondary }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Date header ───────────────────────────────────────────────
function DateHeader({ t, date, count }) {
  const label = !date ? 'Unknown date'
    : isToday(date)     ? 'Today'
    : isYesterday(date) ? 'Yesterday'
    : format(date, 'EEE, d MMM');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.md, paddingBottom: t.spacing.xs + 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.pill, backgroundColor: t.colors.brandSubtle, borderWidth: 1, borderColor: t.colors.brandBorder }}>
        <Calendar size={11} color={t.colors.brandText} strokeWidth={2.4} />
        <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: 11, color: t.colors.brandText, letterSpacing: 0.2 }}>{label}</Text>
      </View>
      <Text style={{ fontFamily: t.fontFamily.mono, fontSize: 10, color: t.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>
        {count} record{count === 1 ? '' : 's'}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
    </View>
  );
}

// ─── Record row ────────────────────────────────────────────────
function RecordRow({ t, record: r, appeal, index, onAppeal }) {
  const railColor = r.status === 'present' ? t.colors.green
                  : r.status === 'late'    ? t.colors.amber
                  : r.status === 'absent'  ? t.colors.red
                  :                          t.colors.textMuted;

  const time = r.marked_at ? format(new Date(r.marked_at), 'HH:mm') : '—';
  const canAppeal = r.status === 'absent' && !appeal;
  const appealCfg = appeal ? APPEAL_CONFIG[appeal.status] : null;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 30, 240)).duration(DURATION.medium)}
      layout={Layout.springify()}
    >
      <Card elevation="sm" padded={false}>
        <View style={{ flexDirection: 'row', overflow: 'hidden' }}>
          {/* Left rail */}
          <View style={{ width: 4, backgroundColor: railColor }} />

          {/* Body */}
          <View style={{ flex: 1, padding: t.spacing.md, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: t.fontSize.sm, color: t.colors.textPrimary }}>
                  {r.className || 'Unknown class'}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.xs, color: t.colors.textMuted }}>
                  {r.sessionTitle || 'Attendance session'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Clock size={10} color={t.colors.textMuted} strokeWidth={2.4} />
                  <Text style={{ fontFamily: t.fontFamily.mono, fontSize: 10, color: t.colors.textMuted, fontWeight: '600' }}>{time}</Text>
                </View>
              </View>
              <StatusPill status={r.status} />
            </View>

            {/* Appeal status badge — shown when appeal exists */}
            {appealCfg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: t.radius.atomic, backgroundColor: appealCfg.bg, alignSelf: 'flex-start' }}>
                <MessageSquare size={11} color={appealCfg.color} strokeWidth={2.4} />
                <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: 11, color: appealCfg.color }}>
                  Appeal {appealCfg.label}
                </Text>
                {appeal.lecturerNote && (
                  <Text style={{ fontFamily: t.fontFamily.body, fontSize: 10, color: appealCfg.color, opacity: 0.8 }} numberOfLines={1}>
                    · {appeal.lecturerNote}
                  </Text>
                )}
              </View>
            )}

            {/* Appeal button — shown on absent records with no appeal */}
            {canAppeal && (
              <TouchableOpacity
                onPress={onAppeal}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: t.radius.atomic,
                  backgroundColor: 'rgba(245,158,11,0.10)',
                  borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
                  alignSelf: 'flex-start',
                }}
              >
                <MessageSquare size={13} color={t.colors.amber} strokeWidth={2.4} />
                <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: 12, color: t.colors.amber }}>
                  Submit appeal
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

// ─── Appeal modal ──────────────────────────────────────────────
function AppealModal({ t, record, onClose, onSuccess }) {
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const MIN_CHARS = 20;
  const valid = reason.trim().length >= MIN_CHARS;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/appeals', {
        attendanceId: record.id,
        sessionId:    record.sessionId ?? record.session_id,
        reason:       reason.trim(),
      });
      const d = res.data;
      const appeal = d?.appeal ?? d?.data?.appeal ?? { status: 'pending', reason: reason.trim() };
      onSuccess(record.id, appeal);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Backdrop */}
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={onClose}
        >
          {/* Sheet — stops backdrop press propagating into sheet */}
          <Pressable onPress={() => {}} style={{
            backgroundColor: t.colors.bgCard,
            borderTopLeftRadius:  24,
            borderTopRightRadius: 24,
            paddingHorizontal: t.spacing.md,
            paddingTop:        t.spacing.md,
            paddingBottom:     t.spacing.xl ?? 32,
            gap:               t.spacing.md,
          }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.border, alignSelf: 'center', marginBottom: 4 }} />

            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: t.fontFamily.displayBold, fontSize: t.fontSize.lg, color: t.colors.textPrimary }}>
                  Submit appeal
                </Text>
                <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.xs, color: t.colors.textMuted }} numberOfLines={1}>
                  {record.className} · {record.sessionTitle || 'Attendance session'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <X size={20} color={t.colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Info callout */}
            <View style={{ flexDirection: 'row', gap: 10, padding: t.spacing.sm, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: t.radius.atomic, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
              <AlertTriangle size={14} color={t.colors.amber} strokeWidth={2.2} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: t.fontFamily.body, fontSize: t.fontSize.xs, color: t.colors.textSecondary, lineHeight: 18 }}>
                Your lecturer will review this appeal and update your attendance status if approved. You will be notified of the outcome.
              </Text>
            </View>

            {/* Reason input */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: t.fontSize.sm, color: t.colors.textPrimary }}>
                Reason for appeal <Text style={{ color: t.colors.red }}>*</Text>
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={`Explain why your attendance status should be changed.\n\nInclude relevant details:\n· Technical issues (phone died, camera not working)\n· You were present but couldn't scan\n· Any other valid reason`}
                placeholderTextColor={t.colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={{
                  fontFamily:      t.fontFamily.body,
                  fontSize:        t.fontSize.sm,
                  color:           t.colors.textPrimary,
                  backgroundColor: t.colors.bgRaised,
                  borderWidth:     1,
                  borderColor:     reason.length > 0 && !valid ? t.colors.red : t.colors.border,
                  borderRadius:    t.radius.atomic,
                  padding:         t.spacing.sm,
                  minHeight:       130,
                  lineHeight:      20,
                }}
              />
              <Text style={{ fontFamily: t.fontFamily.mono, fontSize: 10, color: valid ? t.colors.green : t.colors.textMuted }}>
                {reason.trim().length}/{MIN_CHARS} characters minimum
                {valid ? ' ✓' : ''}
              </Text>
            </View>

            {/* Error */}
            {error ? (
              <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.xs, color: t.colors.red }}>
                {error}
              </Text>
            ) : null}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 13, borderRadius: t.radius.atomic, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: t.fontSize.sm, color: t.colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!valid || submitting}
                style={{
                  flex: 2, paddingVertical: 13, borderRadius: t.radius.atomic,
                  backgroundColor: valid && !submitting ? t.colors.brand : t.colors.bgRaised,
                  alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  opacity: valid && !submitting ? 1 : 0.5,
                }}
              >
                <Send size={15} color={valid && !submitting ? '#fff' : t.colors.textMuted} strokeWidth={2.2} />
                <Text style={{ fontFamily: t.fontFamily.bodySemibold, fontSize: t.fontSize.sm, color: valid && !submitting ? '#fff' : t.colors.textMuted }}>
                  {submitting ? 'Submitting…' : 'Submit appeal'}
                </Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyState({ t, filter }) {
  const isFiltered  = filter !== 'all';
  const filterLabel = { present: 'present', late: 'late', absent: 'absent' }[filter] ?? '';
  return (
    <View style={{ alignItems: 'center', paddingVertical: 64, gap: t.spacing.md }}>
      <IconTile icon={isFiltered ? Filter : Clock} tone="neutral" size="xl" />
      <View style={{ alignItems: 'center', gap: 6, maxWidth: 280 }}>
        <Text style={{ fontFamily: t.fontFamily.displayBold, fontSize: t.fontSize.lg, color: t.colors.textPrimary, letterSpacing: t.letterSpacing.tight }}>
          {isFiltered ? 'No matches' : 'No records yet'}
        </Text>
        <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.sm, color: t.colors.textMuted, textAlign: 'center', lineHeight: t.fontSize.sm * 1.5 }}>
          {isFiltered
            ? `You have no ${filterLabel} records yet. Try a different filter.`
            : 'Mark your attendance in a class session to start building your history.'}
        </Text>
      </View>
    </View>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────
function LoadingSkeleton({ t }) {
  return (
    <View style={{ paddingHorizontal: t.spacing.md, gap: t.spacing.sm }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ height: 76, borderRadius: t.radius.molecular, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, opacity: 0.6 - i * 0.12 }} />
      ))}
    </View>
  );
}