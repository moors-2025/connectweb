# PERTAPIS Volunteer Connect

An MVP build of the volunteer-management web app described in the project proposal:
volunteers discover and apply to opportunities; coordinators approve applications,
record attendance, and track hours.

This is an **academic prototype inspired by publicly available PERTAPIS information**,
not an official PERTAPIS system.

## Stack

- **Backend:** Node.js + Express, JWT auth, bcrypt password hashing
- **Frontend:** React + Vite + Tailwind CSS v4, React Router
- **Data model:** documented in `server/prisma/schema.prisma` (PostgreSQL, for deployment)

### A note on the database

`server/prisma/schema.prisma` is the source of truth for the data model and matches
Appendix A of the proposal exactly — use it with `npx prisma migrate dev` once you have
a PostgreSQL database and full internet access (e.g. on your own machine, or on
Render/Railway at deploy time).

This project was built inside a sandboxed environment that blocks Prisma's engine-binary
download, so **`server/src/db.js` implements the same schema using Node's built-in
`node:sqlite`** (zero native dependencies) so the app can actually run end-to-end here and
now. The route handlers only talk to the small helper functions in `db.js`, so swapping
that file's internals for `@prisma/client` against Postgres does not require touching any
route logic — that swap is the main remaining step before deploying for real.

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

Run the automated test suite with `npm test` (5 tests: registration, duplicate-email
rejection, the full apply → approve → attend → hours journey, RBAC enforcement, and
capacity limits).

### 2. Frontend

```bash
cd client
npm install
npm run dev    # starts the app on http://localhost:5173, proxying /api to :4000
```

Open http://localhost:5173, register a new account (or use the demo accounts above),
and try the core journey: browse opportunities → apply → (log in as the coordinator)
approve → record attendance → (back as the volunteer) see updated hours.

## What's implemented (MVP scope)

- Auth: register/login, JWT, bcrypt (FR-01), server-side email/password validation
- Volunteer profile (FR-02) — API done; a dedicated profile-edit page is a good next step
- Opportunity catalogue with filtering by category/commitment type/location (FR-03)
- Apply, with duplicate-application and full-capacity checks (FR-04, FR-05)
- Coordinator: create/edit opportunities, review + approve/decline applications (FR-06, FR-07)
- Attendance recording and volunteer hours (FR-08, FR-09)
- Coordinator reporting: per-volunteer hours, per-opportunity breakdown, org-wide summary, and CSV export (FR-10)
- Role-based access control (volunteer vs coordinator) enforced server-side
- Security hardening: Helmet HTTP headers, auth-route rate limiting, request size cap, CORS origin restriction, production JWT-secret check
- A simple SQLite backup script (`npm run backup` in `server/`)
- Design: warm, non-corporate palette (forest green / marigold / teal), Source Serif 4 +
  Inter, opportunity cards with a colour-coded left border by commitment type

## Live deployment

- API: https://pertapis-api.onrender.com
- Client: https://connectweb-j3tl.vercel.app
- The API's data layer is SQLite by default; setting `DATABASE_URL` switches it to PostgreSQL via Prisma automatically (see "PostgreSQL migration" below). Check `/api/health` — it reports `dataLayer: "sqlite"` or `"postgres"`.

## PostgreSQL migration (optional)

The app defaults to the SQLite implementation (`server/src/db.js`, routes in `server/src/routes/`) because this project's build sandbox blocks Prisma's engine-binary download. A complete, parallel PostgreSQL implementation exists in `server/src/routes-prisma/` and `server/src/prisma-client.js`, and is used automatically whenever `DATABASE_URL` is set — nothing about the default SQLite path changes otherwise.

To switch the live deployment over:
1. Create a Render PostgreSQL database (free tier expires 30 days after creation — fine for a demo, not for anything longer-lived).
2. Set `DATABASE_URL` on the web service to its Internal Database URL.
3. Change the Build Command to `npm install && npx prisma generate && npx prisma db push` (not `migrate deploy` — there are no migration files yet, `db push` syncs the schema directly).
4. Change the Start Command to `npm run seed:postgres && npm start`.
5. Redeploy and check `/api/health` for `"dataLayer":"postgres"`.

This Prisma code was written carefully against the same schema and business logic as the proven SQLite version, but **could not be executed or tested in the build sandbox** — verify it in a real deployment (where Prisma's binaries download normally) before relying on it.

## Testing

- Backend: `npm test` in `server/` — 10 tests (unit + API), all passing.
- Frontend accessibility: `npm test` in `client/` — jest-axe against StatusBadge, Skeleton, OpportunityCard, Home, Login, and Register (6 tests, all passing; this run already caught and fixed two real unlabeled-input bugs on Login and Register).
- End-to-end: `npm run test:e2e` in `client/` (Playwright) — written and runs in CI (`.github/workflows/ci.yml`); could not be executed in the build sandbox (headless browser downloads are blocked there too).

## Not yet built

- Azure AD / SSO login — deliberately not attempted; see the report's Limitations section for why
- Weighted match scoring, audit log, email notifications, certificates, admin pages
- Real-world verification of the Playwright suite and the PostgreSQL migration (both written, neither executable in the build sandbox)