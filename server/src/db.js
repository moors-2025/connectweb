// Local/demo data layer. Mirrors prisma/schema.prisma table-for-table so the SQL here
// maps 1:1 onto the documented data model. Uses Node's built-in `node:sqlite` (no native
// module download needed) so the project runs immediately in any sandboxed or offline
// environment. Swap this file's connection for `@prisma/client` against PostgreSQL when
// deploying (see server/README.md) — the route handlers only call the exported helpers
// below, so that swap does not require touching route logic.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('volunteer','coordinator','admin')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS volunteer_profiles (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE REFERENCES users(id),
    skills TEXT,
    interests TEXT,
    availability TEXT,
    preferredLocations TEXT,
    commitmentPreference TEXT
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    commitmentType TEXT NOT NULL CHECK (commitmentType IN ('ad_hoc','recurring','mentoring')),
    location TEXT NOT NULL,
    startDatetime TEXT NOT NULL,
    endDatetime TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    requiresBriefing INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
    createdBy TEXT NOT NULL REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    opportunityId TEXT NOT NULL REFERENCES opportunities(id),
    volunteerId TEXT NOT NULL REFERENCES users(id),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
    briefingConfirmed INTEGER NOT NULL DEFAULT 0,
    reviewedBy TEXT REFERENCES users(id),
    reviewedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(opportunityId, volunteerId)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    opportunityId TEXT NOT NULL REFERENCES opportunities(id),
    volunteerId TEXT NOT NULL REFERENCES users(id),
    attended INTEGER NOT NULL DEFAULT 1,
    hoursCompleted REAL NOT NULL DEFAULT 0,
    recordedBy TEXT NOT NULL REFERENCES users(id),
    recordedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(opportunityId, volunteerId)
  );
`);

function uuid() {
  return crypto.randomUUID();
}

module.exports = { db, uuid };
