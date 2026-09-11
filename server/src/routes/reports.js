const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/reports/volunteer-hours — FR-10 (coordinator only)
router.get("/volunteer-hours", requireAuth, requireRole("coordinator"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.name AS volunteerName, u.email, SUM(at.hoursCompleted) AS totalHours, COUNT(*) AS activitiesCount
       FROM attendance at
       JOIN users u ON u.id = at.volunteerId
       JOIN opportunities o ON o.id = at.opportunityId
       WHERE at.attended = 1 AND o.createdBy = ?
       GROUP BY at.volunteerId
       ORDER BY totalHours DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

module.exports = router;
