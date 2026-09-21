require("dotenv").config({ quiet: true }); // suppresses dotenv's promotional stdout banner
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const opportunityRoutes = require("./routes/opportunities");
const applicationRoutes = require("./routes/applications");
const attendanceRoutes = require("./routes/attendance");
const volunteerRoutes = require("./routes/volunteers");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin"); // overview + backup/reindex + user list/disable/transfer-ownership; full user creation/editing pages remain Appendix F

// If DATABASE_URL is set, use the PostgreSQL/Prisma route implementations
// instead of the default SQLite ones (see Appendix L: Postgres Migration).
// This is additive — nothing changes for the existing, verified SQLite path
// unless DATABASE_URL is explicitly present.
const usingPostgres = !!process.env.DATABASE_URL;
const routes = usingPostgres
  ? {
      auth: require("./routes-prisma/auth"),
      opportunities: require("./routes-prisma/opportunities"),
      applications: require("./routes-prisma/applications"),
      attendance: require("./routes-prisma/attendance"),
      volunteers: require("./routes-prisma/volunteers"),
      reports: require("./routes-prisma/reports"),
      // admin: intentionally omitted under Postgres for now — the basic admin
      // report queries the SQLite `db` module directly; a Prisma equivalent
      // is a small, later addition, not built here to avoid an untestable stub.
    }
  : {
      auth: authRoutes,
      opportunities: opportunityRoutes,
      applications: applicationRoutes,
      attendance: attendanceRoutes,
      volunteers: volunteerRoutes,
      reports: reportRoutes,
      admin: adminRoutes,
    };

const app = express();

// --- Security hardening (NFR: Security) ---
app.use(helmet());

// Restrict CORS to a configured origin in production; permissive in dev so the
// Vite dev server (a different port) still works without extra setup.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : {}));

// Cap request body size to reduce large-payload DoS surface.
app.use(express.json({ limit: "100kb" }));

// Refuse to boot with the insecure default JWT secret outside development.
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-me")) {
  console.error("Refusing to start: JWT_SECRET is missing or using the insecure default in production.");
  process.exit(1);
}

// Rate-limit auth endpoints specifically: the highest-value target for brute-force/credential-stuffing.
// Skipped under the test runner: the suite creates dozens of users per run (test/api.test.js),
// which would otherwise trip this limiter well before 20 real login attempts ever happened —
// a test-harness artifact, not something the limiter is meant to catch.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many auth attempts, please try again later." },
});
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => res.json({ ok: true, dataLayer: usingPostgres ? "postgres" : "sqlite" }));

app.use("/api/auth", routes.auth);
app.use("/api/opportunities", routes.opportunities);
app.use("/api/applications", routes.applications);
app.use("/api/attendance", routes.attendance);
app.use("/api/volunteers", routes.volunteers);
app.use("/api/reports", routes.reports);
if (routes.admin) app.use("/api/admin", routes.admin);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`PERTAPIS Volunteer Connect API listening on :${PORT}`));
}

module.exports = app;
