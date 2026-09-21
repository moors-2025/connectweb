const express = require("express");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, applicationPatchSchema } = require("../validation");

const router = express.Router();

// Unlike the SQLite path (server/src/routes/applications.js), this one is
// genuinely exposed to a check-then-write race: every step here is awaited,
// so two concurrent approval requests for the same opportunity can both pass
// the capacity check before either commits, over-filling it. Fixed with a
// Serializable transaction: Postgres detects the write-write conflict at
// commit time and rejects the loser with a P2034 error, which is retried a
// few times before surfacing as a 409 (a genuine, if rare, race the client
// can safely retry). Written per Prisma's documented pattern for this
// exact problem, but — like the rest of this Prisma/PostgreSQL path — not
// executable against a real database in this build sandbox (Appendix L).
const MAX_RETRIES = 3;

router.patch("/:id", requireAuth, requireRole("coordinator"), validate(applicationPatchSchema), async (req, res, next) => {
  const { status, briefingConfirmed } = req.body;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          const application = await tx.application.findUnique({ where: { id: req.params.id } });
          if (!application) {
            const err = new Error("Application not found");
            err.httpStatus = 404;
            throw err;
          }

          const opportunity = await tx.opportunity.findUnique({ where: { id: application.opportunityId } });
          if (opportunity.createdBy !== req.user.id) {
            const err = new Error("You can only review applications for opportunities you created");
            err.httpStatus = 403;
            throw err;
          }

          if (status === "approved") {
            const approvedCount = await tx.application.count({
              where: { opportunityId: opportunity.id, status: "approved" },
            });
            if (approvedCount >= opportunity.capacity) {
              const err = new Error("This opportunity is already at capacity");
              err.httpStatus = 400;
              throw err;
            }

            // BR4: same hard rule as the SQLite path — see server/src/routes/applications.js
            const alreadyConfirmed = application.briefingConfirmed;
            if (opportunity.requiresBriefing && !alreadyConfirmed && briefingConfirmed !== true) {
              const err = new Error(
                "This opportunity requires a confirmed briefing before approval. Include briefingConfirmed: true once the volunteer has attended the briefing."
              );
              err.httpStatus = 400;
              throw err;
            }
          }

          return tx.application.update({
            where: { id: req.params.id },
            data: {
              status,
              reviewedBy: req.user.id,
              reviewedAt: new Date(),
              ...(briefingConfirmed === true ? { briefingConfirmed: true } : {}),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return res.json(updated);
    } catch (err) {
      if (err.httpStatus) {
        return res.status(err.httpStatus).json({ error: err.message });
      }
      const isSerializationConflict = err.code === "P2034";
      if (isSerializationConflict && attempt < MAX_RETRIES) {
        continue; // lost the race to a concurrent approval — retry against the now-current count
      }
      if (isSerializationConflict) {
        return res.status(409).json({ error: "This application couldn't be reviewed due to a conflicting update — please retry." });
      }
      return next(err);
    }
  }
});

module.exports = router;
