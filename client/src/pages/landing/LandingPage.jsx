// client/src/pages/landing/LandingPage.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Link }                                     from 'react-router-dom';
import { QRCodeSVG }                                from 'qrcode.react';
import { ArrowRight, ArrowUpRight }                 from 'lucide-react';

import BrandMark                                    from '../../components/ui/BrandMark';
import { mountScrubHero }                           from './scrubHero';
import { mountAnchorScroll, compactNavClearance }   from './anchorScroll';
import './landing.css';

/**
 * ═════════════════════════════════════════════════════════════════
 * LandingPage — the public front door at "/".
 *
 * "Every seat, counted." A scroll-scrubbed hero (light falling into
 * a lecture hall, seats lighting teal as they're taken), then five
 * sections that each explain one part of how the seats get counted,
 * all funnelling to one action: Sign in.
 *
 * Signed-in visitors never see this; RootRedirect sends them to
 * their dashboard. Phones and reduced-motion visitors get a composed
 * still hero instead of the scrub (see the gates in scrubHero.js).
 * ═════════════════════════════════════════════════════════════════
 */

// Seeded PRNG so the "random" character offsets are the same on
// every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function Split({ text, seed = 1, chars = false, spread = 0.5 }) {
  const r     = rng(seed);
  const words = text.split(' ');
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, wi) => (
          <span key={wi}>
            <span className="w" style={{ '--th': ((wi / words.length) * spread).toFixed(3) }}>
              {chars
                ? [...w].map((ch, ci) => (
                    <span
                      key={ci}
                      className="c"
                      style={{
                        '--th': (r() * 0.55).toFixed(3),
                        '--jx': `${((r() - 0.5) * 140).toFixed(1)}px`,
                        '--jy': `${((r() - 0.5) * 90).toFixed(1)}px`,
                        '--jr': `${((r() - 0.5) * 50).toFixed(1)}deg`,
                      }}
                    >
                      {ch}
                    </span>
                  ))
                : w}
            </span>
            {wi < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </>
  );
}

// Adds .in when a section scrolls into view, then .done once the
// staggered entrance has finished so hovers never inherit its delays.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.classList.add('in');
      t = setTimeout(() => el.classList.add('done'), 1600);
      io.disconnect();
    }, { threshold: 0.18 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return ref;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LandingPage() {
  const rootRef           = useRef(null);
  const heroRef           = useRef(null);
  const [onHero, setOnHero] = useState(true);
  const [compact, setCompact] = useState(() => window.scrollY > 24);

  useEffect(() => mountScrubHero(heroRef.current), []);
  useEffect(() => mountAnchorScroll(rootRef.current), []);

  // Nav reads light-on-dark while it sits over the hero. It is always
  // the compact pill by the time the hero scrolls out from under it, so
  // the pill's bottom edge is the line that matters.
  useEffect(() => {
    const clearance = compactNavClearance(rootRef.current);
    const io = new IntersectionObserver(
      ([e]) => setOnHero(e.isIntersecting),
      { rootMargin: `-${clearance}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);

  // Nav becomes a floating pill as soon as the page scrolls
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Pause CSS loops on hidden tabs
  useEffect(() => {
    const on = () => document.body.classList.toggle('paused', document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = 'AttendX · Every seat, counted';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      <a href="#how" className="sr-only">Skip the intro</a>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className={`lp-nav${onHero ? ' on-hero' : ''}${compact ? ' is-compact' : ''}`}>
        <div className="lp-nav-bar">
          <Link to="/" aria-label="AttendX" className="lp-logo">
            <BrandMark size={30} tone={onHero ? 'inverse' : 'default'} />
          </Link>
          <nav className="lp-nav-links" aria-label="Page">
            <a href="#how">How it works</a>
            <a href="#register">Try it</a>
            <a href="#roles">Who it's for</a>
            <a href="#faq">Questions</a>
          </nav>
          <Link to="/login" className="btn-accent lp-signin">
            Sign in <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="lp-hero" ref={heroRef} aria-label="Every seat, counted">
        <div className="lp-stage">
          <div className="lp-scrub-only" aria-hidden="true">
            <div className="lp-poster" />
            <video
              className="lp-video"
              muted
              playsInline
              preload="none"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="lp-scrim" />
          </div>

          <div className="lp-bands lp-scrub-only">
            <div className="band is-first fx-rise fx-first" data-a="0" data-b="0.22">
              <p className="kicker"><span className="dot" /> GCTU / Class attendance</p>
              <h1 className="band-h"><Split text="Every seat, counted." spread={0.5} /></h1>
              <p className="band-p">
                Lecturers open a session. Students scan. The register fills itself.
              </p>
            </div>

            <div className="band fx-drift" data-a="0.26" data-b="0.48">
              <p className="kicker">02 / Sit</p>
              <h2 className="band-h is-mid">
                <Split text="No sheet passed around. No names read out." spread={0.55} />
              </h2>
            </div>

            <div className="band fx-scatter" data-a="0.52" data-b="0.74" data-ramp="0.09">
              <p className="kicker">03 / Scan</p>
              <h2 className="band-h is-mid">
                <Split text="One scan from inside the room." seed={7} chars />
              </h2>
              <p className="band-p" style={{ opacity: 'var(--k, 0)' }}>
                The code changes every five seconds, so a photo in the group chat is already out of date.
              </p>
            </div>

            <div className="band fx-rise fx-stage" data-a="0.78" data-b="1" data-ramp="0.12">
              <p className="kicker"><span className="dot" /> 04 / Counted</p>
              <h2 className="band-h"><Split text="The register fills itself." spread={0.45} /></h2>
              <p className="band-p">Sign in with your AttendX account to open a session or mark your seat.</p>
              <div className="band-cta">
                <Link to="/login" className="btn-accent">Sign in <ArrowRight size={16} /></Link>
                <a href="#how" className="btn-ghost btn-onnight">How it works</a>
              </div>
            </div>
          </div>

          <div className="lp-hud lp-scrub-only" aria-hidden="true">
            <span className="lp-chip">
              <span className="live-dot" /> Seats lit <b data-hud>000</b> / 240
            </span>
          </div>

          <div className="lp-chapters lp-scrub-only" aria-hidden="true">
            <span data-chapter>01 Arrive</span>
            <span data-chapter>02 Sit</span>
            <span data-chapter>03 Scan</span>
            <span data-chapter>04 Counted</span>
          </div>

          <svg className="lp-ring lp-scrub-only" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(238,241,247,.18)" strokeWidth="3" />
            <circle
              cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray="126" strokeLinecap="round"
              transform="rotate(-90 24 24)"
              style={{ strokeDashoffset: 'var(--ld, 126)' }}
            />
          </svg>
          <div className="lp-cue lp-scrub-only" aria-hidden="true"><i /> Scroll</div>

          {/* Static hero: phones and reduced motion */}
          <div className="lp-static">
            <p className="kicker" style={{ color: 'rgba(238,241,247,.6)' }}>
              <span className="dot" style={{ background: '#14C9A6' }} /> GCTU / Class attendance
            </p>
            <h1 className="band-h">Every seat, counted.</h1>
            <p className="band-p">Lecturers open a session. Students scan. The register fills itself.</p>
            <div className="band-cta">
              <Link to="/login" className="btn-accent">Sign in <ArrowRight size={16} /></Link>
              <a href="#how" className="btn-ghost btn-onnight">How it works</a>
            </div>
          </div>
        </div>
      </section>

      <div className="env-layer" aria-hidden="true" />

      <HowItWorks />
      <TakeTheRegister />
      <HardToFake />
      <Roles />
      <Faq />
      <FinalCta />

      <footer className="lp-foot">
        <BrandMark size={24} />
        <span>Final year project, Ghana Communication Technology University.</span>
        <nav className="lp-foot-links" aria-label="Footer">
          <a href="#how">How it works</a>
          <a href="#faq">Questions</a>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create an account</Link>
        </nav>
      </footer>
    </div>
  );
}

// ─── 01 How it works ───────────────────────────────────────────
function HowItWorks() {
  const ref = useReveal();
  return (
    <section id="how" className="lp-sec rv" ref={ref}>
      <div className="lp-wrap">
        <div className="how-head">
          <div>
            <p className="kicker st"><span className="dot" /> 01 / How it works</p>
            <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18 }}>Open. Scan. <em>Done.</em></h2>
          </div>
          <p className="lp-lede st" style={{ '--i': 2 }}>
            A whole class marked in the time it used to take to find a pen. Here is what happens between the lecturer walking in and the register closing.
          </p>
        </div>

        <div className="how-grid">
          <article className="how-card st" style={{ '--i': 3 }}>
            <div className="how-vis"><RotatingQr /></div>
            <span className="how-n">01</span>
            <h3 className="how-t">Open</h3>
            <p className="how-b">
              The lecturer opens a session from the class page. A QR code goes up on the projector and changes every five seconds.
            </p>
          </article>

          <article className="how-card st" style={{ '--i': 4 }}>
            <div className="how-vis">
              <div className="phone">
                <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <g className="br" fill="none" stroke="#6F8BFF" strokeWidth="3.5" strokeLinecap="round">
                    <path d="M12 24v-6a6 6 0 0 1 6-6h6" />
                    <path d="M40 12h6a6 6 0 0 1 6 6v6" />
                    <path d="M52 40v6a6 6 0 0 1-6 6h-6" />
                    <path d="M24 52h-6a6 6 0 0 1-6-6v-6" />
                  </g>
                  <path className="draw" d="M22 33l7 7 14-15" fill="none" stroke="#14C9A6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <span className="how-n">02</span>
            <h3 className="how-t">Scan</h3>
            <p className="how-b">
              Students scan from their seat with the AttendX app or any phone browser. It only counts inside the classroom's 100 metre zone.
            </p>
          </article>

          <article className="how-card st" style={{ '--i': 5 }}>
            <div className="how-vis">
              <div className="roster">
                {[
                  ['Ama Owusu',     '08:02', 'p', 'Present'],
                  ['Kwame Mensah',  '08:03', 'p', 'Present'],
                  ['Efua Boateng',  '08:17', 'l', 'Late'],
                  ['Yaw Asante',    '',      'a', 'Absent'],
                ].map(([nm, tm, k, label], r) => (
                  <div key={nm} className="roster-row" style={{ '--r': r }}>
                    <span className="nm">{nm}</span>
                    <span className="tm">{tm || '--:--'}</span>
                    <span className={`pill ${k}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <span className="how-n">03</span>
            <h3 className="how-t">Done</h3>
            <p className="how-b">
              Names land on the lecturer's screen as they scan. When the session closes, anyone who didn't scan is marked absent for you.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function RotatingQr() {
  const [n, setN] = useState(1);
  const ref       = useRef(null);

  useEffect(() => {
    if (reducedMotion()) return;
    let id = null;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && id === null) {
        id = setInterval(() => { if (!document.hidden) setN(x => x + 1); }, 5000);
      } else if (!e.isIntersecting && id !== null) {
        clearInterval(id);
        id = null;
      }
    });
    io.observe(ref.current);
    return () => { io.disconnect(); if (id !== null) clearInterval(id); };
  }, []);

  return (
    <div ref={ref} className="qr-tile scanframe is-live" style={{ '--radius-molecular': '14px' }}>
      <QRCodeSVG
        key={n}
        value={`attendx:demo:${n.toString(36)}:${(n * 7919).toString(36)}`}
        size={132}
        bgColor="#F9FAFC"
        fgColor="#0B1B3F"
        level="M"
        style={{ animation: 'fadeIn .35s var(--ease-state) both' }}
      />
      <div className="qr-bar" aria-hidden="true"><i key={n} /></div>
    </div>
  );
}

// ─── 02 Take the register (the interactive moment) ─────────────
const ROWS = 5, COLS = 10, SEATS = ROWS * COLS;
const ABSENT = new Set([7, 23, 41]);

function TakeTheRegister() {
  const ref     = useReveal();
  const secRef  = useRef(null);
  const order   = useRef(null);
  const [lit, setLit]   = useState(0);
  const [full, setFull] = useState(false);
  const hold    = useRef({ v: 0, down: false, raf: null, last: 0 });

  if (!order.current) {
    const r   = rng(42);
    const idx = [...Array(SEATS).keys()].filter(i => !ABSENT.has(i));
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    order.current = idx;
  }
  const present = SEATS - ABSENT.size;

  const paint = useCallback((v) => {
    secRef.current?.style.setProperty('--hold', v.toFixed(3));
    setLit(Math.round(v * present));
  }, [present]);

  const complete = useCallback(() => {
    hold.current.v = 1;
    paint(1);
    setFull(true);
  }, [paint]);

  // Progress builds while held and eases back down when released.
  // The loop lives on the ref so start/stop can kick it from events.
  useEffect(() => {
    const h = hold.current;
    h.step = function step(now) {
      const dt = Math.min(64, now - (h.last || now)) / 1000;
      h.last   = now;
      if (h.down) h.v = Math.min(1, h.v + dt / 2.4);
      else        h.v = Math.max(0, h.v - dt * 0.9 * (0.35 + h.v));
      paint(h.v);
      if (h.v >= 1) { h.raf = null; h.last = 0; complete(); return; }
      if (!h.down && h.v <= 0) { h.raf = null; h.last = 0; return; }
      h.raf = requestAnimationFrame(step);
    };

    // Reduced motion flipped on mid-visit: finish the register instantly
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = e => { if (e.matches && h.v > 0) complete(); };
    mq.addEventListener('change', on);
    return () => {
      mq.removeEventListener('change', on);
      if (h.raf) cancelAnimationFrame(h.raf);
      h.raf = null;
    };
  }, [paint, complete]);

  const kick = () => {
    const h = hold.current;
    if (!h.raf && h.step) h.raf = requestAnimationFrame(h.step);
  };
  const start = (e) => {
    if (full) return;
    e.preventDefault();
    if (reducedMotion()) { complete(); return; }
    hold.current.down = true;
    kick();
  };
  const stop = () => {
    hold.current.down = false;
    if (hold.current.v > 0 && !full) kick();
  };
  const reset = () => {
    hold.current.v = 0;
    setFull(false);
    paint(0);
  };

  const litSet = new Set(order.current.slice(0, lit));

  return (
    <section id="register" className="lp-sec" style={{ paddingTop: 0 }} ref={secRef}>
      <div className="reg rv" ref={ref}>
        <div className="lp-sec" style={{ paddingBlock: 'clamp(64px, 8vw, 120px)' }}>
          <div className="lp-wrap reg-grid">
            <div>
              <p className="kicker st"><span className="dot" /> 02 / Try it</p>
              <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18 }}>Hold to take the register.</h2>
              <p className="lp-lede st" style={{ '--i': 2, marginTop: 22 }}>
                This is a class of fifty. Press and hold, and the seats fill the way they do in a real session.
              </p>
              <div className="hold-row st" style={{ '--i': 3 }}>
                <button
                  type="button"
                  className={`hold-btn${full ? ' full' : ''}`}
                  onPointerDown={start}
                  onPointerUp={stop}
                  onPointerLeave={stop}
                  onPointerCancel={stop}
                  onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); }}
                  onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
                  onContextMenu={e => e.preventDefault()}
                  aria-describedby="reg-status"
                >
                  <span className="fill" aria-hidden="true" />
                  <span className="lbl">{full ? 'Register closed' : 'Hold to take the register'}</span>
                </button>
                <span className="reg-count" aria-hidden="true">
                  Present <b>{String(lit).padStart(2, '0')}</b> / {SEATS}
                </span>
              </div>
              <p id="reg-status" className={`reg-done${full ? ' show' : ''}`} role="status">
                {full && `${present} of ${SEATS} present. ${ABSENT.size} absences written to the register, and nobody had to type them.`}
              </p>
              {full && <button type="button" className="reg-reset" onClick={reset}>Run it again</button>}
            </div>

            <div className="hall st" style={{ '--i': 2 }} aria-hidden="true">
              {[...Array(ROWS).keys()].map(row => (
                <div key={row} className="hall-row">
                  {[...Array(COLS).keys()].map(col => {
                    const i   = row * COLS + col;
                    const arc = Math.pow(col - (COLS - 1) / 2, 2) * -1.1 * (1 + row * 0.18);
                    return (
                      <span
                        key={col}
                        className={`hall-seat${litSet.has(i) ? ' on' : ''}${full && ABSENT.has(i) ? ' gone' : ''}`}
                        style={{ '--arc': `${arc.toFixed(1)}px` }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 03 Hard to fake ───────────────────────────────────────────
const STATS = [
  { n: 5,   unit: 's', label: 'How long each code lives. A screenshot is stale before it gets forwarded.' },
  { n: 100, unit: 'm', label: 'The classroom zone. A scan from the hostel does not count.' },
  { n: 1,   unit: '',  label: 'Phone per student on the app. A new phone needs an admin to reset it.' },
  { n: 3,   unit: '',  label: 'Accounts marked from one phone in a session, and the lecturer gets a proxy flag.' },
];

function HardToFake() {
  const ref = useReveal();
  return (
    <section id="trust" className="lp-sec rv" ref={ref}>
      <div className="lp-wrap">
        <div className="trust-head">
          <div>
            <p className="kicker st"><span className="dot" /> 03 / Hard to fake</p>
            <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18, maxWidth: '13ch' }}>
              A friend can't sign in <em>for you.</em>
            </h2>
          </div>
          <p className="lp-lede st" style={{ '--i': 2 }}>
            Signing for someone used to take one line on a sheet. Now it needs their phone, in the room, inside five seconds.
          </p>
        </div>
        <div className="stats">
          {STATS.map((s, i) => (
            <div key={i} className="stat st" style={{ '--i': 3 + i }}>
              <p className="stat-n"><CountUp to={s.n} />{s.unit && <small>{s.unit}</small>}</p>
              <p className="stat-l">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CountUp({ to }) {
  const ref       = useRef(null);
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));

  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current;
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const run = now => {
        const t = Math.min(1, (now - t0) / 1400);
        setV(Math.round((1 - Math.pow(1 - t, 3)) * to));
        if (t < 1) raf = requestAnimationFrame(run);
      };
      raf = requestAnimationFrame(run);
    }, { threshold: 0.6 });
    io.observe(el);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pin = e => { if (e.matches) { cancelAnimationFrame(raf); setV(to); } };
    mq.addEventListener('change', pin);
    return () => { io.disconnect(); cancelAnimationFrame(raf); mq.removeEventListener('change', pin); };
  }, [to]);

  return <span ref={ref}>{v}</span>;
}

// ─── 04 Roles ──────────────────────────────────────────────────
const ROLES = [
  {
    t: 'Students', sub: 'Scan and see where you stand',
    b: 'Scan in a couple of seconds, see your attendance for every class, and know exactly how many more sessions keep you above 75 percent. Marked absent by mistake? Appeal it from your history.',
  },
  {
    t: 'Lecturers', sub: 'Open, watch, export',
    b: 'Open a session in two taps, watch names arrive live with student IDs, and export the register as CSV or PDF. Appeals and students falling behind come to you, already sorted.',
  },
  {
    t: 'Admins', sub: 'The whole campus at once',
    b: 'See every class and session across campus, manage accounts, reset a lost phone, and spot the courses where attendance is slipping before the semester is over.',
  },
];

function Roles() {
  const ref = useReveal();
  return (
    <section id="roles" className="lp-sec rv" ref={ref} style={{ paddingTop: 0 }}>
      <div className="lp-wrap">
        <div className="roles-head">
          <p className="kicker st"><span className="dot" /> 04 / Who it's for</p>
          <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18 }}>One register. Three views.</h2>
        </div>
        <div className="roles">
          {ROLES.map((r, i) => (
            <article key={r.t} className={`role role-${i} st`} style={{ '--i': 2 + i }}>
              <p className="kicker">{String(i + 1).padStart(2, '0')} / {r.sub}</p>
              <p className="role-b">{r.b}</p>
              <h3 className="role-t">{r.t}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 05 FAQ ────────────────────────────────────────────────────
const FAQ = [
  {
    t: "The camera preview is slow. Can I still scan?",
    b: "Yes. The scanner reads the code even while the preview catches up. Hold your phone steady at the screen for a second. If it still won't take, your lecturer can add you by hand.",
  },
  {
    t: 'Do I need to install anything?',
    b: 'No. AttendX works in any phone browser. There is also a mobile app, which locks to one phone for extra safety.',
  },
  {
    t: 'What if I arrive late?',
    b: "You can still scan while the session is open. After the lecturer's late window, 15 minutes by default, you're marked late instead of present.",
  },
  {
    t: 'I was there but got marked absent.',
    b: 'Open your attendance history and appeal that session. Your lecturer sees it with your reason and can approve it.',
  },
  {
    t: 'Can a friend scan for me?',
    b: 'Not easily. The code changes every five seconds, the scan has to come from inside the room, and one phone marking several accounts gets flagged to your lecturer.',
  },
  {
    t: 'How do I get an account?',
    b: 'Create one with your email and choose student or lecturer. Students add their student ID. Admin accounts are set up by the university.',
  },
];

function Faq() {
  const ref = useReveal();
  return (
    <section id="faq" className="lp-sec rv" ref={ref} style={{ paddingTop: 0 }}>
      <div className="lp-wrap split">
        <div className="split-side">
          <p className="kicker st"><span className="dot" /> 05 / Questions</p>
          <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18 }}>The practical things.</h2>
        </div>
        <Accordion items={FAQ} />
      </div>
    </section>
  );
}

function Accordion({ items, defaultOpen = -1 }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc st" style={{ '--i': 2 }}>
      {items.map((it, i) => {
        const isOpen = open === i;
        const id     = `acc-${it.t.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <div key={i} className={`acc-item${isOpen ? ' open' : ''}`}>
            <h3 style={{ margin: 0, font: 'inherit' }}>
              <button
                type="button"
                className="acc-btn"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span className="t">{it.t}</span>
                <span className="ic" aria-hidden="true" />
              </button>
            </h3>
            <div className="acc-panel" id={id} role="region" aria-hidden={!isOpen}>
              <div><p>{it.b}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Final call to action ──────────────────────────────────────
function FinalCta() {
  const ref = useReveal();
  return (
    <section className="cta rv" ref={ref} aria-label="Sign in">
      <div className="lp-wrap" style={{ width: '100%' }}>
        <p className="kicker st"><span className="dot" /> Class is starting</p>
        <h2 className="lp-h2 st" style={{ '--i': 1, marginTop: 18, maxWidth: '10ch' }}>Your seat is waiting.</h2>
        <p className="lp-lede st" style={{ '--i': 2 }}>
          Sign in to open today's session or mark your attendance. New here? Making an account takes a minute.
        </p>
        <div className="cta-row st" style={{ '--i': 3 }}>
          <span className="scanframe">
            <Link to="/login" className="btn-accent" style={{ padding: '15px 26px', fontSize: 15 }}>
              Sign in <ArrowRight size={16} />
            </Link>
          </span>
          <Link to="/register" className="btn-ghost btn-onnight" style={{ padding: '15px 22px', fontSize: 15 }}>
            Create an account
          </Link>
        </div>
      </div>
    </section>
  );
}
