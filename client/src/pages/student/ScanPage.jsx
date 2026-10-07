import { useNavigate }                               from 'react-router-dom';
import { motion }                                    from 'framer-motion';
import { ArrowLeft, Smartphone, ScanLine, MapPin, RotateCcw } from 'lucide-react';

import PageShell                                     from '../../components/layout/PageShell';
import { SPRING, TAP }                               from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ScanPage: where a student on the website is sent to mark attendance.
 *
 * Scanning is app only. The server accepts a scan only from the phone
 * bound to the student's account, with its location when the class
 * has a classroom zone, so this page explains how to scan with the app
 * rather than taking a code itself. (It used to ask students to paste
 * the code, which the projector never shows as text.)
 * ═════════════════════════════════════════════════════════════════
 */

const STEPS = [
  { icon: Smartphone, text: 'Open the AttendX app on your phone and sign in.' },
  { icon: ScanLine,   text: 'Tap Scan and point the camera at the code on the projector.' },
  { icon: MapPin,     text: 'Allow location when the app asks. Classes with a classroom zone need it.' },
];

export default function ScanPage() {
  const navigate = useNavigate();

  return (
    <PageShell gap="var(--space-3)">
      <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        <motion.button
          whileTap={TAP.button}
          whileHover={{ x: -2 }}
          transition={SPRING.snappy}
          onClick={() => navigate('/student')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-3)', padding: 0, fontFamily: 'var(--font-body)',
          }}
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING.gentle}
          style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-organism)',
            overflow: 'hidden', boxShadow: 'var(--shadow-lg)', position: 'relative',
          }}
        >
          <div style={{
            padding: 'var(--space-4)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          }}>
            <div style={{
              width: '44px', height: '44px', flexShrink: 0,
              background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)',
              borderRadius: 'var(--radius-atomic)', boxShadow: 'var(--shadow-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Smartphone size={20} style={{ color: 'var(--brand-text)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)',
                color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2,
              }}>
                Scan with the AttendX app
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                Attendance is marked from your phone, not the website
              </p>
            </div>
          </div>

          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>
              Each scan is checked against the classroom and the phone registered to your
              account, so it has to come from the app on that phone.
            </p>

            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {STEPS.map(({ icon: Icon, text }, n) => (
                <li key={text} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', background: 'var(--bg-raised)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-atomic)',
                }}>
                  <span className="font-mono tabular" style={{ color: 'var(--brand-text)', fontSize: 'var(--text-xs)', paddingTop: '2px' }}>
                    {String(n + 1).padStart(2, '0')}
                  </span>
                  <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                  <span style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{text}</span>
                </li>
              ))}
            </ol>

            <p style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.5,
            }}>
              <RotateCcw size={14} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
              Changed phones? Your account stays registered to the old one until an administrator resets it.
            </p>
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}
