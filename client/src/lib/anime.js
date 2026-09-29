// client/src/lib/anime.js
import { animate, stagger, svg, utils } from 'animejs';

/**
 * ═════════════════════════════════════════════════════════════════
 * anime.js helpers: the choreography Framer Motion isn't built for.
 *
 *   tickTo      count a number up (or down) inside an element
 *   drawIn      draw SVG strokes on, start to end
 *   revealGrid  stagger a set of elements in as a wave
 *
 * Framer Motion keeps owning component state (enter/exit, layout,
 * springs); these run on plain DOM nodes from a ref and never cause a
 * React render. Every helper resolves to its final state instantly
 * under prefers-reduced-motion and returns a function that stops it.
 * ═════════════════════════════════════════════════════════════════
 */

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const noop = () => {};

export function tickTo(el, from, to, {
  duration = 900,
  format = (v) => Math.round(v).toLocaleString(),
} = {}) {
  if (!el) return noop;
  if (reducedMotion() || from === to || !Number.isFinite(to)) {
    el.textContent = format(to);
    return noop;
  }
  const state = { v: from };
  el.textContent = format(from);
  const anim = animate(state, {
    v: to,
    duration,
    ease: 'outExpo',
    onUpdate: () => { el.textContent = format(state.v); },
  });
  return () => { anim.pause(); el.textContent = format(to); };
}

export function drawIn(targets, { duration = 1100, delay = 0 } = {}) {
  if (!targets || reducedMotion()) return noop;
  const drawables = svg.createDrawable(targets);
  const anim = animate(drawables, {
    draw: ['0 0', '0 1'],
    duration,
    delay,
    ease: 'inOutQuart',
  });
  return () => anim.pause();
}

export function revealGrid(targets, { grid, from = 'first', each = 45 } = {}) {
  if (!targets || reducedMotion()) return noop;
  // Hide synchronously so a caller in useLayoutEffect never shows one
  // frame of the finished grid before the wave starts.
  utils.set(targets, { opacity: 0, translateY: 10 });
  const anim = animate(targets, {
    opacity:    [0, 1],
    translateY: [10, 0],
    duration:   520,
    ease:       'outExpo',
    delay:      stagger(each, { grid, from }),
  });
  return () => { anim.pause(); utils.set(targets, { opacity: 1, translateY: 0 }); };
}
