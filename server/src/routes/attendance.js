const express = require("express");
const { db, uuid } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /api/attendance — FR-08 (coordinator only)
router.post("/", requireAuth, requireRole("coordinator"), (req, res) => {
  const { opportunityId, volunteerId, attended, hoursCompleted } = req.body;
  if (!opportunityId || !volunteerId) {
    return res.status(400).json({ error: "opportunityId and volunteerId are required" });
  }

  const opportunity = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(opportunityId);
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
  if (opportunity.createdBy !== req.user.id) {
    return res.status(403).json({ error: "You can only record attendance for opportunities you created" });
  }

  const application = db
    .prepare("SELECT * FROM applications WHERE opportunityId = ? AND volunteerId = ? AND status = 'approved'")
    .get(opportunityId, volunteerId);
  if (!application) {
    return res.status(400).json({ error: "Volunteer must have an approved application for this opportunity" });
  }

  const existing = db
    .prepare("SELECT id FROM attendance WHERE opportunityId = ? AND volunteerId = ?")
    .get(opportunityId, volunteerId);

  if (existing) {
    db.prepare(
      "UPDATE attendance SET attended = ?, hoursCompleted = ?, recordedBy = ?, recordedAt = datetime('now') WHERE id = ?"
    ).run(attended === false ? 0 : 1, hoursCompleted || 0, req.user.id, existing.id);
  } else {
    db.prepare(
      "INSERT INTO attendance (id, opportunityId, volunteerId, attended, hoursCompleted, recordedBy) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid(), opportunityId, volunteerId, attended === false ? 0 : 1, hoursCompleted || 0, req.user.id);
  }

  const record = db
    .prepare("SELECT * FROM attendance WHERE opportunityId = ? AND volunteerId = ?")
    .get(opportunityId, volunteerId);
  res.status(201).json({ ...record, attended: !!record.attended });
});

module.exports = router;
