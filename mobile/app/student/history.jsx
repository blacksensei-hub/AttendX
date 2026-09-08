import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import Animated, {
  FadeInUp, Layout,
} from 'react-native-reanimated';
import {
  Clock, CheckCircle2, AlertCircle, XCircle,
  Filter, Calendar,
} from 'lucide-react-native';

import api from '../../services/api';

import { useTheme }    from '../../src/theme/ThemeProvider';
import Card            from '../../src/components/ui/Card';
import IconTile        from '../../src/components/ui/IconTile';
import StatusPill      from '../../src/components/ui/StatusPill';
import Button          from '../../src/components/ui/Button';
import { DURATION, SPRING, TAP } from '../../src/lib/motion';

import {
  Pressable,
} from 'react-native';
import {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';

/**
 * ═════════════════════════════════════════════════════════════════
 * HistoryScreen — student's attendance timeline.
 *
 * Three layers of organization:
 *   1. Filter pills (All / Present / Late / Absent) at top
 *   2. Date sections (Today / Yesterday / earlier dates)
 *   3. Individual records within each section
 *
 * Uses FlatList with section data instead of SectionList because
 * section headers + items render with consistent spacing better
 * via flat data + a discriminator field. Renders 60fps even with
 * 500+ records since FlatList virtualizes.
 *
 * Preserved from original: full data fetching, pull-to-refresh,
 * loading state, status colour mapping.
 * ═════════════════════════════════════════════════════════════════
 */

const FILTERS = [
  { key: 'all',     label: 'All'     },
  { key: 'present', label: 'Present' },
  { key: 'late',    label: 'Late'    },
  { key: 'absent',  label: 'Absent'  },
];

export default function HistoryScreen() {
  const t = useTheme();

  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/student-history');
      setRecords(data.records ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  // ── Filter records by status, then build flat list of
  // ── { type: 'header'|'record', ... } items for FlatList
  const items = useMemo(() => {
    const filtered = filter === 'all'
      ? records
      : records.filter(r => r.status === filter);

    if (filtered.length === 0) return [];

    // Group by date (day-level resolution)
    const groups = new Map();
    for (const r of filtered) {
      if (!r.marked_at) continue;
      const date = new Date(r.marked_at);
      const dayKey = format(date, 'yyyy-MM-dd');
      if (!groups.has(dayKey)) {
        groups.set(dayKey, { date, records: [] });
      }
      groups.get(dayKey).records.push(r);
    }

    // Sort groups newest-first, flatten into rows
    const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
    const flat = [];
    for (const key of sortedKeys) {
      const { date, records: recs } = groups.get(key);
      flat.push({
        type: 'header',
        key:  `h-${key}`,
        date,
        count: recs.length,
      });
      // Sort records within day by time, newest first
      const byTime = [...recs].sort((a, b) =>
        new Date(b.marked_at) - new Date(a.marked_at)
      );
      for (const r of byTime) {
        flat.push({ type: 'record', key: `r-${r.id}`, record: r });
      }
    }
    return flat;
  }, [records, filter]);

  // ── Stats for the header subtitle ──
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    for (const r of records) {
      if (c[r.status] !== undefined) c[r.status] += 1;
    }
    return c;
  }, [records]);

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: t.colors.bg }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.duration(DURATION.slow)}
        style={{
          paddingHorizontal: t.spacing.md,
          paddingTop:        t.spacing.md,
          paddingBottom:     t.spacing.sm,
          gap:               t.spacing.sm,
        }}
      >
        <View>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
            lineHeight:    t.fontSize.xxl * 1.1,
          }}>
            History
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
            marginTop:  4,
          }}>
            {loading
              ? 'Loading…'
              : records.length === 0
                ? 'No records yet'
                : `${records.length} total · ${counts.present} present · ${counts.late} late · ${counts.absent} absent`}
          </Text>
        </View>

        {/* Filter pills */}
        {records.length > 0 && (
          <View style={{
            flexDirection: 'row',
            gap:           6,
            flexWrap:      'wrap',
          }}>
            {FILTERS.map(f => (
              <FilterPill
                key={f.key}
                t={t}
                label={f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {/* ── List ─────────────────────────────────────── */}
      {loading ? (
        <LoadingSkeleton t={t} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.key}
          contentContainerStyle={{
            paddingHorizontal: t.spacing.md,
            paddingBottom:     40,
          }}
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
          ListEmptyComponent={
            <EmptyState t={t} filter={filter} />
          }
          renderItem={({ item, index }) =>
            item.type === 'header'
              ? <DateHeader t={t} date={item.date} count={item.count} />
              : <RecordRow t={t} record={item.record} index={index} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Filter pill ───────────────────────────────────────────────
function FilterPill({ t, label, active, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={()  => { scale.value = withSpring(TAP.button, SPRING.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING.snappy); }}
        onPress={onPress}
        style={{
          paddingHorizontal: 12,
          paddingVertical:   6,
          borderRadius:      t.radius.pill,
          backgroundColor:   active ? t.colors.brand           : t.colors.bgRaised,
          borderWidth:       1,
          borderColor:       active ? t.colors.brand           : t.colors.border,
        }}
      >
        <Text style={{
          fontFamily: active ? t.fontFamily.bodySemibold : t.fontFamily.body,
          fontSize:   t.fontSize.xs,
          color:      active ? '#fff'                    : t.colors.textSecondary,
        }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Date header (e.g. "Today", "Yesterday", "Mon 12 Apr") ────
function DateHeader({ t, date, count }) {
  const label = isToday(date)
    ? 'Today'
    : isYesterday(date)
      ? 'Yesterday'
      : format(date, 'EEE, d MMM');

  return (
    <View style={{
      flexDirection:  'row',
      alignItems:     'center',
      gap:            t.spacing.sm,
      paddingTop:     t.spacing.md,
      paddingBottom:  t.spacing.xs + 2,
    }}>
      <View style={{
        flexDirection:   'row',
        alignItems:      'center',
        gap:             6,
        paddingHorizontal: 10,
        paddingVertical:   4,
        borderRadius:    t.radius.pill,
        backgroundColor: t.colors.brandSubtle,
        borderWidth:     1,
        borderColor:     t.colors.brandBorder,
      }}>
        <Calendar size={11} color={t.colors.brandText} strokeWidth={2.4} />
        <Text style={{
          fontFamily:    t.fontFamily.bodySemibold,
          fontSize:      11,
          color:         t.colors.brandText,
          letterSpacing: 0.2,
        }}>
          {label}
        </Text>
      </View>

      <Text style={{
        fontFamily:    t.fontFamily.mono,
        fontSize:      10,
        color:         t.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight:    '700',
      }}>
        {count} record{count === 1 ? '' : 's'}
      </Text>

      <View style={{
        flex:            1,
        height:          1,
        backgroundColor: t.colors.border,
      }} />
    </View>
  );
}

// ─── Record row ────────────────────────────────────────────────
function RecordRow({ t, record: r, index }) {
  // Pick accent colour for the left rail based on status
  const tone = r.status === 'present' ? 'green'
             : r.status === 'late'    ? 'amber'
             : r.status === 'absent'  ? 'red'
             :                          'neutral';

  const railColor = tone === 'green'  ? t.colors.green
                  : tone === 'amber'  ? t.colors.amber
                  : tone === 'red'    ? t.colors.red
                  :                     t.colors.textMuted;

  const time = r.marked_at
    ? format(new Date(r.marked_at), 'HH:mm')
    : '—';

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index * 30, 240)).duration(DURATION.medium)}
      layout={Layout.springify()}
    >
      <Card elevation="sm" padded={false}>
        <View style={{
          flexDirection: 'row',
          overflow:      'hidden',
        }}>
          {/* Left status rail */}
          <View style={{
            width:           4,
            backgroundColor: railColor,
          }} />

          {/* Body */}
          <View style={{
            flex:            1,
            flexDirection:   'row',
            alignItems:      'center',
            gap:             t.spacing.sm,
            padding:         t.spacing.md,
          }}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: t.fontFamily.bodySemibold,
                  fontSize:   t.fontSize.sm,
                  color:      t.colors.textPrimary,
                }}
              >
                {r.className || 'Unknown class'}
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  fontFamily: t.fontFamily.body,
                  fontSize:   t.fontSize.xs,
                  color:      t.colors.textMuted,
                }}
              >
                {r.sessionTitle || 'Attendance session'}
              </Text>

              <View style={{
                flexDirection: 'row',
                alignItems:    'center',
                gap:           4,
                marginTop:     2,
              }}>
                <Clock size={10} color={t.colors.textMuted} strokeWidth={2.4} />
                <Text style={{
                  fontFamily: t.fontFamily.mono,
                  fontSize:   10,
                  color:      t.colors.textMuted,
                  fontWeight: '600',
                }}>
                  {time}
                </Text>
              </View>
            </View>

            <StatusPill status={r.status} />
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyState({ t, filter }) {
  // Different copy depending on filter context
  const isFiltered = filter !== 'all';
  const filterLabel = filter === 'present' ? 'present'
                    : filter === 'late'    ? 'late'
                    : filter === 'absent'  ? 'absent'
                    :                        '';

  return (
    <View style={{
      alignItems:     'center',
      paddingVertical: 64,
      gap:            t.spacing.md,
    }}>
      <IconTile
        icon={isFiltered ? Filter : Clock}
        tone="neutral"
        size="xl"
      />

      <View style={{ alignItems: 'center', gap: 6, maxWidth: 280 }}>
        <Text style={{
          fontFamily:    t.fontFamily.displayBold,
          fontSize:      t.fontSize.lg,
          color:         t.colors.textPrimary,
          letterSpacing: t.letterSpacing.tight,
        }}>
          {isFiltered ? 'No matches' : 'No records yet'}
        </Text>
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.sm,
          color:      t.colors.textMuted,
          textAlign:  'center',
          lineHeight: t.fontSize.sm * 1.5,
        }}>
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
    <View style={{
      paddingHorizontal: t.spacing.md,
      gap: t.spacing.sm,
    }}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={{
            height:          76,
            borderRadius:    t.radius.molecular,
            backgroundColor: t.colors.bgRaised,
            borderWidth:     1,
            borderColor:     t.colors.border,
            opacity:         0.6 - i * 0.12,
          }}
        />
      ))}
    </View>
  );
}