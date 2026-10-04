const isProduction = process.env.NODE_ENV === "production";

const cookieSecret = process.env.JWT_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || (isProduction ? "" : "ledgerly_dev_local_secret_only");

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ledgerly",
  appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
  cookieSecret: cookieSecret,
  databaseUrl: process.env.DATABASE_URL?.trim() || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.AI_API_URL || "https://api.openai.com",
  forgeApiKey: process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "",
};
