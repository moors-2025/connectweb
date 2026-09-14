// Simple backup: copies the live SQLite file to backups/ with a timestamped name.
// This is the appropriate scope for the current SQLite-backed deployment (Appendix L
// explains why SQLite is used). Once the app is migrated to real PostgreSQL, the
// equivalent would be Render's managed Postgres automated backups, or `pg_dump`
// run on the same schedule this script would be run on.

const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
const BACKUP_DIR = path.join(__dirname, "..", "backups");

if (!fs.existsSync(DB_PATH)) {
  console.error(`No database file found at ${DB_PATH} — nothing to back up.`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(BACKUP_DIR, `data-${timestamp}.sqlite`);

fs.copyFileSync(DB_PATH, destination);
console.log(`Backed up ${DB_PATH} -> ${destination}`);

// Keep only the 10 most recent backups so this doesn't grow unbounded.
const files = fs
  .readdirSync(BACKUP_DIR)
  .filter((f) => f.endsWith(".sqlite"))
  .sort()
  .reverse();
for (const old of files.slice(10)) {
  fs.unlinkSync(path.join(BACKUP_DIR, old));
  console.log(`Pruned old backup: ${old}`);
}
