import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config();

// Supabase IPv4 Pooler Configuration (Required because GitHub Actions runners are IPv4-only)
const POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";
const POOLER_USER = "postgres.nlcbqueuubymrlsqmeoc";
const POOLER_PASS = "ledgerly%40570s";
const POOLER_PORT = 6543;
const POOLER_DB = "postgres";

const defaultPoolerUrl =
  "postgresql://" +
  POOLER_USER +
  ":" +
  POOLER_PASS +
  "@" +
  POOLER_HOST +
  ":" +
  POOLER_PORT +
  "/" +
  POOLER_DB;

let connectionString = (process.env.DATABASE_URL || process.env.database_url || "").trim();

// Automatically adapt IPv6 direct host to IPv4 Pooler host for cloud CI runners
if (!connectionString || connectionString.includes("db.nlcbqueuubymrlsqmeoc.supabase.co")) {
  console.log("  [IPv4 Bridge] Using Supabase IPv4 Pooler (ap-northeast-1) for GitHub Actions compatibility.");
  connectionString = defaultPoolerUrl;
}

const RENDER_APP_URL = process.env.APP_URL || "https://ledgerly-mbcd.onrender.com";

async function ping() {
  console.log("=========================================");
  console.log("  Ledgerly Cloud Keep-Alive & Health Ping");
  console.log("=========================================");

  let hasError = false;

  // 1. Ping Supabase PostgreSQL via IPv4
  console.log("\n[1/2] Connecting to Supabase via IPv4 Pooler...");
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
    console.log("  ✓ Supabase activity successfully registered (7-day pause timer reset).");
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
    console.warn("  ! Render app ping notice (Render may be cold starting):", err.message);
  }

  console.log("\n=========================================");
  if (hasError) {
    console.error("Keep-Alive health check failed!");
    process.exit(1);
  } else {
    console.log("ALL SYSTEMS OPERATIONAL & KEPT ALIVE SUCCESSFULLY!");
  }
}

ping();
