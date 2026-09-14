const express = require("express");
const { prisma } = require("../prisma-client");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

async function volunteerHoursRows(coordinatorId) {
  const rows = await prisma.attendance.findMany({
    where: { attended: true, opportunity: { createdBy: coordinatorId } },
    include: { volunteer: { select: { name: true, email: true } } },
  });

  const byVolunteer = new Map();
  for (const r of rows) {
    const key = r.volunteerId;
    const existing = byVolunteer.get(key) || {
      volunteerName: r.volunteer.name,
      email: r.volunteer.email,
      totalHours: 0,
      activitiesCount: 0,
    };
    existing.totalHours += r.hoursCompleted;
    existing.activitiesCount += 1;
    byVolunteer.set(key, existing);
  }
  return [...byVolunteer.values()].sort((a, b) => b.totalHours - a.totalHours);
}

router.get("/volunteer-hours", requireAuth, requireRole("coordinator"), async (req, res, next) => {
  try {
    res.json(await volunteerHoursRows(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get("/volunteer-hours/export.csv", requireAuth, requireRole("coordinator"), async (req, res, next) => {
  try {
    const rows = await volunteerHoursRows(req.user.id);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Volunteer Name", "Email", "Activities Completed", "Total Hours"];
    const csv = [
      header.join(","),
      ...rows.map((r) => [escape(r.volunteerName), escape(r.email), r.activitiesCount, r.totalHours].join(",")),
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="volunteer-hours-report.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get("/opportunity-breakdown", requireAuth, requireRole("coordinator"), async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { createdBy: req.user.id },
      orderBy: { startDatetime: "desc" },
      include: { applications: true, attendances: { where: { attended: true } } },
    });
    res.json(
      opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        commitmentType: o.commitmentType,
        capacity: o.capacity,
        approvedCount: o.applications.filter((a) => a.status === "approved").length,
        pendingCount: o.applications.filter((a) => a.status === "pending").length,
        totalHours: o.attendances.reduce((sum, a) => sum + a.hoursCompleted, 0),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/summary", requireAuth, requireRole("coordinator"), async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { createdBy: req.user.id },
      include: { applications: true, attendances: true },
    });

    const opportunityCount = opportunities.length;
    const activeVolunteers = new Set();
    let totalHours = 0;
    for (const o of opportunities) {
      for (const a of o.applications) {
        if (a.status === "approved") activeVolunteers.add(a.volunteerId);
      }
      for (const at of o.attendances) {
        if (at.attended) totalHours += at.hoursCompleted;
      }
    }

    res.json({ opportunityCount, activeVolunteerCount: activeVolunteers.size, totalHours });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
