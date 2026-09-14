const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function volunteerHoursRows(coordinatorId) {
  return db
    .prepare(
      `SELECT u.name AS volunteerName, u.email, SUM(at.hoursCompleted) AS totalHours, COUNT(*) AS activitiesCount
       FROM attendance at
       JOIN users u ON u.id = at.volunteerId
       JOIN opportunities o ON o.id = at.opportunityId
       WHERE at.attended = 1 AND o.createdBy = ?
       GROUP BY at.volunteerId
       ORDER BY totalHours DESC`
    )
    .all(coordinatorId);
}

// GET /api/reports/volunteer-hours — FR-10 (coordinator only)
router.get("/volunteer-hours", requireAuth, requireRole("coordinator"), (req, res) => {
  res.json(volunteerHoursRows(req.user.id));
});

// GET /api/reports/volunteer-hours/export.csv — CSV export of the same report
router.get("/volunteer-hours/export.csv", requireAuth, requireRole("coordinator"), (req, res) => {
  const rows = volunteerHoursRows(req.user.id);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Volunteer Name", "Email", "Activities Completed", "Total Hours"];
  const lines = [
    header.join(","),
    ...rows.map((r) => [escape(r.volunteerName), escape(r.email), r.activitiesCount, r.totalHours].join(",")),
  ];
  const csv = lines.join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="volunteer-hours-report.csv"');
  res.send(csv);
});

// GET /api/reports/opportunity-breakdown — per-opportunity participation summary
router.get("/opportunity-breakdown", requireAuth, requireRole("coordinator"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.id, o.title, o.category, o.commitmentType, o.capacity,
              COUNT(DISTINCT CASE WHEN a.status = 'approved' THEN a.id END) AS approvedCount,
              COUNT(DISTINCT CASE WHEN a.status = 'pending' THEN a.id END) AS pendingCount,
              COALESCE(SUM(at.hoursCompleted), 0) AS totalHours
       FROM opportunities o
       LEFT JOIN applications a ON a.opportunityId = o.id
       LEFT JOIN attendance at ON at.opportunityId = o.id AND at.attended = 1
       WHERE o.createdBy = ?
       GROUP BY o.id
       ORDER BY o.startDatetime DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// GET /api/reports/summary — org-wide totals for this coordinator's opportunities
router.get("/summary", requireAuth, requireRole("coordinator"), (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(DISTINCT o.id) AS opportunityCount,
         COUNT(DISTINCT CASE WHEN a.status = 'approved' THEN a.volunteerId END) AS activeVolunteerCount,
         COALESCE(SUM(CASE WHEN at.attended = 1 THEN at.hoursCompleted ELSE 0 END), 0) AS totalHours
       FROM opportunities o
       LEFT JOIN applications a ON a.opportunityId = o.id
       LEFT JOIN attendance at ON at.opportunityId = o.id
       WHERE o.createdBy = ?`
    )
    .get(req.user.id);
  res.json(totals);
});

module.exports = router;
