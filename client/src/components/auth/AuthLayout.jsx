import { Outlet, Link }   from 'react-router-dom';
import { motion }         from 'framer-motion';
import { ArrowLeft }      from 'lucide-react';

import BrandMark          from '../ui/BrandMark';
import { EASE }           from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AuthLayout — wrapper around LoginPage and RegisterPage.
 *
 * Roll Call split screen. The form sits on the paper canvas on the
 * right; on wide screens the left half is the resting frame of the
 * landing hero (every seat lit teal) with one line of copy, so the
 * walk from the landing page into sign-in feels like one place.
 *
 * Under 1000px the picture folds away to a short band above the
 * form, so phones get straight to the fields.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AuthLayout() {
  return (
    <div className="auth">
      <style>{AUTH_CSS}</style>

      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-inner">
          <p className="kicker"><span className="dot" /> GCTU / Class attendance</p>
          <motion.p
            className="auth-line"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE.entry, delay: 0.1 }}
          >
            Every seat,<br />counted.
          </motion.p>
          <span className="auth-chip">
            <span className="live-dot" /> 231 of 240 seats lit
          </span>
        </div>
      </aside>

      <main className="auth-main">
        <header className="auth-top">
          <Link to="/" aria-label="AttendX home" style={{ display: 'inline-flex' }}>
            <BrandMark size={30} />
          </Link>
          <Link to="/" className="auth-back">
            <ArrowLeft size={14} /> Home
          </Link>
        </header>

        <div className="auth-form">
          <Outlet />
        </div>

        <p className="auth-foot kicker">
          © {new Date().getFullYear()} AttendX · Final year project, GCTU
        </p>
      </main>
    </div>
  );
}

const AUTH_CSS = `
.auth {
  min-height: 100dvh;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--bg);
}
.auth-art {
  position: sticky;
  top: 0;
  height: 100dvh;
  margin: 12px 0 12px 12px;
  height: calc(100dvh - 24px);
  border-radius: 28px;
  overflow: hidden;
  background: #070D1F url('/landing/hero-ending.jpg') 68% 60% / cover no-repeat;
  color: #EEF1F7;
}
.auth-art::before {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(5,8,20,.72) 0%, rgba(5,8,20,.18) 42%, rgba(5,8,20,.1) 60%, rgba(5,8,20,.7) 100%);
}
.auth-art-inner {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: clamp(28px, 4vw, 52px);
}
.auth-art .kicker { color: rgba(238,241,247,.62); }
.auth-art .kicker .dot { background: #14C9A6; }
.auth-line {
  margin-top: 22px;
  font-family: var(--font-display);
  font-weight: 650;
  font-size: clamp(48px, 5.4vw, 88px);
  line-height: .95;
  letter-spacing: -0.036em;
  text-shadow: 0 2px 30px rgba(3,6,16,.6);
}
.auth-chip {
  margin-top: auto;
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 9px 14px;
  border-radius: 10px;
  background: rgba(8,12,26,.55);
  border: 1px solid rgba(150,165,220,.22);
  backdrop-filter: blur(10px);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: rgba(238,241,247,.8);
}
.auth-chip .live-dot, .auth-chip .live-dot::after { background: #14C9A6; }
.auth-main {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 24px clamp(20px, 5vw, 72px) 28px;
}
.auth-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.auth-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--text-sm); font-weight: 600;
  color: var(--text-subtle);
  padding: 8px 12px; border-radius: 999px;
  transition: background-color var(--duration-base) var(--ease-state), color var(--duration-base) var(--ease-state);
}
.auth-back:hover { background: var(--bg-hover); color: var(--text-primary); }
.auth-form {
  width: 100%;
  max-width: 440px;
  margin: auto;
  padding: clamp(40px, 8vh, 80px) 0;
}
.auth-foot { text-align: center; justify-content: center; font-size: 10.5px; }

@media (max-width: 999px) {
  .auth { grid-template-columns: 1fr; }
  .auth-art { display: none; }
}
`;
