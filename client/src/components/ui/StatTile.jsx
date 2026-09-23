import { memo } from 'react';

/**
 * ═════════════════════════════════════════════════════════════════
 * StatTile — the Roll Call number tile.
 *
 * The number is the design: ink display numerals, a mono label with
 * a small tone dot, and an optional hint line. Colour lives only in
 * the dot, so a row of four tiles reads calm instead of like a bag
 * of sweets.
 *
 * `featured` flips the tile to the inverse surface; `framed` adds the
 * scan brackets. Use them once per screen, on the number the screen
 * is really about, and skip the frame if something else on the
 * screen already wears it.
 * ═════════════════════════════════════════════════════════════════
 */
const TONES = {
  brand:  'var(--brand)',
  green:  'var(--green-fill)',
  amber:  'var(--amber-fill)',
  red:    'var(--red-fill)',
  violet: 'var(--violet)',
  muted:  'var(--text-muted)',
};

function StatTile({ label, value, hint, tone = 'brand', featured = false, framed = false, index }) {
  const dot = TONES[tone] ?? tone;
  return (
    <div
      className={framed ? 'scanframe is-teal' : undefined}
      style={{ height: '100%' }}
    >
      <div style={{
        position:      'relative',
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        gap:           14,
        padding:       '20px 20px 18px',
        borderRadius:  'var(--radius-molecular)',
        background:    featured ? 'var(--bg-inverse)' : 'var(--bg-card)',
        color:         featured ? 'var(--text-inverse)' : 'var(--text-primary)',
        boxShadow:     featured ? 'var(--shadow-lg)' : 'var(--shadow-md)',
        overflow:      'hidden',
      }}>
        <p className="kicker" style={{ color: featured ? 'color-mix(in srgb, var(--text-inverse) 70%, transparent)' : undefined }}>
          <span className="dot" style={{ background: dot }} />
          {index != null && <span>{String(index).padStart(2, '0')} /</span>}
          {label}
        </p>
        <p className="num" style={{
          marginTop:     'auto',
          fontFamily:    'var(--font-display)',
          fontWeight:    650,
          fontSize:      'clamp(40px, 4.2vw, 56px)',
          lineHeight:    0.9,
          letterSpacing: '-0.045em',
        }}>
          {value}
        </p>
        {hint && (
          <p style={{
            fontSize:   'var(--text-xs)',
            lineHeight: 1.4,
            color:      featured ? 'color-mix(in srgb, var(--text-inverse) 72%, transparent)' : 'var(--text-muted)',
          }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(StatTile);

/**
 * SectionTitle — kicker + heading used above cards and lists.
 */
export function SectionTitle({ kicker, title, action, style }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'space-between',
      gap:            16,
      flexWrap:       'wrap',
      ...style,
    }}>
      <div>
        {kicker && <p className="kicker" style={{ marginBottom: 8 }}>{kicker}</p>}
        <h3 style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    650,
          fontSize:      'var(--text-lg)',
          letterSpacing: '-0.025em',
          color:         'var(--text-primary)',
        }}>
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}
