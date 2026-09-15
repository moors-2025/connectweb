// Shared backup logic: copies the live SQLite file to backups/ with a
// timestamped name, keeping the 10 most recent. Used by both the CLI entry
// point (npm run backup) and the admin GUI's backup button (routes/admin.js),
// so there is exactly one implementation, not two that could drift apart.

const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
const BACKUP_DIR = path.join(__dirname, "..", "backups");

function runBackup() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`No database file found at ${DB_PATH} — nothing to back up.`);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(BACKUP_DIR, `data-${timestamp}.sqlite`);
  fs.copyFileSync(DB_PATH, destination);

  const pruned = [];
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sqlite"))
    .sort()
    .reverse();
  for (const old of files.slice(10)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    pruned.push(old);
  }

  return { source: DB_PATH, destination, pruned };
}

module.exports = { runBackup };
