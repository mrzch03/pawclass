import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type DB = ReturnType<typeof createDB>;

export function createDB(databaseUrl: string) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool, { schema });
  return db;
}
