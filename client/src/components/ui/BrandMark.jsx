/**
 * ═════════════════════════════════════════════════════════════════
 * BrandMark — the AttendX mark drawn as vector, plus the wordmark.
 *
 * Replaces the white-plate PNG in the app chrome. The mark is the
 * logo's four rounded scan brackets around the check, so it reads
 * at 20px and sits on either theme without a plate behind it.
 *
 *   <BrandMark />                 mark + wordmark
 *   <BrandMark wordmark={false} /> mark only
 *   <BrandMark size={40} tone="inverse" />  for dark surfaces
 * ═════════════════════════════════════════════════════════════════
 */
export function Mark({ size = 28, tone = 'default', title = 'AttendX' }) {
  const plate   = tone === 'inverse' ? '#EEF1F5' : 'var(--bg-inverse)';
  const bracket = tone === 'inverse' ? '#2248FF' : 'var(--mark-bracket, #6F8BFF)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="15" fill={plate} />
      <g fill="none" stroke={bracket} strokeWidth="5" strokeLinecap="round">
        <path d="M14 25v-5a6 6 0 0 1 6-6h5" />
        <path d="M39 14h5a6 6 0 0 1 6 6v5" />
        <path d="M50 39v5a6 6 0 0 1-6 6h-5" />
        <path d="M25 50h-5a6 6 0 0 1-6-6v-5" />
      </g>
      <path
        d="M22.5 32.5l6.5 6.5 13-13.5"
        fill="none"
        stroke="#14C9A6"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BrandMark({
  size     = 28,
  wordmark = true,
  tone     = 'default',
  suffix,
}) {
  const ink = tone === 'inverse' ? '#EEF1F5' : 'var(--text-primary)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Mark size={size} tone={tone} />
      {wordmark && (
        <span style={{
          fontFamily:    'var(--font-display)',
          fontWeight:    750,
          fontSize:      Math.round(size * 0.72),
          letterSpacing: '-0.04em',
          lineHeight:    1,
          color:         ink,
          whiteSpace:    'nowrap',
        }}>
          Attend<span style={{ color: tone === 'inverse' ? '#8FA3FF' : 'var(--brand-text)' }}>X</span>
          {suffix && (
            <span style={{
              marginLeft:    8,
              fontFamily:    'var(--font-mono)',
              fontWeight:    500,
              fontSize:      10,
              letterSpacing: 'var(--tracking-mono)',
              textTransform: 'uppercase',
              color:         'var(--text-muted)',
              verticalAlign: 'middle',
            }}>
              {suffix}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
