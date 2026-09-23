# PERTAPIS Volunteer Connect

A build of the volunteer-management web app described in the project proposal:
volunteers discover and apply to opportunities; coordinators approve applications,
record attendance, and track hours; an admin role manages users and reviews an
audit trail of admin actions.

This is an **academic prototype inspired by publicly available PERTAPIS information**,
not an official PERTAPIS system.

## Stack

- **Backend:** Node.js + Express, JWT auth (httpOnly cookie, with Authorization-header
  fallback for non-browser clients and tests), bcrypt password hashing
- **Frontend:** React + Vite + Tailwind CSS v4, React Router
- **Data model:** six tables (five core + `audit_log`), documented in
  `server/src/db.js` (SQLite, the default) and `server/prisma/schema.prisma`
  (PostgreSQL, for the optional migration below)

### A note on the database

`server/src/db.js` implements the five core tables plus `audit_log` using Node's
built-in `node:sqlite` (zero native dependencies), and is what actually runs in the
live deployment today. A parallel, hand-written PostgreSQL implementation exists in
`server/prisma/schema.prisma` and `server/src/routes-prisma/`, activated automatically
whenever `DATABASE_URL` is set. It was written against this project's build sandbox,
which blocks Prisma's engine-binary download, so it has not been exercised against a
real Postgres database — see "PostgreSQL migration" below. It also does not yet cover
the admin routes or the `audit_log` table, which remain SQLite-only.

## Running locally

### 1. Backend

```bash
cd server
npm install
npm run seed   # creates demo accounts + sample opportunities
npm run dev    # starts the API on http://localhost:4000
```

Demo accounts (seeded):

| Role | Email | Password |
|---|---|---|
| Volunteer | mei@example.com | password123 |
| Coordinator | ali@example.com | password123 |
| Admin | admin@example.com | password123 |

Run the automated test suite with `npm test` (28 tests: registration, duplicate-email
rejection, the full apply → approve → attend → hours journey, RBAC enforcement,
capacity limits, malformed-input rejection, CSV export and its RBAC, full admin user
management with its audit trail, the concurrent-approval race-condition fix, the
cookie-based auth flow, and CORS credential safety).

### 2. Frontend

```bash
cd client
npm install
npm run dev    # starts the app on http://localhost:5173, proxying /api to :4000
```

Open http://localhost:5173, register a new account (or use the demo accounts above),
and try the core journey: browse opportunities → apply → (log in as the coordinator)
approve → record attendance → (back as the volunteer) see updated hours.

## What's implemented

- Auth: register/login, JWT via httpOnly cookie, bcrypt (FR-01), server-side email/password validation
- Volunteer profile (FR-02)
- Opportunity catalogue with filtering by category/commitment type/location (FR-03)
- Apply, with duplicate-application and full-capacity checks (FR-04, FR-05)
- Coordinator: create/edit opportunities, review + approve/decline applications (FR-06, FR-07)
- Attendance recording and volunteer hours (FR-08, FR-09)
- Coordinator reporting: per-volunteer hours, per-opportunity breakdown, org-wide summary, and CSV export (FR-10)
- Role-based access control (volunteer / coordinator / admin) enforced server-side
- Admin: read-only system overview, database backup/reindex, full user lifecycle
  (list/filter, create, edit, disable/enable, ownership transfer), and an audit trail
  of admin actions with before/after details
- Certificate download: a generated PDF certificate once a volunteer's hours are recorded
- Security hardening: Helmet HTTP headers, auth-route rate limiting, request size cap,
  CORS origin restriction, production JWT-secret check
- A simple SQLite backup script (`npm run backup` in `server/`)
- Design: warm, non-corporate palette (forest green / marigold / teal), Source Serif 4 +
  Inter, opportunity cards with a colour-coded left border by commitment type

## Live deployment

- API: https://pertapis-api.onrender.com
- Client: https://connectweb-j3tl.vercel.app
- The API's data layer is SQLite by default; setting `DATABASE_URL` switches it to PostgreSQL via Prisma automatically (see "PostgreSQL migration" below). Check `/api/health` — it reports `dataLayer: "sqlite"` or `"postgres"`.
- Render's free tier spins down after inactivity and doesn't persist local disk across restarts, so session data resets to the seeded demo state on the next cold start — a free-tier hosting limitation, not a SQLite one.

## PostgreSQL migration (optional)

The app defaults to the SQLite implementation (`server/src/db.js`, routes in `server/src/routes/`) because this project's build sandbox blocks Prisma's engine-binary download. A parallel PostgreSQL implementation exists in `server/src/routes-prisma/` and `server/src/prisma-client.js` for the core volunteer/coordinator routes, and is used automatically whenever `DATABASE_URL` is set — nothing about the default SQLite path changes otherwise. The admin routes and `audit_log` table are not part of this migration yet and remain SQLite-only either way.

To switch the live deployment over:
1. Create a Render PostgreSQL database (free tier expires 30 days after creation — fine for a demo, not for anything longer-lived).
2. Set `DATABASE_URL` on the web service to its Internal Database URL.
3. Change the Build Command to `npm install && npx prisma generate && npx prisma db push` (not `migrate deploy` — there are no migration files yet, `db push` syncs the schema directly).
4. Change the Start Command to `npm run seed:postgres && npm start`.
5. Redeploy and check `/api/health` for `"dataLayer":"postgres"`.

This Prisma code was written carefully against the same schema and business logic as the proven SQLite version for the core routes, but **could not be executed or tested in the build sandbox** — verify it in a real deployment (where Prisma's binaries download normally) before relying on it.

## Testing

- Backend: `npm test` in `server/` — 28 tests (unit + API), all passing.
- Frontend: `npm test` in `client/` — 14 tests: 6 jest-axe accessibility checks against
  StatusBadge, Skeleton, OpportunityCard, Home, Login, and Register (this run already
  caught and fixed two real unlabeled-input bugs on Login and Register), plus 8
  Vitest unit/component tests. All passing.
- End-to-end: `npm run test:e2e` in `client/` (Playwright) — written, wired into CI
  (`.github/workflows/ci.yml`), and has since been executed for real there, passing
  across all three scenarios after two rounds of hardening.

## Not yet built

- Azure AD / SSO login — deliberately not attempted; see the report's Limitations section for why
- Weighted match scoring and email notifications (the rest of the original "Could" cluster)
- Monitoring, centralised logging, or a disaster-recovery plan beyond the SQLite file backups
- Real-world verification of the PostgreSQL migration for the core routes, and of the
  admin/`audit_log` path on Postgres at all (both written, neither executable in the
  build sandbox)
