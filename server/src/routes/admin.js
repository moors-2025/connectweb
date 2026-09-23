const express = require("express");
const bcrypt = require("bcryptjs");
const { db, uuid } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runBackup } = require("../backupUtil");
const {
  validate,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  adminTransferOwnershipSchema,
} = require("../validation");

const router = express.Router();

// Records one row in audit_log per admin action (Table 27's "audit trail of
// admin actions" — the other half of the Real-World Production Version item
// this feature answers, alongside user create/edit below). Called from every
// mutating route in this file, including read-only-looking ones like backup
// and reindex, since those change system state just as much as a user edit
// does. `details` is arbitrary JSON (e.g. before/after values) — always an
// object or null, never a bare string, so JSON.parse on read is symmetric.
function logAudit({ actorId, action, targetType, targetId = null, details = null }) {
  db.prepare(
    "INSERT INTO audit_log (id, actorId, action, targetType, targetId, details) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(uuid(), actorId, action, targetType, targetId, details ? JSON.stringify(details) : null);
}

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
    logAudit({ actorId: req.user.id, action: "backup.run", targetType: "system", details: { destination, pruned } });
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
    logAudit({ actorId: req.user.id, action: "reindex.run", targetType: "system" });
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

// POST /api/admin/users — admin only: create a user directly, without the
// self-registration flow (FR-01). This is the first half of Table 27's
// deferred "Roles" item ("A full admin GUI for creating and editing users
// directly ... not just enabling/disabling existing ones"). Reuses the same
// bcrypt hashing as /api/auth/register, but — unlike registration — role is
// required and may be "admin": an admin creating another admin is a
// deliberate, logged act (see logAudit below), not a gap to guard against.
router.post("/users", requireAuth, requireRole("admin"), validate(adminUserCreateSchema), (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, email, passwordHash, role);
  if (role === "volunteer") {
    db.prepare("INSERT INTO volunteer_profiles (id, userId) VALUES (?, ?)").run(uuid(), id);
  }

  logAudit({
    actorId: req.user.id,
    action: "user.create",
    targetType: "user",
    targetId: id,
    details: { name, email, role },
  });

  const created = db
    .prepare("SELECT id, name, email, role, active, createdAt FROM users WHERE id = ?")
    .get(id);
  res.status(201).json({ ...created, active: !!created.active, ownedCount: 0 });
});

// PATCH /api/admin/users/:id — admin only: enable/disable a user account, or
// (the second half of Table 27's "Roles" item) edit their name, email, role,
// or reset their password directly — any subset of these in one call. Every
// field is optional (adminUserUpdateSchema requires at least one), so this is
// still the same endpoint the earlier active-only tests exercise, extended
// rather than replaced. Safeguards, all returned as 400s rather than allowed
// silently:
//   - an admin can't disable their own account, or change their own role away
//     from admin (both are the same lockout risk — you'd have no way back in);
//   - a coordinator/admin who still owns opportunities can't be disabled, nor
//     have their role changed away from coordinator/admin, until those
//     opportunities are reassigned via the transfer-ownership route below —
//     either change would leave orphaned "createdBy" references live in the
//     app with no one able to manage them;
//   - an email being changed must not collide with a different existing user.
// Re-enabling, and editing name/email/password alone, have no such
// restriction. Note (MVP limitation, stated plainly rather than glossed
// over): a JWT already issued before this call stays valid until it expires
// (up to 7 days) — requireAuth doesn't re-check the database per request, and
// a changed password or role doesn't invalidate an already-issued token. Only
// new login attempts see the change immediately (see routes/auth.js). Closing
// that gap needs session/token revocation, out of scope for this MVP
// (Appendix F).
router.patch("/users/:id", requireAuth, requireRole("admin"), validate(adminUserUpdateSchema), (req, res) => {
  const { id } = req.params;
  const { active, name, email, role, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const owningRoles = ["coordinator", "admin"];
  const ownedCount = () =>
    db.prepare("SELECT COUNT(*) AS count FROM opportunities WHERE createdBy = ?").get(id).count;

  if (active === false) {
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot disable your own account" });
    }
    const owned = ownedCount();
    if (owned > 0) {
      return res.status(400).json({
        error: `Transfer ownership of ${owned} opportunit${owned === 1 ? "y" : "ies"} before disabling this user`,
        ownedCount: owned,
      });
    }
  }

  if (role && owningRoles.includes(user.role) && !owningRoles.includes(role)) {
    const owned = ownedCount();
    if (owned > 0) {
      return res.status(400).json({
        error: `Transfer ownership of ${owned} opportunit${owned === 1 ? "y" : "ies"} before changing this user's role`,
        ownedCount: owned,
      });
    }
  }

  if (role && role !== "admin" && id === req.user.id) {
    return res.status(400).json({ error: "You cannot change your own role away from admin" });
  }

  if (email && email !== user.email) {
    const emailTaken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, id);
    if (emailTaken) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
  }

  const before = { name: user.name, email: user.email, role: user.role, active: !!user.active };

  const sets = [];
  const params = [];
  if (active !== undefined) {
    sets.push("active = ?");
    params.push(active ? 1 : 0);
  }
  if (name !== undefined) {
    sets.push("name = ?");
    params.push(name);
  }
  if (email !== undefined) {
    sets.push("email = ?");
    params.push(email);
  }
  if (role !== undefined) {
    sets.push("role = ?");
    params.push(role);
  }
  if (password !== undefined) {
    sets.push("passwordHash = ?");
    params.push(bcrypt.hashSync(password, 10));
  }
  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  // A role change to volunteer needs the same profile row registration
  // creates (routes/auth.js) — one wasn't made when this user first joined
  // as a coordinator/admin.
  if (role === "volunteer") {
    const hasProfile = db.prepare("SELECT id FROM volunteer_profiles WHERE userId = ?").get(id);
    if (!hasProfile) {
      db.prepare("INSERT INTO volunteer_profiles (id, userId) VALUES (?, ?)").run(uuid(), id);
    }
  }

  const updated = db
    .prepare("SELECT id, name, email, role, active, createdAt FROM users WHERE id = ?")
    .get(id);

  const action = active === false ? "user.disable" : active === true ? "user.enable" : "user.update";
  logAudit({
    actorId: req.user.id,
    action,
    targetType: "user",
    targetId: id,
    details: {
      before,
      after: { name: updated.name, email: updated.email, role: updated.role, active: !!updated.active },
      passwordChanged: password !== undefined,
    },
  });

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

    logAudit({
      actorId: req.user.id,
      action: "ownership.transfer",
      targetType: "user",
      targetId: id,
      details: { newOwnerId, reassigned: result.changes },
    });

    res.json({ ok: true, reassigned: result.changes, newOwnerId });
  }
);

// GET /api/admin/audit-log — admin only: read-only log of admin actions
// (Table 27's "audit trail of admin actions"). Supports ?action=<exact action
// string, e.g. "user.update"> and ?actorId=<user id>, both optional and
// combinable, plus ?limit (default 100, capped at 500 so a mistaken large
// value can't return the entire table). Newest first. `details` is stored as
// a JSON string (see logAudit above) and parsed back here so API consumers
// get a real object, not an escaped string.
router.get("/audit-log", requireAuth, requireRole("admin"), (req, res) => {
  const { action, actorId, limit } = req.query;
  const clauses = [];
  const params = [];

  if (action) {
    clauses.push("a.action = ?");
    params.push(action);
  }
  if (actorId) {
    clauses.push("a.actorId = ?");
    params.push(actorId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const cap = Math.min(parseInt(limit, 10) || 100, 500);

  const rows = db
    .prepare(
      `SELECT a.id, a.action, a.targetType, a.targetId, a.details, a.createdAt,
              u.name AS actorName, u.email AS actorEmail
       FROM audit_log a
       JOIN users u ON u.id = a.actorId
       ${where}
       ORDER BY a.createdAt DESC, a.id DESC
       LIMIT ?`
    )
    .all(...params, cap);

  res.json(rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })));
});

module.exports = router;
