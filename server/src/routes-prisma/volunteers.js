const express = require("express");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validate, profileUpdateSchema } = require("../validation");

const router = express.Router();

router.get("/me/profile", requireAuth, requireRole("volunteer"), async (req, res, next) => {
  try {
    const profile = await prisma.volunteerProfile.findUnique({ where: { userId: req.user.id } });
    res.json(profile || null);
  } catch (err) {
    next(err);
  }
});

router.patch("/me/profile", requireAuth, requireRole("volunteer"), validate(profileUpdateSchema), async (req, res, next) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    const updated = await prisma.volunteerProfile.update({
      where: { userId: req.user.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/me/schedule", requireAuth, requireRole("volunteer"), async (req, res, next) => {
  try {
    const approved = await prisma.application.findMany({
      where: { volunteerId: req.user.id, status: "approved" },
      include: { opportunity: true },
      orderBy: { opportunity: { startDatetime: "asc" } },
    });
    res.json(approved.map((a) => ({ ...a.opportunity, applicationStatus: a.status })));
  } catch (err) {
    next(err);
  }
});

router.get("/me/applications", requireAuth, requireRole("volunteer"), async (req, res, next) => {
  try {
    const rows = await prisma.application.findMany({
      where: { volunteerId: req.user.id },
      include: { opportunity: { select: { title: true, startDatetime: true, location: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      rows.map((r) => ({
        ...r,
        title: r.opportunity.title,
        startDatetime: r.opportunity.startDatetime,
        location: r.opportunity.location,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/me/hours", requireAuth, requireRole("volunteer"), async (req, res, next) => {
  try {
    const rows = await prisma.attendance.findMany({
      where: { volunteerId: req.user.id },
      include: { opportunity: { select: { title: true, startDatetime: true } } },
      orderBy: { opportunity: { startDatetime: "desc" } },
    });
    const totalHours = rows.reduce((sum, r) => sum + (r.attended ? r.hoursCompleted : 0), 0);
    res.json({
      totalHours,
      records: rows.map((r) => ({
        title: r.opportunity.title,
        startDatetime: r.opportunity.startDatetime,
        hoursCompleted: r.hoursCompleted,
        attended: r.attended,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
