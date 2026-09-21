const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runBackup } = require("../backupUtil");
const { validate, adminUserPatchSchema, adminTransferOwnershipSchema } = require("../validation");

const router = express.Router();

// GET /api/admin/overview — admin only: read-only system-wide counts.
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

// GET /api/admin/users — admin only: list users for the user-management table.
// Supports ?role=volunteer|coordinator|admin, ?active=true|false, and ?q=<search
// on name/email>, all optional and combinable. Each row includes ownedCount — the
// number of opportunities the user created — since that count gates disabling
// (see PATCH /users/:id below) and is what "reassign ownership" moves.
router.get("/users", requireAuth, requireRole("admin"), (req, res) => {
  const { role, active, q } = req.query;
  const clauses = [];
  const params = [];

  if (role) {
    clauses.push("u.role = ?");
    params.push(role);
  }
  if (active === "true" || active === "false") {
    clauses.push("u.active = ?");
    params.push(active === "true" ? 1 : 0);
  }
  if (q) {
    clauses.push("(u.name LIKE ? OR u.email LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.createdAt,
              (SELECT COUNT(*) FROM opportunities o WHERE o.createdBy = u.id) AS ownedCount
       FROM users u
       ${where}
       ORDER BY u.createdAt DESC`
    )
    .all(...params);

  res.json(users.map((u) => ({ ...u, active: !!u.active })));
});

// PATCH /api/admin/users/:id — admin only: enable or disable a user account.
// Two safeguards, both returned as 400s rather than allowed silently:
//   - an admin can't disable their own account (avoids locking yourself out);
//   - a coordinator/admin who still owns opportunities can't be disabled until
//     those opportunities are reassigned via the transfer-ownership route below
//     — disabling first would leave orphaned "createdBy" references live in the
//     app with no one able to manage them.
// Re-enabling has no such restriction. Note (MVP limitation, stated plainly
// rather than glossed over): a JWT already issued to a disabled user stays
// valid until it expires (up to 7 days) — requireAuth doesn't re-check the
// database per request. Only new login attempts are blocked immediately
// (see routes/auth.js). Closing that gap needs session/token revocation,
// which is out of scope for this MVP (Appendix F).
router.patch("/users/:id", requireAuth, requireRole("admin"), validate(adminUserPatchSchema), (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!active) {
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot disable your own account" });
    }
    const owned = db
      .prepare("SELECT COUNT(*) AS count FROM opportunities WHERE createdBy = ?")
      .get(id).count;
    if (owned > 0) {
      return res.status(400).json({
        error: `Transfer ownership of ${owned} opportunit${owned === 1 ? "y" : "ies"} before disabling this user`,
        ownedCount: owned,
      });
    }
  }

  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  const updated = db.prepare("SELECT id, name, email, role, active, createdAt FROM users WHERE id = ?").get(id);
  res.json({ ...updated, active: !!updated.active });
});

// POST /api/admin/users/:id/transfer-ownership — admin only: reassigns every
// opportunity `:id` created to `newOwnerId`. The new owner must be an existing,
// active coordinator or admin (a volunteer can't own opportunities, and moving
// work onto a disabled account would just recreate the same problem). This is
// the step that unblocks disabling a coordinator with existing opportunities.
router.post(
  "/users/:id/transfer-ownership",
  requireAuth,
  requireRole("admin"),
  validate(adminTransferOwnershipSchema),
  (req, res) => {
    const { id } = req.params;
    const { newOwnerId } = req.body;

    if (newOwnerId === id) {
      return res.status(400).json({ error: "New owner must be a different user" });
    }

    const source = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!source) return res.status(404).json({ error: "User not found" });

    const newOwner = db.prepare("SELECT * FROM users WHERE id = ?").get(newOwnerId);
    if (!newOwner) return res.status(404).json({ error: "New owner not found" });
    if (!newOwner.active) {
      return res.status(400).json({ error: "New owner must be an active account" });
    }
    if (!["coordinator", "admin"].includes(newOwner.role)) {
      return res.status(400).json({ error: "New owner must be a coordinator or admin" });
    }

    const result = db
      .prepare("UPDATE opportunities SET createdBy = ? WHERE createdBy = ?")
      .run(newOwnerId, id);

    res.json({ ok: true, reassigned: result.changes, newOwnerId });
  }
);

module.exports = router;
