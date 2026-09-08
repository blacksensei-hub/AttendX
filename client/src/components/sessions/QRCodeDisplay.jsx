import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG }                                from 'qrcode.react';
import { motion, AnimatePresence }                  from 'framer-motion';
import { RefreshCw, Clock, Lock, Copy, Check }      from 'lucide-react';

import { sessionService }                           from '../../services/sessionService';
import QRPulseRing                                  from './QRPulseRing';
import {
  EASE, DURATION, SPRING, TAP,
}                                                   from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * QRCodeDisplay — rotating attendance QR with visual feedback.
 *
 * Composes:
 *   • QRPulseRing     — ambient 2-second warning before rotation
 *   • Countdown ring  — SVG progress stroke around the code
 *   • Token preview   — monospace token box for web-only testing
 *
 * The rotation interval is configured per-session by the lecturer.
 * Students have roughly qrInterval seconds to scan before the token
 * becomes invalid — the pulse ring + countdown work together to
 * prevent panic-scanning.
 * ═════════════════════════════════════════════════════════════════
 */
export default function QRCodeDisplay({ sessionId, qrInterval = 5 }) {
  const [qrToken,    setQrToken]    = useState(null);
  const [countdown,  setCountdown]  = useState(qrInterval);
  const [isLoading,  setIsLoading]  = useState(false);
  const [key,        setKey]        = useState(0);
  const [stopped,    setStopped]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const tickRef = useRef(null);

  // ── Fetch a fresh QR token ───────────────────────────────────
  const fetchQR = useCallback(async () => {
    if (stopped) return;
    setIsLoading(true);
    try {
      const data = await sessionService.getCurrentQR(sessionId);
      setQrToken(data.token);
      setCountdown(qrInterval);
      setKey(k => k + 1);
    } catch (err) {
      // Session closed or not found — stop polling gracefully
      if (err.response?.status === 404 || err.response?.status === 400) {
        setStopped(true);
        setQrToken(null);
        if (tickRef.current) clearInterval(tickRef.current);
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, qrInterval, stopped]);

  // ── Initial fetch ────────────────────────────────────────────
  useEffect(() => {
    fetchQR();
  }, []);   // eslint-disable-line

  // ── Rotation timer ───────────────────────────────────────────
  useEffect(() => {
    if (!qrToken || stopped) return;

    tickRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchQR();
          return qrInterval;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [qrToken, stopped]);   // eslint-disable-line

  // ── Copy token ───────────────────────────────────────────────
  const copyToken = () => {
    if (!qrToken) return;
    navigator.clipboard.writeText(qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Countdown ring progress (percentage remaining) ──────────
  const progress = ((qrInterval - countdown) / qrInterval) * 100;

  // ── Stopped state ────────────────────────────────────────────
  if (stopped) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING.gentle}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        'var(--space-4)',
          textAlign:      'center',
        }}
      >
        <div style={{
          width:          '64px',
          height:         '64px',
          background:     'var(--red-bg)',
          border:         '1px solid var(--red-border)',
          borderRadius:   'var(--radius-molecular)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   'var(--space-3)',
        }}>
          <Lock size={24} style={{ color: 'var(--red)' }} />
        </div>
        <p style={{
          color:      'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize:   'var(--text-md)',
        }}>
          Session closed
        </p>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-sm)',
          marginTop: '4px',
        }}>
          QR code is no longer active
        </p>
      </motion.div>
    );
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
    }}>

      {/* ── QR + countdown ring ─────────────────────────────── */}
      <div style={{
        position: 'relative',
        padding:  '16px',
      }}>
        {/*
          Countdown ring — SVG stroke around the QR that depletes
          as the token approaches rotation. The path is rotated -90°
          so progress starts from the top (12 o'clock).
        */}
        <svg
          style={{
            position:  'absolute',
            inset:     0,
            width:     '100%',
            height:    '100%',
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="var(--brand-subtle)"
            strokeWidth="1.2"
          />
          <circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray={`${(1 - progress / 100) * 301.59} 301.59`}
            style={{ transition: 'stroke-dasharray 0.9s linear' }}
          />
        </svg>

        {/*
          QRPulseRing wraps the visible QR tile. It receives the
          countdown value and triggers its 2-second warning pulse
          when countdown === 2. No extra props required here.
        */}
        <QRPulseRing secondsRemaining={countdown}>
          <AnimatePresence mode="wait">
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              animate={{ opacity: 1, scale: 1,    rotate: 0 }}
              exit={{    opacity: 0, scale: 0.9, rotate: 3 }}
              transition={{ duration: DURATION.base, ease: EASE.state }}
              style={{
                padding:      '20px',
                background:   '#ffffff',
                borderRadius: 'var(--radius-molecular)',
                boxShadow:    'var(--shadow-lg)',
                position:     'relative',
                overflow:     'hidden',
              }}
            >
              {/* Loading overlay — covers the QR while fetching a new token */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{    opacity: 0 }}
                    transition={{ duration: DURATION.fast }}
                    style={{
                      position:       'absolute',
                      inset:          0,
                      background:     'rgba(255, 255, 255, 0.85)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      zIndex:         10,
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    <RefreshCw
                      size={24}
                      style={{
                        color:     'var(--brand)',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {qrToken ? (
                <QRCodeSVG
                  value={qrToken}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div style={{
                  width:          '220px',
                  height:         '220px',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                }}>
                  <RefreshCw
                    size={32}
                    style={{
                      color:     '#cbd5e1',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </QRPulseRing>
      </div>

      {/* ── Countdown label ─────────────────────────────────── */}
      <motion.div
        animate={{
          color: countdown <= 2 ? 'var(--amber)' : 'var(--text-muted)',
        }}
        transition={{ duration: DURATION.base, ease: EASE.state }}
        style={{
          marginTop:   'var(--space-3)',
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          fontSize:    'var(--text-sm)',
        }}
      >
        <Clock size={14} />
        <span>
          Refreshes in{' '}
          <AnimatePresence mode="wait">
            <motion.span
              key={countdown}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: 4 }}
              transition={{ duration: DURATION.fast, ease: EASE.state }}
              style={{
                color:         countdown <= 2 ? 'var(--amber)' : 'var(--text-primary)',
                fontFamily:    'var(--font-mono)',
                fontWeight:    700,
                display:       'inline-block',
                minWidth:      '20px',
                textAlign:     'right',
              }}
            >
              {countdown}s
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.div>

      {/* ── Token preview (for web-only testing) ────────────── */}
      {qrToken && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.snappy, delay: 0.15 }}
          style={{
            marginTop:    'var(--space-3)',
            padding:      '12px 14px',
            background:   'var(--bg-raised)',
            border:       '1px solid var(--border)',
            borderRadius: 'var(--radius-atomic)',
            width:        '100%',
            maxWidth:     '280px',
          }}
        >
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   '6px',
          }}>
            <p style={{
              color:         'var(--text-muted)',
              fontSize:      '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight:    600,
            }}>
              Token (copy for web testing)
            </p>
            <motion.button
              whileTap={TAP.button}
              onClick={copyToken}
              style={{
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                padding:    '2px',
                display:    'flex',
                alignItems: 'center',
                color:      copied ? 'var(--green)' : 'var(--text-muted)',
                transition: `color ${DURATION.base}ms ${EASE.state}`,
              }}
              title={copied ? 'Copied!' : 'Copy token'}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'check' : 'copy'}
                  initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{    opacity: 0, scale: 0.6, rotate: 90 }}
                  transition={{ duration: DURATION.fast, ease: EASE.state }}
                  style={{ display: 'flex' }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>

          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   'var(--text-xs)',
            color:      'var(--brand-text)',
            wordBreak:  'break-all',
            lineHeight: 1.5,
            fontWeight: 600,
          }}>
            {qrToken}
          </p>
        </motion.div>
      )}

      {/* ── Footer disclaimer ───────────────────────────────── */}
      <p style={{
        marginTop:  'var(--space-2)',
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        textAlign:  'center',
        maxWidth:   '220px',
        lineHeight: 1.5,
      }}>
        Students must scan within this window · screenshots won't work
      </p>
    </div>
  );
}