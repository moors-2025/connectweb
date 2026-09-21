const express = require("express");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const {
  validate,
  opportunityCreateSchema,
  opportunityUpdateSchema,
  applySchema,
} = require("../validation");

const router = express.Router();
const MAX_RETRIES = 3;

async function withApprovedCount(o) {
  const approvedCount = await prisma.application.count({
    where: { opportunityId: o.id, status: "approved" },
  });
  return { ...o, approvedCount };
}

router.get("/", async (req, res, next) => {
  try {
    const { category, commitmentType, location, status } = req.query;
    const where = {
      status: status || "open",
      ...(category ? { category } : {}),
      ...(commitmentType ? { commitmentType } : {}),
      ...(location ? { location: { contains: location, mode: "insensitive" } } : {}),
    };

    const rows = await prisma.opportunity.findMany({ where, orderBy: { startDatetime: "asc" } });
    const withCounts = await Promise.all(rows.map(withApprovedCount));
    res.json(withCounts);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const o = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!o) return res.status(404).json({ error: "Opportunity not found" });

    const approvedCount = await prisma.application.count({
      where: { opportunityId: o.id, status: "approved" },
    });

    let myApplication = null;
    if (req.user?.role === "volunteer") {
      myApplication = await prisma.application.findUnique({
        where: { opportunityId_volunteerId: { opportunityId: o.id, volunteerId: req.user.id } },
        select: { id: true, status: true, briefingConfirmed: true },
      });
    }

    res.json({ ...o, approvedCount, myApplication });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("coordinator"), validate(opportunityCreateSchema), async (req, res, next) => {
  try {
    const o = await prisma.opportunity.create({
      data: { ...req.body, status: "open", createdBy: req.user.id },
    });
    res.status(201).json(await withApprovedCount(o));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireRole("coordinator"), validate(opportunityUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Opportunity not found" });
    if (existing.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only edit opportunities you created" });
    }
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updated = await prisma.opportunity.update({ where: { id: req.params.id }, data: req.body });
    res.json(await withApprovedCount(updated));
  } catch (err) {
    next(err);
  }
});

// Same check-then-write race as the approval route above (routes-prisma/applications.js)
// exists here too — capacity/duplicate checks and the insert are wrapped in one
// Serializable transaction for the same reason and with the same retry-on-conflict
// handling; see that file's comment for the full explanation.
router.post("/:id/apply", requireAuth, requireRole("volunteer"), validate(applySchema), async (req, res, next) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const opportunity = await tx.opportunity.findUnique({ where: { id: req.params.id } });
          if (!opportunity) {
            const err = new Error("Opportunity not found");
            err.httpStatus = 404;
            throw err;
          }
          if (opportunity.status !== "open") {
            const err = new Error("This opportunity is not open for applications");
            err.httpStatus = 400;
            throw err;
          }

          const approvedCount = await tx.application.count({
            where: { opportunityId: opportunity.id, status: "approved" },
          });
          if (approvedCount >= opportunity.capacity) {
            const err = new Error("This opportunity is already at capacity");
            err.httpStatus = 400;
            throw err;
          }

          const existing = await tx.application.findUnique({
            where: { opportunityId_volunteerId: { opportunityId: opportunity.id, volunteerId: req.user.id } },
          });
          if (existing) {
            const err = new Error("You have already applied to this opportunity");
            err.httpStatus = 409;
            throw err;
          }

          return tx.application.create({
            data: { opportunityId: opportunity.id, volunteerId: req.user.id, message: req.body.message || null },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return res.status(201).json(created);
    } catch (err) {
      if (err.httpStatus) {
        return res.status(err.httpStatus).json({ error: err.message });
      }
      const isSerializationConflict = err.code === "P2034";
      if (isSerializationConflict && attempt < MAX_RETRIES) {
        continue;
      }
      if (isSerializationConflict) {
        return res.status(409).json({ error: "This application couldn't be submitted due to a conflicting update — please retry." });
      }
      return next(err);
    }
  }
});

router.get("/:id/applications", requireAuth, requireRole("coordinator"), async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    if (opportunity.createdBy !== req.user.id) {
      return res.status(403).json({ error: "You can only review applications for opportunities you created" });
    }

    const rows = await prisma.application.findMany({
      where: { opportunityId: opportunity.id },
      orderBy: { createdAt: "asc" },
      include: { volunteer: { select: { name: true, email: true } } },
    });
    res.json(
      rows.map((r) => ({
        ...r,
        volunteerName: r.volunteer.name,
        volunteerEmail: r.volunteer.email,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
