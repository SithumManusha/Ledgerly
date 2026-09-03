import { readFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[database] DATABASE_URL is not configured");
  process.exit(1);
}

const migrations = [
  "0000_initial-postgres-schema.sql",
  "0001_harden-supabase-access.sql",
];

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

function splitStatements(sql) {
  return sql
    .split(/-->\s*statement-breakpoint/g)
    .map(statement => statement.trim())
    .filter(Boolean);
}

function makeIdempotent(statement) {
  return statement
    .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ");
}

async function applyMigration(migrationName) {
  const migrationPath = new URL(`../drizzle-pg/${migrationName}`, import.meta.url);
  const migrationSql = await readFile(migrationPath, "utf8");
  const statements = splitStatements(migrationSql);

  const applied = await client.query(
    `SELECT 1 FROM "ledgerly_schema_migrations" WHERE "name" = $1`,
    [migrationName],
  );

  if (applied.rowCount) {
    console.log(`[database] migration already applied: ${migrationName}`);
    return;
  }

  await client.query("BEGIN");
  try {
    for (const [index, statement] of statements.entries()) {
      try {
        if (statement.startsWith('CREATE TYPE "public"."user_role"')) {
          await client.query(`
            DO $$
            BEGIN
              CREATE TYPE "public"."user_role" AS ENUM ('user', 'admin');
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
          `);
          continue;
        }
        await client.query(makeIdempotent(statement));
      } catch (error) {
        console.error(`[database] migration failed: ${migrationName}, statement ${index + 1}/${statements.length}`);
        console.error(statement);
        console.error(error instanceof Error ? error.message : error);
        throw error;
      }
    }

    await client.query(
      `INSERT INTO "ledgerly_schema_migrations" ("name") VALUES ($1)`,
      [migrationName],
    );
    await client.query("COMMIT");
    console.log(`[database] migration applied: ${migrationName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ledgerly_schema_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "appliedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    await applyMigration(migration);
  }
} catch (error) {
  console.error("[database] bootstrap failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
