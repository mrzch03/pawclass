import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Run database migrations.
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun run src/db/migrate.ts
 *
 * This applies all migrations from the ./drizzle directory.
 * To generate migrations from schema changes, run:
 *   npx drizzle-kit generate
 */
export async function runMigrations() {
  return main();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
