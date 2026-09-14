const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, profileUpdateSchema } = require("../validation");

const router = express.Router();

// GET /api/volunteers/me/profile — FR-02
router.get("/me/profile", requireAuth, requireRole("volunteer"), (req, res) => {
  const profile = db.prepare("SELECT * FROM volunteer_profiles WHERE userId = ?").get(req.user.id);
  res.json(profile || null);
});

// PATCH /api/volunteers/me/profile — FR-02
router.patch("/me/profile", requireAuth, requireRole("volunteer"), validate(profileUpdateSchema), (req, res) => {
  const { skills, interests, availability, preferredLocations, commitmentPreference } = req.body;
  const fields = { skills, interests, availability, preferredLocations, commitmentPreference };
  const updates = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      updates.push(`${k} = ?`);
      params.push(v);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });

  params.push(req.user.id);
  db.prepare(`UPDATE volunteer_profiles SET ${updates.join(", ")} WHERE userId = ?`).run(...params);

  const updated = db.prepare("SELECT * FROM volunteer_profiles WHERE userId = ?").get(req.user.id);
  res.json(updated);
});

// GET /api/volunteers/me/schedule — FR-09: confirmed (approved) upcoming opportunities
router.get("/me/schedule", requireAuth, requireRole("volunteer"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, a.status AS applicationStatus
       FROM applications a JOIN opportunities o ON o.id = a.opportunityId
       WHERE a.volunteerId = ? AND a.status = 'approved'
       ORDER BY o.startDatetime ASC`
    )
    .all(req.user.id);
  res.json(rows.map((r) => ({ ...r, requiresBriefing: !!r.requiresBriefing })));
});

// GET /api/volunteers/me/applications — all applications regardless of status
router.get("/me/applications", requireAuth, requireRole("volunteer"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, o.title, o.startDatetime, o.location
       FROM applications a JOIN opportunities o ON o.id = a.opportunityId
       WHERE a.volunteerId = ? ORDER BY a.createdAt DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// GET /api/volunteers/me/hours — FR-09
router.get("/me/hours", requireAuth, requireRole("volunteer"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.title, o.startDatetime, at.hoursCompleted, at.attended
       FROM attendance at JOIN opportunities o ON o.id = at.opportunityId
       WHERE at.volunteerId = ? ORDER BY o.startDatetime DESC`
    )
    .all(req.user.id);

  const totalHours = rows.reduce((sum, r) => sum + (r.attended ? r.hoursCompleted : 0), 0);
  res.json({ totalHours, records: rows.map((r) => ({ ...r, attended: !!r.attended })) });
});

module.exports = router;
