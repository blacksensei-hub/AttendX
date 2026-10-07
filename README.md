# AttendX

Class attendance for GCTU that takes seconds and is hard to fake. A QR code on the projector changes every five seconds. Students scan it from their seat, and the register fills itself live on the lecturer's screen. Every scan has to come from the student's own phone, inside the classroom, while the code is still fresh.

**Live app:** [atttend-x.vercel.app](https://atttend-x.vercel.app) · **Case study:** [jeffrey-ankrah.pages.dev/projects/attendx](https://jeffrey-ankrah.pages.dev/projects/attendx/)

## What it does

AttendX has three roles, and each sees the same register differently.

- **Lecturers** open a session, or let the timetable open it, and project the rotating code. Each class has a page showing every student's rate against the minimum. Lecturers review appeals and excused absences, share a class with co-lecturers and teaching assistants, and export attendance as a grade.
- **Students** scan with the mobile app or any phone browser. They see their timetable and a planner that works out what each class still needs from the sessions left this semester. They can ask for an absence to be excused, appeal a record, and download an attendance statement.
- **Admins** get a separate console for the whole institution:
  - an audit trail of every sensitive change
  - bulk account import with emailed invites
  - a fraud review queue
  - analytics with a PDF report
  - an academic calendar, announcements and policy settings

## How a scan is checked

Every scan must pass four checks:

1. **The code is fresh.** Each QR token is single use and expires five seconds after it appears, plus a two-second grace period.
2. **The phone is in the room.** The scan carries the phone's location, and the server checks its distance from the classroom. It rejects impossible coordinates and mocked GPS on Android.
3. **The phone belongs to the student.** Each student is bound to one phone. A new phone needs an admin to reset it.
4. **One phone, one person.** If one phone marks several accounts in a session, the lecturer is told on the spot.

Refused scans are kept too. Six patterns across them raise a flag for an admin to review: one phone used by several students, a location-spoofing app, repeated scans from outside the room, repeated sign-ins from the wrong phone, several students at the exact same position, and too many phone resets. A flag never blocks anyone by itself: a person decides, and the decision is recorded in the audit trail.

## Stack

| Part | Built with |
|---|---|
| Web app (`client/`) | React, Vite, TanStack Query, Zustand, React Hook Form with Zod, Framer Motion, Leaflet, Recharts |
| Mobile app (`mobile/`) | Expo and React Native, Expo Router, camera, location, secure storage, push notifications |
| API (`server/`) | Node.js, Express, Sequelize on PostgreSQL, Socket.IO, scheduled jobs, PDF and CSV exports, calendar feeds |

## Repository layout

```
client/          web app for all three roles (deployed on Vercel)
mobile/          Expo app for students and lecturers
server/          REST and WebSocket API (deployed on Render)
  src/           routes, controllers, services, models
  sql/           schema changes, applied in date order
design-system/   design notes for the console and teaching pages
```

## Running it locally

You need Node.js 24 and PostgreSQL.

### 1. API

```bash
cd server
npm install
```

Create `server/.env`:

| Variable | What it's for |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | A local PostgreSQL database |
| `DATABASE_URL` | A hosted database such as Neon, used instead of the `DB_*` values. It always connects over SSL, so leave it unset for a local database |
| `JWT_SECRET` | Signs sign-in tokens. Any long random string |
| `JWT_EXPIRES_IN` | How long a sign-in lasts, for example `7d` |
| `CLIENT_URL` | Where the web app runs, for example `http://localhost:5173`. Used for CORS and for links in emails |
| `CLIENT_URLS` | Extra allowed web origins, comma separated (optional) |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | The Gmail account (with an app password) that sends invites, reminders and warnings |
| `PUBLIC_API_URL` | The API's public address, used in calendar feed links (optional) |
| `PORT` | Defaults to `5000` |

Create the tables once, on an empty database:

1. Start the server with `DB_BOOTSTRAP=true` in `.env`. Wait for "Tables created", then stop it and remove that line.
2. Apply each file in `server/sql/` in date order. Each one only adds what is missing, so it is safe to run again:

   ```bash
   psql "<your database>" -v ON_ERROR_STOP=1 -f sql/2026-09-27_admin_console.sql
   ```

3. Start the API with `npm run dev`.

### 2. Web app

```bash
cd client
npm install
```

Create `client/.env`:

```
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Then run `npm run dev` and open http://localhost:5173.

### 3. The first admin

Sign-up only creates student and lecturer accounts, and admins are made in the admin console, where an admin can change any account's role. To get the very first admin, sign up as a lecturer, then promote that account in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

### 4. Mobile app (optional)

```bash
cd mobile
npm install
```

Set `EXPO_PUBLIC_API_URL` to the API's address on your network, for example `http://192.168.1.20:5000/api`, since `localhost` on a phone is the phone itself. Then run `npx expo start`, or `npm run android` / `npm run ios` for a native build. Scanning needs a real phone, because of the camera, location and phone binding.

## Tests and checks

```bash
cd server && npm test               # unit tests (node:test)
cd client && npm run lint           # ESLint
cd client && npm run build          # production build
```

GitHub Actions runs all three on every pull request (`.github/workflows/ci.yml`). `main` only accepts a pull request once both the `server` and `client` jobs have passed.
