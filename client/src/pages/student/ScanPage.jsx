import { useState }                                  from 'react';
import { useSearchParams, useNavigate }              from 'react-router-dom';
import { useMutation }                               from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  QrCode, ArrowLeft, CheckCircle, XCircle,
  RotateCcw, Clock,
}                                                    from 'lucide-react';
import toast                                         from 'react-hot-toast';

import { sessionService }                            from '../../services/sessionService';
import PageShell                                     from '../../components/layout/PageShell';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ScanPage — student-side attendance marking.
 *
 * Web-only: students paste the rotating token from the lecturer's
 * QR code display. (The mobile app uses a camera scanner that
 * delegates to the same /mark endpoint.)
 *
 * Three states:
 *   1. Idle       — show the token input
 *   2. Submitting — spinner on primary button
 *   3. Result     — big success/error panel, auto-redirect on success
 * ═════════════════════════════════════════════════════════════════
 */
export default function ScanPage() {
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('sessionId');
  const navigate       = useNavigate();

  const [token,  setToken]  = useState('');
  const [result, setResult] = useState(null); // 'success' | 'error'
  const [msg,    setMsg]    = useState('');

  // ── Mark attendance ──────────────────────────────────────────
  const markMut = useMutation({
    mutationFn: () => sessionService.markAttendance(
      sessionId,
      token,
      { latitude: null, longitude: null }
    ),
    onSuccess: (data) => {
      setResult('success');
      setMsg(data.message || 'Attendance marked successfully');
      toast.success(data.message || 'Attendance marked');
      setTimeout(() => navigate('/student'), 2500);
    },
    onError: (err) => {
      setResult('error');
      setMsg(err.response?.data?.message || 'Failed to mark attendance');
    },
  });

  const reset = () => {
    setResult(null);
    setMsg('');
    setToken('');
  };

  return (
    <PageShell gap="var(--space-3)">
      <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* ── Back link ───────────────────────────────────────── */}
        <motion.button
          whileTap={TAP.button}
          whileHover={{ x: -2 }}
          transition={SPRING.snappy}
          onClick={() => navigate('/student')}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '6px',
            color:        'var(--text-muted)',
            background:   'none',
            border:       'none',
            cursor:       'pointer',
            fontSize:     'var(--text-sm)',
            marginBottom: 'var(--space-3)',
            padding:      0,
            fontFamily:   'var(--font-body)',
          }}
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </motion.button>

        {/* ── Main card ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          transition={SPRING.gentle}
          style={{
            background:   'var(--bg-card)',
            borderRadius: 'var(--radius-organism)',
            overflow:     'hidden',
            boxShadow:    'var(--shadow-lg)',
            position:     'relative',
          }}
        >
          {/* Ambient brand glow */}
          <div style={{
            position:      'absolute',
            top:           '-60px',
            right:         '-60px',
            width:         '200px',
            height:        '200px',
            background:    'var(--brand-subtle)',
            filter:        'blur(60px)',
            opacity:       0.8,
            pointerEvents: 'none',
          }} />

          {/* ── Header ─────────────────────────────────────── */}
          <div style={{
            position:     'relative',
            padding:      'var(--space-4)',
            borderBottom: '1px solid var(--border)',
            display:      'flex',
            alignItems:   'center',
            gap:          'var(--space-2)',
          }}>
            <div style={{
              width:          '44px',
              height:         '44px',
              background:     'var(--brand-subtle)',
              border:         '1px solid var(--brand-border)',
              borderRadius:   'var(--radius-atomic)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              boxShadow:      'var(--shadow-brand)',
            }}>
              <QrCode size={20} style={{ color: 'var(--brand-text)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontFamily:    'var(--font-display)',
                fontWeight:    700,
                fontSize:      'var(--text-lg)',
                color:         'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight:    1.2,
              }}>
                Mark attendance
              </h1>
              <p style={{
                color:     'var(--text-muted)',
                fontSize:  'var(--text-xs)',
                marginTop: '2px',
              }}>
                Paste the token shown on your lecturer's screen
              </p>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────── */}
          <div style={{
            position:      'relative',
            padding:       'var(--space-4)',
            display:       'flex',
            flexDirection: 'column',
            gap:           'var(--space-3)',
          }}>

            <AnimatePresence mode="wait">
              {result ? (
                /* ── Result state ─────────────────────────── */
                <ResultPanel
                  key="result"
                  type={result}
                  message={msg}
                  onReset={reset}
                />
              ) : (
                /* ── Input state ──────────────────────────── */
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{    opacity: 0, y: -8 }}
                  transition={SPRING.snappy}
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           'var(--space-3)',
                  }}
                >

                  {/* Info callout — token rotation warning */}
                  <div style={{
                    display:      'flex',
                    alignItems:   'flex-start',
                    gap:          '8px',
                    padding:      '10px 14px',
                    background:   'var(--amber-bg)',
                    border:       '1px solid var(--amber-border)',
                    borderRadius: 'var(--radius-atomic)',
                  }}>
                    <Clock
                      size={14}
                      style={{
                        color:      'var(--amber)',
                        flexShrink: 0,
                        marginTop:  '1px',
                      }}
                    />
                    <p style={{
                      color:      'var(--text-secondary)',
                      fontSize:   'var(--text-xs)',
                      lineHeight: 1.5,
                    }}>
                      The token refreshes every few seconds. Paste it quickly or copy a fresh one if you see an error.
                    </p>
                  </div>

                  {/* Token textarea */}
                  <div style={{
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           '6px',
                  }}>
                    <label style={{
                      color:      'var(--text-secondary)',
                      fontSize:   'var(--text-xs)',
                      fontWeight: 600,
                    }}>
                      QR token
                    </label>
                    <textarea
                      value={token}
                      onChange={e => {
                        setToken(e.target.value.trim());
                        setResult(null);
                      }}
                      placeholder="Paste the token from the lecturer's screen…"
                      rows={3}
                      autoFocus
                      className="input-base"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize:   'var(--text-xs)',
                        resize:     'none',
                        lineHeight: 1.5,
                      }}
                    />
                    <p style={{
                      color:      'var(--text-muted)',
                      fontSize:   '10px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {token.length} chars
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.button
                      whileTap={TAP.button}
                      onClick={() => navigate('/student')}
                      className="btn-ghost"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileTap={TAP.button}
                      whileHover={
                        token.trim() && !markMut.isPending
                          ? { y: -1 }
                          : undefined
                      }
                      transition={SPRING.snappy}
                      onClick={() => markMut.mutate()}
                      disabled={!token.trim() || markMut.isPending}
                      className="btn-primary"
                      style={{
                        flex:    2,
                        opacity: (!token.trim() || markMut.isPending) ? 0.6 : 1,
                      }}
                    >
                      {markMut.isPending ? (
                        <>
                          <span style={{
                            width:          '14px',
                            height:         '14px',
                            border:         '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius:   'var(--radius-pill)',
                            display:        'inline-block',
                            animation:      'spin 0.8s linear infinite',
                          }} />
                          Marking…
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} />
                          Mark attendance
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}

// ─── Result panel (success / error) ───────────────────────────
function ResultPanel({ type, message, onReset }) {
  const isSuccess = type === 'success';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{    opacity: 0, scale: 0.92, y: -8 }}
      transition={SPRING.gentle}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        'var(--space-4)',
        borderRadius:   'var(--radius-molecular)',
        background:     isSuccess ? 'var(--green-bg)' : 'var(--red-bg)',
        border:         `1px solid ${isSuccess ? 'var(--green-border)' : 'var(--red-border)'}`,
        textAlign:      'center',
        gap:            '10px',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Radial success/fail glow */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: isSuccess
          ? 'radial-gradient(ellipse 60% 60% at center top, var(--green-bg) 0%, transparent 70%)'
          : 'radial-gradient(ellipse 60% 60% at center top, var(--red-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
        opacity:    0.8,
      }} />

      {/* Icon with celebratory scale-in */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: isSuccess ? -10 : 10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{
          duration: DURATION.slow,
          ease:     EASE.bounce,
          delay:    0.1,
        }}
        style={{
          position:       'relative',
          width:          '72px',
          height:         '72px',
          borderRadius:   'var(--radius-pill)',
          background:     isSuccess ? 'var(--green-bg)' : 'var(--red-bg)',
          border:         `2px solid ${isSuccess ? 'var(--green-border)' : 'var(--red-border)'}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   '4px',
        }}
      >
        {isSuccess
          ? <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          : <XCircle    size={36} style={{ color: 'var(--red)' }} />
        }
      </motion.div>

      {/* Title */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...SPRING.snappy }}
        style={{
          position:   'relative',
          color:      isSuccess ? 'var(--green)' : 'var(--red)',
          fontWeight: 700,
          fontSize:   'var(--text-lg)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
        }}
      >
        {isSuccess ? 'Attendance marked' : 'Something went wrong'}
      </motion.p>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, ...SPRING.snappy }}
        style={{
          position:   'relative',
          color:      'var(--text-secondary)',
          fontSize:   'var(--text-sm)',
          lineHeight: 1.6,
          maxWidth:   '360px',
        }}
      >
        {message}
      </motion.p>

      {/* Footer */}
      {isSuccess ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: DURATION.medium }}
          style={{
            position:   'relative',
            color:      'var(--text-muted)',
            fontSize:   'var(--text-xs)',
            marginTop:  '6px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Redirecting to dashboard…
        </motion.p>
      ) : (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, ...SPRING.snappy }}
          whileTap={TAP.button}
          whileHover={{ y: -1 }}
          onClick={onReset}
          className="btn-primary"
          style={{ position: 'relative', marginTop: '6px' }}
        >
          <RotateCcw size={14} />
          Try again
        </motion.button>
      )}
    </motion.div>
  );
}