import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ledgerly";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: connectionString,
  },
});
