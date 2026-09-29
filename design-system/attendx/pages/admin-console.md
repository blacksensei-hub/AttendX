# Page override: admin console (Look B, "control room")

Overrides `../MASTER.md` for every `/admin` screen. Anything not mentioned here follows
MASTER.

## Why a different look

Lecturers and students glance at AttendX between classes. Admins run it: they watch live
sessions, review evidence and change policy. The console is a place to work for long
stretches, so it trades the paper warmth of Roll Call for an operations room: darker,
denser, more precise. Same brand (ink, cobalt, teal, scan-frame corners), different posture.

## Theme

- **Dark by default** (the "console theme", stored separately from the rest of the app).
  Admins can switch it to the refined light look; lecturer and student pages are unaffected.
- Dark console surfaces sit a step deeper than the app's dark theme:
  canvas `#050A18`, panels `#0A1226`, raised `#101A33`, hairlines `rgba(160,180,255,0.10)`.
- A faint 32px grid under the canvas is the only background texture, masked out toward the
  bottom. It must stay under 5% contrast.

## Density

ui-ux-pro-max density dial 7: 8 to 32px spacing scale, 36 to 40px table rows, 12px panel
gaps on desktop.

## Panels

- Framed panel: 1px hairline, `--radius-molecular`, two corner ticks (top-left and
  bottom-right) in `--panel-tick`, the scan-frame signature at console scale.
- Header row: mono label on the left (what it is), actions on the right. No eyebrow above a
  heading that already says the same thing.

## Telemetry

- Live values carry a teal dot and the time they were last updated; a value that stopped
  updating says so (stale state), never keeps pretending to be live.
- The operations wall shows class names and counts only, never student names: it is built
  for a projector.

## Navigation

The pill top bar stays, with the admin's pages grouped into menus: Overview, People,
Teaching, Insight, Trust, Comms, System. The command palette (Ctrl/Cmd+K) reaches every page,
user, class and session, and runs common actions.

## Motion

- Key numbers count up once on first load (anime.js), not on every refetch.
- Trend lines draw in once (anime.js), then update in place.
- Panels enter with a short grid stagger (<= 480ms total). Tables do not animate rows after
  the first load: people read tables, they don't watch them.
