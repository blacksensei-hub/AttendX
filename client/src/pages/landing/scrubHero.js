/**
 * ═════════════════════════════════════════════════════════════════
 * scrubHero — the scroll-scrubbed hero engine for the landing page.
 *
 * Plain DOM code on purpose. React renders the markup once; this
 * drives it every frame without re-rendering anything.
 *
 *   • Streams the video in as a Blob behind a progress ring (hosts
 *     without HTTP Range support would otherwise clamp every seek
 *     to 0), with a 20s no-progress watchdog. 1440p for large,
 *     dense screens on a decent connection, 1080p otherwise.
 *   • Eases the displayed time toward scroll with a frame-rate
 *     independent lerp, and the rAF loop rests once it converges.
 *   • Gates seeks so they never overlap (the difference between
 *     smooth and choppy in Chrome).
 *   • Writes to the DOM only when a value actually changes.
 *   • Five static-hero gates, identical to landing.css, re-evaluated
 *     live on rotation / resize / reduced-motion flips.
 *
 * mountScrubHero(heroEl) returns a cleanup function, so React
 * StrictMode's mount → unmount → mount cycle leaves nothing behind.
 * ═════════════════════════════════════════════════════════════════
 */

export const GATES = [
  '(max-width: 720px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)',
];

// Two encodes of the same 4K master. `bytes` is the fallback for the
// progress ring when a host omits Content-Length.
const VIDEOS = {
  hd:   { url: '/landing/hero-scrub-1440.mp4', bytes: 6624318 },   // 2560×1440
  full: { url: '/landing/hero-scrub.mp4',      bytes: 5719177 },   // 1920×1080
};
const POSTER_URL  = '/landing/hero-poster.jpg';
const RING_LEN    = 126;              // circumference of r=20
const SEATS_TOTAL = 231;              // what the HUD counts up to

const clamp      = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 1440p only where it shows: a screen at least 2000 device pixels
// wide (a retina laptop, a 1440p monitor) on a connection that isn't
// flagged as slow or data-saving. Everyone else gets 1080p, which
// also seeks more cheaply on modest hardware.
function pickVideo() {
  const conn = navigator.connection;
  const slow = conn && (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || ''));
  const wide = window.innerWidth * (window.devicePixelRatio || 1) >= 2000;
  return wide && !slow ? VIDEOS.hd : VIDEOS.full;
}
const smoothstep = (p, e0, e1) => {
  const t = clamp((p - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mountScrubHero(hero) {
  const stage    = hero.querySelector('.lp-stage');
  const video    = hero.querySelector('.lp-video');
  const poster   = hero.querySelector('.lp-poster');
  const ring     = hero.querySelector('.lp-ring');
  const hud      = hero.querySelector('[data-hud]');
  const chapters = [...hero.querySelectorAll('[data-chapter]')];
  const bands    = [...hero.querySelectorAll('.band')].map((el, i, all) => ({
    el,
    a:     Number(el.dataset.a),
    b:     Number(el.dataset.b),
    ramp:  el.dataset.ramp ? Number(el.dataset.ramp) : null,
    first: i === 0,
    last:  i === all.length - 1,
    op:    -1,
    k:     -1,
  }));

  let ctrl        = new AbortController();
  const timers    = new Set();
  let disposed    = false;
  let objectUrl   = null;
  let scrubOn     = false;
  let inited      = false;
  let heroOnScreen = true;

  let target = 0, shown = 0, rafId = null, lastTick = 0;
  let seekBusy = false, pendingTime = null;
  let loadK = 0, loadStart = 0, loadRaf = null;
  let lastHud = '', lastHudAt = 0, lastChapter = -1;

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  // ── Progress through the pinned region ──────────────────────
  function heroProgress() {
    const range = hero.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
  }

  // ── Seek gating ─────────────────────────────────────────────
  function requestSeek(t) {
    if (!video.duration || Number.isNaN(video.duration)) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    video.currentTime = t;
  }
  function onSeeked() {
    seekBusy = false;
    if (pendingTime !== null) {
      const t = pendingTime;
      pendingTime = null;
      requestSeek(t);
    }
  }
  function onVideoError() {
    seekBusy = false;
    pendingTime = null;
    failVideo();
  }
  video.addEventListener('seeked', onSeeked);
  video.addEventListener('error', onVideoError);

  // ── Captions, chapters, HUD (all delta-gated) ───────────────
  function updateCaptions(p, now = performance.now(), force = false) {
    for (const b of bands) {
      const f = Math.min(0.045, (b.b - b.a) / 3);
      let op;
      if (b.first)     op = 1 - smoothstep(p, b.b - f, b.b);
      else if (b.last) op = smoothstep(p, b.a, b.a + f);
      else             op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, b.b - f, b.b));

      const ramp = b.ramp || Math.min(0.06, (b.b - b.a) * 0.35);
      let k = clamp((p - b.a) / ramp, 0, 1);
      if (b.first) k = Math.max(k, loadK);

      if (force || Math.abs(op - b.op) > 0.004 || (op === 0) !== (b.op === 0) || (op === 1) !== (b.op === 1)) {
        b.op = op;
        b.el.style.opacity    = op.toFixed(3);
        b.el.style.visibility = op < 0.003 ? 'hidden' : 'visible';
      }
      if (force || Math.abs(k - b.k) > 0.008 || (k === 1) !== (b.k === 1) || (k === 0) !== (b.k === 0)) {
        b.k = k;
        b.el.style.setProperty('--k', k.toFixed(3));
      }
    }

    const ch = p < 0.24 ? 0 : p < 0.5 ? 1 : p < 0.76 ? 2 : 3;
    if (ch !== lastChapter) {
      chapters.forEach((c, i) => c.classList.toggle('is-on', i === ch));
      lastChapter = ch;
    }

    if (hud) {
      const lit  = Math.round(clamp((p - 0.42) / 0.54, 0, 1) * SEATS_TOTAL);
      const text = String(lit).padStart(3, '0');
      if (text !== lastHud && (force || now - lastHudAt >= 100)) {
        hud.textContent = text;
        lastHud   = text;
        lastHudAt = now;
      }
    }
  }

  // ── The lerp loop (rests when converged) ────────────────────
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const kf = 0.14;
    shown += (target - shown) * (1 - Math.pow(1 - kf, dt / 16.667));
    const done = Math.abs(target - shown) < 0.0005;
    if (done) shown = target;
    requestSeek(shown * (video.duration || 0));
    updateCaptions(shown, now, done);
    if (done) { rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
  }

  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }

  // Band one assembles on load, then hands over to scroll.
  function loadTick(now) {
    if (!loadStart) loadStart = now;
    const t = clamp((now - loadStart) / 1200, 0, 1);
    loadK = 1 - Math.pow(1 - t, 3);
    updateCaptions(shown, now, true);
    loadRaf = t < 1 ? requestAnimationFrame(loadTick) : null;
  }

  // ── Video: poster first, then the streamed Blob ─────────────
  function failVideo() {
    if (disposed) return;
    stage.classList.add('video-failed');
    stage.classList.remove('video-loading');
  }

  async function loadHeroBlob(source) {
    ctrl = new AbortController();
    let watchdog = later(() => ctrl.abort(), 20000);
    stage.classList.add('video-loading');
    const res = await fetch(source.url, { priority: 'low', signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error(`video ${res.status}`);
    const total  = Number(res.headers.get('Content-Length')) || source.bytes;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog); timers.delete(watchdog);
      watchdog = later(() => ctrl.abort(), 20000);
      chunks.push(value);
      got += value.length;
      const frac = Math.min(1, got / total);
      const now  = performance.now();
      if (ring && (now - lastRing > 100 || frac === 1)) {
        lastRing = now;
        ring.style.setProperty('--ld', Math.round(RING_LEN * (1 - frac)));
      }
    }
    clearTimeout(watchdog); timers.delete(watchdog);
    if (disposed) return;
    ring?.style.setProperty('--ld', 0);
    objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
    video.src = objectUrl;
    video.load();
    video.addEventListener('canplay', () => {
      if (disposed) return;
      requestSeek(heroProgress() * video.duration);
      stage.classList.add('video-ready');
      stage.classList.remove('video-loading');
    }, { once: true });
  }

  function initHeroOnce() {
    if (inited) return;
    inited = true;
    poster.style.backgroundImage = `url('${POSTER_URL}')`;
    let started = false;
    const start = () => {
      if (started || disposed) return;
      started = true;
      // One quiet retry, on the lighter file, before settling on the
      // still poster: networks drop a stream now and then.
      loadHeroBlob(pickVideo()).catch(() => {
        if (disposed) return;
        later(() => { if (!disposed) loadHeroBlob(VIDEOS.full).catch(() => failVideo()); }, 1500);
      });
    };
    const img   = new Image();
    img.onload  = start;
    img.onerror = start;
    img.src     = POSTER_URL;
    later(start, 4000);
  }

  // ── The five gates, kept live ───────────────────────────────
  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    initHeroOnce();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; });
    lastChapter = -1;
    shown = target = heroProgress();
    updateCaptions(shown, performance.now(), true);
    if (!loadRaf && loadK < 1) loadRaf = requestAnimationFrame(loadTick);
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (loadRaf !== null) { cancelAnimationFrame(loadRaf); loadRaf = null; }
    // Static mode styles everything in CSS; clear the inline drive.
    bands.forEach(b => {
      b.el.style.opacity = '';
      b.el.style.visibility = '';
      b.el.style.removeProperty('--k');
    });
  }
  function applyHeroMode() {
    if (MQLS.some(m => m.matches)) disableScrub();
    else enableScrub();
  }
  const MQLS = GATES.map(q => window.matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

  // Loop only while the hero is on screen; snap once on the way out
  const io = new IntersectionObserver(([e]) => {
    heroOnScreen = e.isIntersecting;
    if (!scrubOn) return;
    if (heroOnScreen) onScroll();
    else {
      shown = target = heroProgress();
      updateCaptions(shown, performance.now(), true);
    }
  });
  io.observe(hero);

  applyHeroMode();

  return function cleanup() {
    disposed = true;
    disableScrub();
    io.disconnect();
    MQLS.forEach(m => m.removeEventListener('change', applyHeroMode));
    video.removeEventListener('seeked', onSeeked);
    video.removeEventListener('error', onVideoError);
    timers.forEach(clearTimeout);
    ctrl.abort();
    if (objectUrl) {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
    stage.classList.remove('video-ready', 'video-loading', 'video-failed');
  };
}
