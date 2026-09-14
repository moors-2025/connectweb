const express = require("express");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, applicationPatchSchema } = require("../validation");

const router = express.Router();

router.patch("/:id", requireAuth, requireRole("coordinator"), validate(applicationPatchSchema), async (req, res, next) => {
  try {
    const { status, briefingConfirmed } = req.body;

    const application = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: "Application not found" });

    const opportunity = await prisma.opportunity.findUnique({ where: { id: application.opportunityId } });
    if (opportunity.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only review applications for opportunities you created" });
    }

    if (status === "approved") {
      const approvedCount = await prisma.application.count({
        where: { opportunityId: opportunity.id, status: "approved" },
      });
      if (approvedCount >= opportunity.capacity) {
        return res.status(400).json({ error: "This opportunity is already at capacity" });
      }

      // BR4: same hard rule as the SQLite path — see server/src/routes/applications.js
      const alreadyConfirmed = application.briefingConfirmed;
      if (opportunity.requiresBriefing && !alreadyConfirmed && briefingConfirmed !== true) {
        return res.status(400).json({
          error: "This opportunity requires a confirmed briefing before approval. Include briefingConfirmed: true once the volunteer has attended the briefing.",
        });
      }
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        ...(briefingConfirmed === true ? { briefingConfirmed: true } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
