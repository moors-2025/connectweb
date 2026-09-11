const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// PATCH /api/applications/:id — FR-07 (coordinator only: approve or decline)
router.patch("/:id", requireAuth, requireRole("coordinator"), (req, res) => {
  const { status } = req.body;
  if (!["approved", "declined"].includes(status)) {
    return res.status(400).json({ error: "status must be approved or declined" });
  }

  const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  if (!application) return res.status(404).json({ error: "Application not found" });

  const opportunity = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(application.opportunityId);
  if (opportunity.createdBy !== req.user.id) {
    return res.status(403).json({ error: "You can only review applications for opportunities you created" });
  }

  if (status === "approved") {
    const approvedCount = db
      .prepare("SELECT COUNT(*) AS c FROM applications WHERE opportunityId = ? AND status = 'approved'")
      .get(opportunity.id).c;
    if (approvedCount >= opportunity.capacity) {
      return res.status(400).json({ error: "This opportunity is already at capacity" });
    }
  }

  db.prepare(
    "UPDATE applications SET status = ?, reviewedBy = ?, reviewedAt = datetime('now') WHERE id = ?"
  ).run(status, req.user.id, req.params.id);

  const updated = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  res.json(updated);
});

module.exports = router;
