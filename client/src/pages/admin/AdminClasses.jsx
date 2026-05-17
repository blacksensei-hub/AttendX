import { useState }                                  from 'react';
import { useQuery }                                  from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Search, MapPin, Users, BookOpen,
  ChevronLeft, ChevronRight,
}                                                    from 'lucide-react';

import { adminService }                              from '../../services/adminService';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AdminClasses — platform-wide class browser.
 *
 * Read-only listing of every class on the platform. Admins can't
 * edit these directly (that's the lecturer's responsibility) but
 * they get visibility into what's running.
 *
 * Each card shows class name, description, join code, enrolment
 * count, location, and the owning lecturer.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AdminClasses() {
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-classes', search, page],
    queryFn:  () => adminService.getClasses({ search, page, limit: 20 }),
    keepPreviousData: true,
  });

  const classes    = data?.classes    ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total      = data?.total      ?? 0;

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="All classes"
        subtitle={`${total} class${total !== 1 ? 'es' : ''} across all lecturers`}
      />

      {/* ── Search ──────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        maxWidth: '440px',
      }}>
        <Search size={14} style={{
          position:      'absolute',
          left:          '12px',
          top:           '50%',
          transform:     'translateY(-50%)',
          color:         'var(--text-muted)',
          pointerEvents: 'none',
        }} />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by class name…"
          className="input-base"
          style={{ paddingLeft: '36px' }}
        />
      </div>

      {/* ── Class grid / empty / loading ────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            style={{
              display:             'grid',
              gap:                 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{
                  height:       '200px',
                  borderRadius: 'var(--radius-molecular)',
                }}
              />
            ))}
          </motion.div>
        ) : classes.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -8 }}
            transition={SPRING.snappy}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        'var(--space-6) var(--space-3)',
              background:     'var(--bg-card)',
              border:         '1px dashed var(--border-hover)',
              borderRadius:   'var(--radius-molecular)',
              textAlign:      'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: DURATION.slow, ease: EASE.bounce, delay: 0.1 }}
              style={{
                width:          '56px',
                height:         '56px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--bg-raised)',
                border:         '1px solid var(--border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-2)',
              }}
            >
              <BookOpen size={24} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
            <p style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              {search ? 'No classes match your search' : 'No classes yet'}
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '4px',
              maxWidth:  '320px',
            }}>
              {search
                ? 'Try a different search term or clear the field.'
                : 'Classes created by lecturers will appear here.'}
            </p>
          </motion.div>
        ) : (
          <AnimatedList
            key="grid"
            style={{
              display:             'grid',
              gap:                 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            <AnimatePresence initial={false}>
              {classes.map(cls => (
                <AnimatedItem key={cls.id} layout>
                  <ClassCard cls={cls} />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </AnimatePresence>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onGoTo={setPage}
        />
      )}
    </PageShell>
  );
}

// ─── Class card ────────────────────────────────────────────────
function ClassCard({ cls }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={SPRING.snappy}
      style={{
        background:    'var(--bg-card)',
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        boxShadow:     'var(--shadow-md)',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Ambient violet glow — matches the admin palette */}
      <div style={{
        position:      'absolute',
        top:           '-50px',
        right:         '-50px',
        width:         '140px',
        height:        '140px',
        background:    'var(--violet-bg)',
        filter:        'blur(50px)',
        opacity:       0.5,
        pointerEvents: 'none',
      }} />

      {/* ── Header: name + join code ────────────────────────── */}
      <div style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            'var(--space-2)',
        marginBottom:   'var(--space-2)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            color:         'var(--text-primary)',
            fontWeight:    600,
            fontSize:      'var(--text-md)',
            fontFamily:    'var(--font-display)',
            letterSpacing: '-0.005em',
            overflow:      'hidden',
            textOverflow:  'ellipsis',
            whiteSpace:    'nowrap',
            lineHeight:    1.25,
          }}>
            {cls.name}
          </p>
          <p style={{
            color:            'var(--text-muted)',
            fontSize:         'var(--text-xs)',
            marginTop:        '2px',
            display:          '-webkit-box',
            WebkitLineClamp:  2,
            WebkitBoxOrient:  'vertical',
            overflow:         'hidden',
            lineHeight:       1.5,
          }}>
            {cls.description || 'No description'}
          </p>
        </div>

        <span style={{
          fontFamily:    'var(--font-mono)',
          color:         'var(--violet)',
          fontSize:      'var(--text-xs)',
          fontWeight:    700,
          background:    'var(--violet-bg)',
          border:        '1px solid var(--violet-border)',
          padding:       '2px 10px',
          borderRadius:  'var(--radius-pill)',
          letterSpacing: '0.06em',
          whiteSpace:    'nowrap',
          flexShrink:    0,
        }}>
          {cls.code}
        </span>
      </div>

      {/* ── Metadata rows ───────────────────────────────────── */}
      <div style={{
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        gap:           '6px',
        flex:          1,
      }}>
        <MetaItem
          icon={Users}
          label={`${cls.enrollmentCount} student${cls.enrollmentCount !== 1 ? 's' : ''} enrolled`}
        />
        {cls.location_name && (
          <MetaItem icon={MapPin} label={cls.location_name} truncate />
        )}
      </div>

      {/* ── Footer: lecturer badge ──────────────────────────── */}
      <div style={{
        position:   'relative',
        marginTop:  'var(--space-2)',
        paddingTop: 'var(--space-2)',
        borderTop:  '1px solid var(--border)',
        display:    'flex',
        alignItems: 'center',
        gap:        '8px',
      }}>
        <div style={{
          width:          '26px',
          height:         '26px',
          borderRadius:   'var(--radius-atomic)',
          background:     'var(--brand-subtle)',
          border:         '1px solid var(--brand-border)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       '11px',
          fontWeight:     700,
          color:          'var(--brand-text)',
          fontFamily:     'var(--font-display)',
          flexShrink:     0,
        }}>
          {cls.lecturer?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            color:         'var(--text-muted)',
            fontSize:      '9px',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            lineHeight:    1.2,
          }}>
            Lecturer
          </p>
          <p style={{
            color:        'var(--text-primary)',
            fontSize:     'var(--text-xs)',
            fontWeight:   500,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            marginTop:    '1px',
          }}>
            {cls.lecturer?.name ?? 'Unknown'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Meta item (icon + label) ──────────────────────────────────
function MetaItem({ icon: Icon, label, truncate }) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        '6px',
      color:      'var(--text-muted)',
      fontSize:   'var(--text-xs)',
      minWidth:   0,
    }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span style={{
        overflow:     truncate ? 'hidden' : 'visible',
        textOverflow: truncate ? 'ellipsis' : 'clip',
        whiteSpace:   'nowrap',
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────
function Pagination({ page, totalPages, total, onPrev, onNext, onGoTo }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '6px',
      paddingTop:     'var(--space-2)',
      flexWrap:       'wrap',
    }}>
      <motion.button
        whileTap={TAP.button}
        onClick={onPrev}
        disabled={page === 1}
        className="btn-ghost"
        style={{
          padding: '8px 10px',
          opacity: page === 1 ? 0.4 : 1,
        }}
      >
        <ChevronLeft size={15} />
      </motion.button>

      <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`e-${i}`}
              style={{
                padding:  '8px 4px',
                color:    'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              …
            </span>
          ) : (
            <motion.button
              key={p}
              whileTap={TAP.button}
              onClick={() => onGoTo(p)}
              style={{
                position:     'relative',
                width:        '36px',
                height:       '36px',
                borderRadius: 'var(--radius-atomic)',
                border:       'none',
                background:   'transparent',
                color:        p === page ? 'var(--violet)' : 'var(--text-secondary)',
                fontWeight:   p === page ? 700 : 500,
                fontSize:     'var(--text-sm)',
                fontFamily:   'var(--font-mono)',
                cursor:       'pointer',
              }}
            >
              {p === page && (
                <motion.div
                  layoutId="classes-page-active"
                  transition={SPRING.gentle}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    background:   'var(--violet-bg)',
                    border:       '1px solid var(--violet-border)',
                    borderRadius: 'var(--radius-atomic)',
                    zIndex:       0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{p}</span>
            </motion.button>
          )
        )}
      </div>

      <motion.button
        whileTap={TAP.button}
        onClick={onNext}
        disabled={page === totalPages}
        className="btn-ghost"
        style={{
          padding: '8px 10px',
          opacity: page === totalPages ? 0.4 : 1,
        }}
      >
        <ChevronRight size={15} />
      </motion.button>

      <span style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        marginLeft: 'var(--space-2)',
        fontFamily: 'var(--font-mono)',
      }}>
        Page {page} of {totalPages} · {total} total
      </span>
    </div>
  );
}