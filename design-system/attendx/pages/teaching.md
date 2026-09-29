# Page override: lecturer and student pages (Look A, "Roll Call, refined")

Applies to every `/lecturer` and `/student` screen. Anything not mentioned here follows
`../MASTER.md`. Styles: `client/src/components/teaching/teaching.css`, on top of the shared
kit in `client/src/components/console/` (panels, tables, tabs, drawers, dialogs).

## Posture

Lecturers and students open AttendX between classes, often on a phone. Each page answers one
question first, in the display headline ("Your week.", "Every session.", "3 to review."), then
gives the numbers that back it up, then the detail. Pages follow the user's own light or dark
theme; the control-room palette stays in the admin console.

## Page opener

- `PageHeader`: mono kicker with the path ("Lecturer / Timetable"), a display title with one
  cobalt accent word, a one-line lede that says what to do here, actions on the right.
- The actions wrap under the title below 320px of text width instead of squeezing it.
- Greetings use `shortName()`: a title stays with the surname ("Dr. Boateng"), never "Dr.".

## Status colour

Fixed across the app, and always paired with a word, letter or position:

| Status | Colour | Where |
|---|---|---|
| Present | teal `--green-fill` | register squares, pills, meters at or above the minimum |
| Late | amber `--amber-fill` | also meters within 5 points under the minimum |
| Excused | violet `--violet` | only ever set by a lecturer; counts towards the minimum |
| Absent | red ring / `--red` | an outline, not a fill, so a bad run reads as empty seats |

## Signature pieces

- **Register strip**: one square per session, oldest on the left, like a paper register.
  Small and static in tables (a class can have hundreds); large, lettered and waved in with
  anime.js on a student's page.
- **Rate meter**: the rate, a bar that grows in (Framer Motion), and a tick at the class
  minimum. Never a bare percentage.
- **Week timetable**: day-by-hour grid on wide screens, a day list on phones. A slot's coloured
  edge says what happened (teal held or live, red no session, amber holiday, cobalt still to
  come); blocked days are hatched; a red line marks now.
- **Planner**: "what it takes" as a sentence first ("You can miss up to 4 of the 10 left"),
  then a slider to try "if I miss N". The finishing rate counts with anime.js.
- **Projector**: always dark, counts only (never names), readable from the back row, F for full
  screen and Esc to leave.
- The scan-frame corners mark the one number a page is about (the featured tile) or a live
  session, nothing else.

## Tables and review

- Registers, sessions, requests and grades are tables (`DataTable`): sortable where order
  matters, a row opens the detail, a search and a segmented filter above.
- Requests open in a side drawer with everything needed to decide, the effect of approving
  ("2 absences become excused"), and the decision buttons in the footer. Declining an excuse
  needs a note for the student.
- Destructive actions (delete a class, a report, a timetable slot, leave a class) always go
  through `ConfirmDialog`, never the browser's `confirm()`.

## Roles on a shared class

The owner sees everything. A co-lecturer or teaching assistant sees a violet role chip and
only the controls their role allows; controls they can't use are absent, not disabled.

## Motion

- Page panels enter once; key numbers count up once (anime.js), not on every refetch.
- The week's slots wave in when the week changes; the drill-down register waves in once.
- Everything resolves instantly under `prefers-reduced-motion`.
