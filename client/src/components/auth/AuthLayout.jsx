import { Outlet, Link }                      from 'react-router-dom';
import { motion }                            from 'framer-motion';
import {
  QrCode, MapPin, Radio, Sparkles,
}                                            from 'lucide-react';

import ThemeToggle                           from '../ui/ThemeToggle';
import {
  EASE, DURATION, SPRING,
}                                            from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AuthLayout — wrapper around LoginPage and RegisterPage.
 *
 * Two-panel design on wide screens:
 *   • Left  — branded marketing panel (hidden on mobile)
 *   • Right — the actual form content via <Outlet />
 *
 * The left panel is the first impression before login, so it's the
 * one surface in the app that can afford to be more visually
 * elaborate — gradient backgrounds, orbs, feature tiles. The right
 * panel stays clean and focused (it's where the work happens).
 * ═════════════════════════════════════════════════════════════════
 */
export default function AuthLayout() {
  return (
    <div style={{
      minHeight: '100dvh',
      display:   'flex',
      background: 'var(--bg)',
    }}>

      {/* ═══ Left: decorative brand panel ══════════════════ */}
      <div
        className="hidden lg:flex"
        style={{
          display:        'none',
          flexDirection:  'column',
          justifyContent: 'space-between',
          width:          '45%',
          padding:        'var(--space-5)',
          position:       'relative',
          overflow:       'hidden',
          background:     'linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #312e81 100%)',
        }}
      >

        {/* ── Grid overlay ────────────────────────────────── */}
        <div style={{
          position:        'absolute',
          inset:           0,
          opacity:         0.08,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize:  '48px 48px',
          pointerEvents:   'none',
        }} />

        {/* ── Glow orbs — gently breathing for life ──────── */}
        <motion.div
          animate={{
            x: [0, 20, 0],
            y: [0, -15, 0],
          }}
          transition={{
            duration: 14,
            ease:     'easeInOut',
            repeat:   Infinity,
          }}
          style={{
            position:      'absolute',
            top:           '20%',
            left:          '10%',
            width:         '280px',
            height:        '280px',
            background:    'rgba(96, 165, 250, 0.35)',
            borderRadius:  'var(--radius-pill)',
            filter:        'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{
            x: [0, -25, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 18,
            ease:     'easeInOut',
            repeat:   Infinity,
            delay:    2,
          }}
          style={{
            position:      'absolute',
            bottom:        '15%',
            right:         '10%',
            width:         '240px',
            height:        '240px',
            background:    'rgba(129, 140, 248, 0.3)',
            borderRadius:  'var(--radius-pill)',
            filter:        'blur(70px)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Brand mark ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE.entry }}
          style={{
            position:   'relative',
            zIndex:     1,
            display:    'flex',
            alignItems: 'center',
            gap:        '12px',
          }}
        >
          <div style={{
            width:          '44px',
            height:         '44px',
            background:     'rgba(255,255,255,0.14)',
            border:         '1px solid rgba(255,255,255,0.22)',
            borderRadius:   'var(--radius-atomic)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     'var(--font-display)',
            fontWeight:     700,
            fontSize:       'var(--text-md)',
            color:          '#fff',
            backdropFilter: 'blur(10px)',
            boxShadow:      '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            A
          </div>
          <div>
            <p style={{
              fontFamily:    'var(--font-display)',
              fontWeight:    700,
              fontSize:      'var(--text-md)',
              color:         '#fff',
              letterSpacing: '-0.01em',
              lineHeight:    1.1,
            }}>
              AttendX
            </p>
            <p style={{
              color:         'rgba(255,255,255,0.55)',
              fontSize:      '11px',
              fontFamily:    'var(--font-mono)',
              letterSpacing: '0.08em',
              marginTop:     '2px',
              textTransform: 'uppercase',
            }}>
              Class attendance, reimagined
            </p>
          </div>
        </motion.div>

        {/* ── Feature highlights ──────────────────────────── */}
        <div style={{
          position:       'relative',
          zIndex:         1,
          display:        'flex',
          flexDirection:  'column',
          gap:            'var(--space-4)',
        }}>

          {/* Lead copy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: DURATION.slow, ease: EASE.entry }}
          >
            <div style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          '6px',
              padding:      '4px 12px',
              background:   'rgba(255,255,255,0.08)',
              border:       '1px solid rgba(255,255,255,0.14)',
              borderRadius: 'var(--radius-pill)',
              marginBottom: 'var(--space-2)',
              backdropFilter: 'blur(10px)',
            }}>
              <Sparkles size={11} style={{ color: '#fff' }} />
              <span style={{
                color:         '#fff',
                fontSize:      '10px',
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Built for modern classrooms
              </span>
            </div>
            <h2 style={{
              fontFamily:    'var(--font-display)',
              fontWeight:    700,
              fontSize:      '32px',
              color:         '#fff',
              letterSpacing: '-0.02em',
              lineHeight:    1.15,
              marginBottom:  '10px',
              maxWidth:      '380px',
            }}>
              Attendance that lecturers and students actually love.
            </h2>
            <p style={{
              color:      'rgba(255,255,255,0.7)',
              fontSize:   'var(--text-sm)',
              lineHeight: 1.6,
              maxWidth:   '380px',
            }}>
              Rotating QR codes, location verification, real-time dashboards, and an audit trail you can trust. No more name-shouting, no more proxy attendance.
            </p>
          </motion.div>

          {/* Feature tiles */}
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '12px',
          }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay:    0.4 + i * 0.12,
                  duration: DURATION.slow,
                  ease:     EASE.entry,
                }}
                style={{
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          '12px',
                  padding:      '12px',
                  background:   'rgba(255,255,255,0.06)',
                  border:       '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-atomic)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  background:     'rgba(255,255,255,0.1)',
                  border:         '1px solid rgba(255,255,255,0.14)',
                  borderRadius:   'var(--radius-atomic)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  color:          '#fff',
                }}>
                  <f.icon size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    color:      '#fff',
                    fontWeight: 600,
                    fontSize:   'var(--text-sm)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {f.title}
                  </p>
                  <p style={{
                    color:      'rgba(255,255,255,0.6)',
                    fontSize:   'var(--text-xs)',
                    marginTop:  '2px',
                    lineHeight: 1.5,
                  }}>
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: DURATION.slow }}
          style={{
            position:   'relative',
            zIndex:     1,
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--space-2)',
            color:      'rgba(255,255,255,0.4)',
            fontSize:   '11px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>© {new Date().getFullYear()} AttendX</span>
          <span>·</span>
          <span>Final Year Project</span>
        </motion.div>
      </div>

      {/* ═══ Right: form panel ═════════════════════════════ */}
      <div style={{
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        'var(--space-4) var(--space-3)',
        backgroundColor: 'var(--bg)',
        position:       'relative',
        transition:     `background-color ${DURATION.medium}ms ${EASE.state}`,
      }}>

        {/* Subtle brand glow — mobile only, since the left panel covers desktop */}
        <div
          className="lg:hidden"
          style={{
            position:      'absolute',
            top:           '-80px',
            right:         '-80px',
            width:         '260px',
            height:        '260px',
            background:    'var(--brand-subtle)',
            filter:        'blur(80px)',
            opacity:       0.6,
            pointerEvents: 'none',
          }}
        />

        {/* Theme toggle — top right corner */}
        <div style={{
          position: 'absolute',
          top:      'var(--space-3)',
          right:    'var(--space-3)',
          zIndex:   10,
        }}>
          <ThemeToggle />
        </div>

        {/* Form wrapper */}
        <div style={{
          width:    '100%',
          maxWidth: '440px',
          position: 'relative',
        }}>

          {/* Mobile logo — only visible when the left panel is hidden */}
          <div
            className="lg:hidden"
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '10px',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div style={{
              width:          '40px',
              height:         '40px',
              background:     'var(--brand)',
              borderRadius:   'var(--radius-atomic)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#fff',
              fontFamily:     'var(--font-display)',
              fontWeight:     700,
              fontSize:       'var(--text-md)',
              boxShadow:      'var(--shadow-brand)',
            }}>
              A
            </div>
            <div>
              <p style={{
                fontFamily:    'var(--font-display)',
                fontWeight:    700,
                fontSize:      'var(--text-md)',
                color:         'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight:    1.1,
              }}>
                AttendX
              </p>
              <p style={{
                color:         'var(--text-muted)',
                fontSize:      '10px',
                fontFamily:    'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Class attendance
              </p>
            </div>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}

// ─── Feature tile data ─────────────────────────────────────────
const FEATURES = [
  {
    icon:  QrCode,
    title: 'Rotating QR codes',
    desc:  'Codes refresh every few seconds — screenshots expire instantly.',
  },
  {
    icon:  MapPin,
    title: 'Geofence verification',
    desc:  'GPS ensures students are physically in the classroom.',
  },
  {
    icon:  Radio,
    title: 'Real-time dashboards',
    desc:  'Watch attendance flow in live as students scan.',
  },
];