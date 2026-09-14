const express = require("express");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, attendanceSchema } = require("../validation");

const router = express.Router();

router.post("/", requireAuth, requireRole("coordinator"), validate(attendanceSchema), async (req, res, next) => {
  try {
    const { opportunityId, volunteerId, attended, hoursCompleted } = req.body;

    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    if (opportunity.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only record attendance for opportunities you created" });
    }

    const application = await prisma.application.findUnique({
      where: { opportunityId_volunteerId: { opportunityId, volunteerId } },
    });
    if (!application || application.status !== "approved") {
      return res.status(400).json({ error: "Volunteer must have an approved application for this opportunity" });
    }

    const record = await prisma.attendance.upsert({
      where: { opportunityId_volunteerId: { opportunityId, volunteerId } },
      update: { attended: attended !== false, hoursCompleted: hoursCompleted || 0, recordedBy: req.user.id },
      create: {
        opportunityId,
        volunteerId,
        attended: attended !== false,
        hoursCompleted: hoursCompleted || 0,
        recordedBy: req.user.id,
      },
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
