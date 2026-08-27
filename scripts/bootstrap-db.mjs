import { readFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[database] DATABASE_URL is not configured");
  process.exit(1);
}

const migrationPath = new URL("../drizzle-pg/0000_initial-postgres-schema.sql", import.meta.url);
const migrationName = "0000_initial-postgres-schema.sql";
const migrationSql = await readFile(migrationPath, "utf8");
const statements = migrationSql
  .split(/-->\s*statement-breakpoint/g)
  .map(statement => statement.trim())
  .filter(Boolean);

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ledgerly_schema_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "appliedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = await client.query(
    `SELECT 1 FROM "ledgerly_schema_migrations" WHERE "name" = $1`,
    [migrationName],
  );

  if (applied.rowCount) {
    console.log(`[database] migration already applied: ${migrationName}`);
  } else {
    await client.query("BEGIN");
    try {
      for (const [index, statement] of statements.entries()) {
        try {
          if (index === 0 && statement.startsWith('CREATE TYPE "public"."user_role"')) {
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
          const executableStatement = statement
            .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
            .replace(/^CREATE UNIQUE INDEX /, "CREATE UNIQUE INDEX IF NOT EXISTS ")
            .replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ");
          await client.query(executableStatement);
        } catch (error) {
          console.error(`[database] migration failed at statement ${index + 1}/${statements.length}`);
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
} catch (error) {
  console.error("[database] bootstrap failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
