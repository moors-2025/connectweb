// Singleton PrismaClient for the PostgreSQL-backed data layer. Only imported
// when DATABASE_URL is set (see index.js) — the SQLite path in db.js never
// touches this file, so nothing here can affect the verified default path.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = { prisma };
