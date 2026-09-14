const express = require("express");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const {
  validate,
  opportunityCreateSchema,
  opportunityUpdateSchema,
  applySchema,
} = require("../validation");

const router = express.Router();

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

router.post("/:id/apply", requireAuth, requireRole("volunteer"), validate(applySchema), async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    if (opportunity.status !== "open") {
      return res.status(400).json({ error: "This opportunity is not open for applications" });
    }

    const approvedCount = await prisma.application.count({
      where: { opportunityId: opportunity.id, status: "approved" },
    });
    if (approvedCount >= opportunity.capacity) {
      return res.status(400).json({ error: "This opportunity is already at capacity" });
    }

    const existing = await prisma.application.findUnique({
      where: { opportunityId_volunteerId: { opportunityId: opportunity.id, volunteerId: req.user.id } },
    });
    if (existing) {
      return res.status(409).json({ error: "You have already applied to this opportunity" });
    }

    const created = await prisma.application.create({
      data: { opportunityId: opportunity.id, volunteerId: req.user.id, message: req.body.message || null },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
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
