const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, applicationPatchSchema } = require("../validation");

const router = express.Router();

// PATCH /api/applications/:id — FR-07 (coordinator only: approve or decline)
// Also enforces BR4: an opportunity that requiresBriefing cannot be approved
// until briefingConfirmed is true, either already set or included in this request.
router.patch("/:id", requireAuth, requireRole("coordinator"), validate(applicationPatchSchema), (req, res) => {
  const { status, briefingConfirmed } = req.body;

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

    // BR4 enforcement: a briefing-required opportunity cannot be approved
    // until the briefing is explicitly confirmed — this is a hard rule, not
    // just a displayed flag (see Section 4.6, Limitations — now resolved).
    const alreadyConfirmed = !!application.briefingConfirmed;
    if (opportunity.requiresBriefing && !alreadyConfirmed && briefingConfirmed !== true) {
      return res.status(400).json({
        error: "This opportunity requires a confirmed briefing before approval. Include briefingConfirmed: true once the volunteer has attended the briefing.",
      });
    }
  }

  if (briefingConfirmed === true) {
    db.prepare("UPDATE applications SET briefingConfirmed = 1 WHERE id = ?").run(req.params.id);
  }

  db.prepare(
    "UPDATE applications SET status = ?, reviewedBy = ?, reviewedAt = datetime('now') WHERE id = ?"
  ).run(status, req.user.id, req.params.id);

  const updated = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  res.json({ ...updated, briefingConfirmed: !!updated.briefingConfirmed });
});

module.exports = router;
