/**
 * ═════════════════════════════════════════════════════════════════
 * anchorScroll — smooth in-page navigation for the landing page.
 *
 * Every same-page link (the nav tabs, the "How it works" buttons, the
 * skip link) glides to its section instead of jumping, and stops with
 * the section's content just below the fixed nav instead of under it.
 *
 *   • One eased rAF tween whose length grows with the square root of
 *     the distance, so gliding past the 600vh hero takes about a
 *     second and a short hop still feels deliberate.
 *   • The destination is re-measured every frame, so anything that
 *     shifts layout mid-glide (fonts, images) can't make it miss.
 *   • Any wheel, touch, pointer or key input from the visitor cancels
 *     the glide: the page never fights the person scrolling it.
 *   • Reduced motion: an instant jump to the same spot.
 *   • Focus moves to the section so keyboard and screen reader users
 *     land where they went, and the URL hash updates without adding
 *     a history entry.
 *   • Opening the page with a hash (/#faq) lands on that section.
 *
 * mountAnchorScroll(rootEl) returns a cleanup function.
 * ═════════════════════════════════════════════════════════════════
 */

const GAP = 28;   // px between the nav's bottom edge and the content

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reducedMotion  = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const durationFor    = distance => Math.min(1400, 450 + Math.sqrt(Math.abs(distance)) * 9);

export function mountAnchorScroll(root) {
  const nav = root.querySelector('.lp-nav');
  let raf = 0;
  let removeInterrupts = null;

  // Where the section's content starts: its first child, not the
  // section box, whose top padding would leave a large empty band.
  const targetY = section => {
    const anchor = section.firstElementChild ?? section;
    const y = anchor.getBoundingClientRect().top + window.scrollY - (nav?.offsetHeight ?? 68) - GAP;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round(Math.min(max, Math.max(0, y)));
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    removeInterrupts?.();
    removeInterrupts = null;
  };

  const arrive = section => {
    if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
  };

  const glideTo = section => {
    stop();
    const from = window.scrollY;
    const to   = targetY(section);

    if (reducedMotion() || Math.abs(to - from) < 2) {
      window.scrollTo(0, to);
      arrive(section);
      return;
    }

    const duration = durationFor(to - from);
    const start    = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + (targetY(section) - from) * easeInOutCubic(p));
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        stop();
        arrive(section);
      }
    };

    const interrupts = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    interrupts.forEach(e => window.addEventListener(e, stop, { passive: true }));
    removeInterrupts = () => interrupts.forEach(e => window.removeEventListener(e, stop));

    raf = requestAnimationFrame(step);
  };

  const sectionFor = hash => {
    const id = decodeURIComponent((hash || '').slice(1));
    return id ? document.getElementById(id) : null;
  };

  const onClick = e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link || !root.contains(link)) return;
    const section = sectionFor(link.getAttribute('href'));
    if (!section) return;

    e.preventDefault();
    history.replaceState(history.state, '', `#${section.id}`);
    glideTo(section);
  };

  root.addEventListener('click', onClick);

  // Deep link: the page is lazy-loaded, so the browser's own jump to
  // the hash happened before the section existed. Land there once
  // layout has settled.
  let deepLink = 0;
  const initial = sectionFor(window.location.hash);
  if (initial) {
    deepLink = requestAnimationFrame(() => {
      deepLink = requestAnimationFrame(() => {
        window.scrollTo(0, targetY(initial));
        arrive(initial);
      });
    });
  }

  return () => {
    stop();
    cancelAnimationFrame(deepLink);
    root.removeEventListener('click', onClick);
  };
}
