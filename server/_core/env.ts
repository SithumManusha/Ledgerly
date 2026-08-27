const isProduction = process.env.NODE_ENV === "production";

const defaultSecret = "ledgerly_super_secure_production_jwt_key_2026_launch_32chars";
const cookieSecret = process.env.JWT_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || defaultSecret;

const defaultDbUrl = "postgresql://user:password@localhost:5432/ledgerly";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ledgerly",
  appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
  cookieSecret: cookieSecret,
  databaseUrl: process.env.DATABASE_URL?.trim() || defaultDbUrl,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.AI_API_URL || "https://api.openai.com",
  forgeApiKey: process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "",
};
