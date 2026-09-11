const express = require("express");
const { db, uuid } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/opportunities — FR-03: browse/filter
router.get("/", (req, res) => {
  const { category, commitmentType, location, status } = req.query;

  let sql = "SELECT * FROM opportunities WHERE 1=1";
  const params = [];

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (commitmentType) {
    sql += " AND commitmentType = ?";
    params.push(commitmentType);
  }
  if (location) {
    sql += " AND location LIKE ?";
    params.push(`%${location}%`);
  }
  sql += " AND status = ?";
  params.push(status || "open");

  sql += " ORDER BY startDatetime ASC";

  const rows = db.prepare(sql).all(...params);
  const withCounts = rows.map((o) => ({
    ...o,
    requiresBriefing: !!o.requiresBriefing,
    approvedCount: db
      .prepare("SELECT COUNT(*) AS c FROM applications WHERE opportunityId = ? AND status = 'approved'")
      .get(o.id).c,
  }));

  res.json(withCounts);
});

// GET /api/opportunities/:id
router.get("/:id", (req, res) => {
  const o = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Opportunity not found" });

  const approvedCount = db
    .prepare("SELECT COUNT(*) AS c FROM applications WHERE opportunityId = ? AND status = 'approved'")
    .get(o.id).c;

  res.json({ ...o, requiresBriefing: !!o.requiresBriefing, approvedCount });
});

// POST /api/opportunities — FR-06 (coordinator only)
router.post("/", requireAuth, requireRole("coordinator"), (req, res) => {
  const {
    title, description, category, commitmentType, location,
    startDatetime, endDatetime, capacity, requiresBriefing,
  } = req.body;

  if (!title || !description || !category || !commitmentType || !location || !startDatetime || !endDatetime || !capacity) {
    return res.status(400).json({ error: "Missing required opportunity fields" });
  }
  if (!["ad_hoc", "recurring", "mentoring"].includes(commitmentType)) {
    return res.status(400).json({ error: "commitmentType must be ad_hoc, recurring, or mentoring" });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO opportunities
     (id, title, description, category, commitmentType, location, startDatetime, endDatetime, capacity, requiresBriefing, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, title, description, category, commitmentType, location, startDatetime, endDatetime, capacity, requiresBriefing ? 1 : 0, req.user.id);

  const created = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(id);
  res.status(201).json({ ...created, requiresBriefing: !!created.requiresBriefing });
});

// PATCH /api/opportunities/:id — coordinator only: edit/close/cancel
router.patch("/:id", requireAuth, requireRole("coordinator"), (req, res) => {
  const existing = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Opportunity not found" });
  if (existing.createdBy !== req.user.id) {
    return res.status(403).json({ error: "You can only edit opportunities you created" });
  }

  const fields = ["title", "description", "category", "commitmentType", "location", "startDatetime", "endDatetime", "capacity", "requiresBriefing", "status"];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === "requiresBriefing" ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });

  params.push(req.params.id);
  db.prepare(`UPDATE opportunities SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const updated = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(req.params.id);
  res.json({ ...updated, requiresBriefing: !!updated.requiresBriefing });
});

// POST /api/opportunities/:id/apply — FR-04 + FR-05 (volunteer only)
router.post("/:id/apply", requireAuth, requireRole("volunteer"), (req, res) => {
  const opportunity = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(req.params.id);
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
  if (opportunity.status !== "open") {
    return res.status(400).json({ error: "This opportunity is not open for applications" });
  }

  const approvedCount = db
    .prepare("SELECT COUNT(*) AS c FROM applications WHERE opportunityId = ? AND status = 'approved'")
    .get(opportunity.id).c;
  if (approvedCount >= opportunity.capacity) {
    return res.status(400).json({ error: "This opportunity is already at capacity" });
  }

  const existing = db
    .prepare("SELECT id FROM applications WHERE opportunityId = ? AND volunteerId = ?")
    .get(opportunity.id, req.user.id);
  if (existing) {
    return res.status(409).json({ error: "You have already applied to this opportunity" });
  }

  const id = uuid();
  db.prepare(
    "INSERT INTO applications (id, opportunityId, volunteerId, message, status) VALUES (?, ?, ?, ?, 'pending')"
  ).run(id, opportunity.id, req.user.id, req.body.message || null);

  const created = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
  res.status(201).json(created);
});

// GET /api/opportunities/:id/applications — coordinator only: review list
router.get("/:id/applications", requireAuth, requireRole("coordinator"), (req, res) => {
  const opportunity = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(req.params.id);
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
  if (opportunity.createdBy !== req.user.id) {
    return res.status(403).json({ error: "You can only review applications for opportunities you created" });
  }

  const rows = db
    .prepare(
      `SELECT a.*, u.name AS volunteerName, u.email AS volunteerEmail
       FROM applications a JOIN users u ON u.id = a.volunteerId
       WHERE a.opportunityId = ? ORDER BY a.createdAt ASC`
    )
    .all(opportunity.id);
  res.json(rows);
});

module.exports = router;
