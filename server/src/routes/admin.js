const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runBackup } = require("../backupUtil");

const router = express.Router();

// GET /api/admin/overview — admin only: read-only system-wide counts.
// Deliberately basic and read-only: no user create/modify/disable here yet
// (Appendix F, Stretch Goals — that needs a soft-delete/disable flag and an
// ownership-transfer action before it's safe to build, not just a route).
router.get("/overview", requireAuth, requireRole("admin"), (req, res) => {
  const usersByRole = db
    .prepare("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
    .all();

  const opportunitiesByStatus = db
    .prepare("SELECT status, COUNT(*) AS count FROM opportunities GROUP BY status")
    .all();

  const applicationsByStatus = db
    .prepare("SELECT status, COUNT(*) AS count FROM applications GROUP BY status")
    .all();

  const attendanceSummary = db
    .prepare(
      "SELECT COUNT(*) AS records, COALESCE(SUM(hoursCompleted), 0) AS totalHours FROM attendance WHERE attended = 1"
    )
    .get();

  res.json({
    usersByRole,
    opportunitiesByStatus,
    applicationsByStatus,
    attendance: attendanceSummary,
    generatedAt: new Date().toISOString(),
  });
});

// POST /api/admin/backup — admin only: triggers the same backup logic as
// `npm run backup` (Appendix L), through a button rather than shell access.
router.post("/backup", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const { destination, pruned } = runBackup();
    res.json({ ok: true, destination, pruned, ranAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reindex — admin only: rebuilds all SQLite indexes. A basic
// prototype of the "database index review" stretch goal (Appendix F) — this
// runs SQLite's own REINDEX rather than a tuned indexing strategy, which
// only becomes worth building once real data volume justifies it.
router.post("/reindex", requireAuth, requireRole("admin"), (req, res) => {
  try {
    db.exec("REINDEX;");
    res.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
