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

- Auth: register/login, JWT, bcrypt (FR-01)
- Volunteer profile (FR-02) — API done; a dedicated profile-edit page is a good next step
- Opportunity catalogue with filtering by category/commitment type/location (FR-03)
- Apply, with duplicate-application and full-capacity checks (FR-04, FR-05)
- Coordinator: create/edit opportunities, review + approve/decline applications (FR-06, FR-07)
- Attendance recording and volunteer hours (FR-08, FR-09)
- Coordinator volunteer-hours report (FR-10)
- Role-based access control (volunteer vs coordinator) enforced server-side
- Design: warm, non-corporate palette (forest green / marigold / teal), Source Serif 4 +
  Inter, opportunity cards with a colour-coded left border by commitment type

## Not yet built (see Appendix F of the proposal for the full stretch list)

- Weighted match scoring, audit log, email notifications, certificates, admin pages
- Deployment (Vercel + Render/Railway) — see Section 14 of the proposal for the plan
- A dedicated volunteer profile-edit page in the client (API route already exists)
