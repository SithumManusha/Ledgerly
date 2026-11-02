import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not defined!");
  console.error("Make sure the DATABASE_URL secret is configured in GitHub Repository Secrets.");
  process.exit(1);
}

const RENDER_APP_URL = process.env.APP_URL || "https://ledgerly-mbcd.onrender.com";

async function ping() {
  console.log("=========================================");
  console.log("  Ledgerly Cloud Keep-Alive & Health Ping");
  console.log("=========================================");

  let hasError = false;

  // 1. Ping Supabase PostgreSQL
  console.log("[1/2] Connecting to Supabase PostgreSQL...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 25000,
  });

  try {
    await client.connect();
    const res = await client.query("SELECT NOW() as current_time, COUNT(*) as user_count FROM users;");
    console.log("  ✓ Database Active! Query result:", res.rows[0]);
    await client.query("SELECT 1;");
    console.log("  ✓ Supabase activity successfully registered (7-day pause reset).");
  } catch (err) {
    console.error("  ✗ Database ping failed:", err.message);
    hasError = true;
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }

  // 2. Ping Render Live Site
  console.log("\n[2/2] Pinging Render Live App:", RENDER_APP_URL);
  try {
    const response = await fetch(RENDER_APP_URL, {
      method: "GET",
      headers: { "User-Agent": "Ledgerly-HealthCheck-Bot/1.0" },
      signal: AbortSignal.timeout(35000),
    });
    console.log(`  ✓ Render Live App responded with HTTP status: ${response.status}`);
  } catch (err) {
    console.warn("  ! Render app ping notice (Render may be spinning up):", err.message);
  }

  console.log("\n=========================================");
  if (hasError) {
    console.error("Keep-Alive health check failed!");
    process.exit(1);
  } else {
    console.log("All systems operational & kept alive successfully!");
  }
}

ping();
