// CLI entry point: `npm run backup`. The actual logic lives in backupUtil.js,
// shared with the admin GUI's backup button (routes/admin.js) so there is
// exactly one implementation. This is the appropriate scope for the current
// SQLite-backed deployment (Appendix L explains why SQLite is used). Once
// migrated to real PostgreSQL, the equivalent would be Render's managed
// Postgres automated backups, or `pg_dump` run on the same schedule.

const { runBackup } = require("./backupUtil");

try {
  const { source, destination, pruned } = runBackup();
  console.log(`Backed up ${source} -> ${destination}`);
  for (const old of pruned) {
    console.log(`Pruned old backup: ${old}`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
