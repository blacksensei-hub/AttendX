# AttendX design system: MASTER

The global source of truth for how AttendX looks, reads and moves. Page files in
`pages/` override it for one surface; when a page file exists, its rules win.
Tokens live in code (`client/src/App.css`, `client/src/lib/motion.js`); this file
records the decisions and the reasons behind them.

Direction: **Roll Call, refined** (Look A). Built with the ui-ux-pro-max design
intelligence (product match: university department, Swiss modernism, institutional
navy plus one accent; admin surfaces: data-dense dashboard) and gated by the
`no-ai-design-slop` rules from Meng To's skills.

## Visual thesis

A register, not a dashboard template. Paper, ink and one cobalt accent. The scan-frame
bracket (the corners of a QR scanner) is the one signature shape: it marks the thing on
screen that matters right now, and nothing else. Teal means *present*. Everything else
stays quiet so attendance data reads first.

## Type

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | Montserrat | 600 to 800 | Page titles, key numbers, wordmark |
| Body | Inter | 400 to 700 | Everything people read |
| Mono | JetBrains Mono | 400 to 600 | Kickers ("01 / LIVE NOW"), IDs, codes, telemetry |

- Base body 15 to 16px, line-height 1.5. Nothing people must read goes below 12px.
- Numbers in tables and KPIs use `font-variant-numeric: tabular-nums`.
- Kickers are uppercase mono with `--tracking-mono`; never more than one per block.

## Colour

Semantic tokens only, never raw hex in components.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` | #EEF1F5 paper | #070D1F night | Canvas |
| `--text-primary` | #0B1B3F ink | #EEF1F7 | Primary text |
| `--brand` | #2248FF cobalt | #3D5CFF | The one accent: primary action, current selection |
| `--green-fill` | #14C9A6 teal | #2BD9B5 | Present, live, healthy |
| `--amber-*` | | | Late, approaching a limit |
| `--red-*` | | | Absent, at risk, failure, destructive |

- One accent per view. Status colours only ever carry status, and never by colour alone
  (always a label, icon or position as well).
- Text contrast 4.5:1 minimum in both themes (3:1 for large display numbers).

## Space, shape, depth

- 4px base; spacing tokens `--space-1` to `--space-8`.
- Radius: `--radius-atomic` (controls), `--radius-molecular` (cards), `--radius-pill`.
- Depth is a hairline ring plus a barely-there drop (`--shadow-sm/md/lg`): paper on paper.
  No glow, no glass on content. Glass is reserved for chrome that floats over content
  (the pill navigation).

## Motion

Motion explains something (a state change, a cause, where a thing came from) or it
doesn't ship.

| Need | Tool | Token |
|---|---|---|
| State change, hover, press | CSS transitions | `--duration-fast/base`, `--ease-state` |
| Enter/exit, layout, shared elements, springs | Framer Motion | `EASE`, `DURATION`, `SPRING` in `lib/motion.js` |
| Number tickers, SVG line drawing, grid staggers, multi-step sequences | anime.js v4 | `lib/anime.js` helpers |

- Exits are faster than entrances. Lists stagger at most ~12 items (480ms total).
- Never animate width/height for feedback; use transform and opacity.
- `prefers-reduced-motion`: every helper resolves to the final state instantly. Nothing
  is only reachable through motion.

## Components

- **Cards** only when content is a real repeated unit or needs its own surface. Group with
  proximity before containers.
- **Tables** for anything people compare or act on in bulk: sticky header, tabular numbers,
  sortable columns where order matters, row selection only when bulk actions exist.
- **Empty, loading, error, success** states are designed for every data view.
- Icon-only buttons have an `aria-label`. Focus rings are never removed.
- Touch targets 44x44px minimum on touch layouts.

## Avoid (anti-slop gates)

- Decorative stacking: glow plus gradient plus glass doing the same job.
- Icon-heading-description tiles with interchangeable content.
- Invented metrics, sample activity or placeholder people presented as real.
- Eyebrow labels that restate the heading beneath them.
- Motion that delays access to content or moves a target under the pointer.

## Pre-delivery checklist

- [ ] No emoji as icons (Lucide only), `cursor: pointer` on everything clickable
- [ ] Hover and focus states on every interactive element, 150 to 300ms
- [ ] Contrast 4.5:1 in light and dark
- [ ] Keyboard: reachable, visible focus, Escape closes overlays
- [ ] Reduced motion respected
- [ ] 375, 768, 1024 and 1440px with no horizontal scroll
- [ ] Loading, empty and error states present
