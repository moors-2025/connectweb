const bcrypt = require("bcryptjs");
const { db, uuid } = require("./db");

function upsertUser({ name, email, password, role }) {
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (user) return user;
  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, email, bcrypt.hashSync(password, 10), role);
  if (role === "volunteer") {
    db.prepare("INSERT INTO volunteer_profiles (id, userId) VALUES (?, ?)").run(uuid(), id);
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

const mei = upsertUser({ name: "Mei", email: "mei@example.com", password: "password123", role: "volunteer" });
const ali = upsertUser({ name: "Mr Ali", email: "ali@example.com", password: "password123", role: "coordinator" });

const existingOpp = db.prepare("SELECT id FROM opportunities WHERE title = ?").get("Youth Learning Support");
if (!existingOpp) {
  db.prepare(
    `INSERT INTO opportunities
     (id, title, description, category, commitmentType, location, startDatetime, endDatetime, capacity, requiresBriefing, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    uuid(), "Youth Learning Support",
    "Support young people through structured learning and confidence-building activities.",
    "Education Project", "recurring", "PERTAPIS programme site",
    "2026-09-20T10:00:00", "2026-09-20T12:00:00", 4, 1, ali.id
  );

  db.prepare(
    `INSERT INTO opportunities
     (id, title, description, category, commitmentType, location, startDatetime, endDatetime, capacity, requiresBriefing, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    uuid(), "Flag Day Fundraiser",
    "Help with registration and logistics for the annual Flag Day fundraising drive.",
    "Events and Fundraising", "ad_hoc", "Community site",
    "2026-10-04T08:00:00", "2026-10-04T13:00:00", 10, 0, ali.id
  );

  db.prepare(
    `INSERT INTO opportunities
     (id, title, description, category, commitmentType, location, startDatetime, endDatetime, capacity, requiresBriefing, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    uuid(), "Senior Befriending Visits",
    "Regular conversations and social activities with seniors at a welfare home.",
    "Senior Befriending", "recurring", "Welfare home",
    "2026-09-27T14:00:00", "2026-09-27T16:00:00", 6, 1, ali.id
  );
}

console.log("Seed complete.");
console.log("Volunteer login: mei@example.com / password123");
console.log("Coordinator login: ali@example.com / password123");
