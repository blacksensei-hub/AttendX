import { View, Text } from 'react-native';

import { useTheme }   from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * StatusPill — status badge.
 *
 * Same contract as web <StatusPill>. Used for attendance statuses,
 * session states, appeal states, etc.
 *
 * Known statuses with automatic label + colour:
 *   present / late / absent
 *   live / scheduled / closed
 *   approved / pending / rejected
 *
 * Unknown statuses fall back to a neutral pill with the status
 * text capitalised.
 *
 * Props:
 *   status  — canonical key (required)
 *   label   — override the auto-generated label
 *   size    — 'sm' (default) | 'md'
 * ═════════════════════════════════════════════════════════════════
 */
export default function StatusPill({ status, label, size = 'sm' }) {
  const t = useTheme();
  const cfg = resolveStatus(t, status);

  const padY = size === 'md' ? 4 : 2;
  const padX = size === 'md' ? 10 : 8;
  const fontSize = size === 'md' ? 12 : 10;

  return (
    <View style={{
      flexDirection:     'row',
      alignItems:        'center',
      gap:               4,
      alignSelf:         'flex-start',
      paddingVertical:   padY,
      paddingHorizontal: padX,
      backgroundColor:   cfg.bg,
      borderWidth:       1,
      borderColor:       cfg.border,
      borderRadius:      t.radius.pill,
    }}>
      {cfg.dot && (
        <View style={{
          width:        6,
          height:       6,
          borderRadius: t.radius.pill,
          backgroundColor: cfg.color,
        }} />
      )}
      <Text style={{
        color:         cfg.color,
        fontSize,
        fontWeight:    '700',
        fontFamily:    t.fontFamily.mono,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}>
        {(label ?? cfg.label).toUpperCase()}
      </Text>
    </View>
  );
}

function resolveStatus(t, status) {
  const map = {
    present:   { label: 'Present',   color: t.colors.green,  bg: t.colors.greenBg,  border: t.colors.greenBorder,  dot: false },
    late:      { label: 'Late',      color: t.colors.amber,  bg: t.colors.amberBg,  border: t.colors.amberBorder,  dot: false },
    absent:    { label: 'Absent',    color: t.colors.red,    bg: t.colors.redBg,    border: t.colors.redBorder,    dot: false },

    live:      { label: 'Live',      color: t.colors.green,  bg: t.colors.greenBg,  border: t.colors.greenBorder,  dot: true  },
    scheduled: { label: 'Scheduled', color: t.colors.brandText, bg: t.colors.brandSubtle, border: t.colors.brandBorder, dot: false },
    closed:    { label: 'Closed',    color: t.colors.textMuted, bg: t.colors.bgRaised,    border: t.colors.border,      dot: false },

    approved:  { label: 'Approved',  color: t.colors.green,  bg: t.colors.greenBg,  border: t.colors.greenBorder,  dot: false },
    pending:   { label: 'Pending',   color: t.colors.amber,  bg: t.colors.amberBg,  border: t.colors.amberBorder,  dot: false },
    rejected:  { label: 'Rejected',  color: t.colors.red,    bg: t.colors.redBg,    border: t.colors.redBorder,    dot: false },
  };

  return map[status] ?? {
    label:  String(status).charAt(0).toUpperCase() + String(status).slice(1),
    color:  t.colors.textSecondary,
    bg:     t.colors.bgRaised,
    border: t.colors.border,
    dot:    false,
  };
}