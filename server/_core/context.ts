import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getUserById } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Development & Local Showcase Auto-Login:
  // When running locally on localhost (or non-production) and no explicit session cookie is present,
  // automatically default to Sithum Manusha (User ID 1) so localhost:3000 displays full realistic data
  // on every single page (Dashboard, Transactions, Budgets, Recurring, Insights, Copilot, Shared Groups)
  // for taking crisp portfolio & LinkedIn screenshots.
  if (!user && (!ENV.isProduction || opts.req.hostname === "localhost" || opts.req.hostname === "127.0.0.1")) {
    try {
      const devUser = await getUserById(1);
      if (devUser) {
        user = devUser;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
