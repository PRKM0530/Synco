require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  // PERFORMANCE: Tune connection pool for free-tier PostgreSQL (Neon).
  // Default pool is too aggressive and causes connection timeout errors.
  datasources: {
    db: {
      url: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes("?") ? "&" : "?"}connection_limit=5&pool_timeout=10`
        : undefined,
    },
  },
});

module.exports = prisma;
