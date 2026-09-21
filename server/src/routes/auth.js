const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, uuid } = require("../db");
const { JWT_SECRET } = require("../middleware/auth");
const { validate, registerSchema, loginSchema } = require("../validation");

const router = express.Router();

// POST /api/auth/register  — FR-01
router.post("/register", validate(registerSchema), (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const finalRole = role || "volunteer";

  db.prepare(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, email, passwordHash, finalRole);

  if (finalRole === "volunteer") {
    db.prepare("INSERT INTO volunteer_profiles (id, userId) VALUES (?, ?)").run(uuid(), id);
  }

  const token = jwt.sign({ id, role: finalRole, email, name }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id, name, email, role: finalRole } });
});

// POST /api/auth/login
router.post("/login", validate(loginSchema), (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.active) {
    return res.status(403).json({ error: "This account has been disabled" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

module.exports = router;
