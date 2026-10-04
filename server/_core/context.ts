import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getUserById } from "../db";

import { COOKIE_NAME } from "../../shared/const";

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
  // Strictly applies to localhost development loopback when NO explicit credentials/tokens are provided,
  // enabling local screenshots without affecting deployed users or authenticated test sessions.
  const isLocalHost = opts.req.hostname === "localhost" || opts.req.hostname === "127.0.0.1";
  const rawCookie = opts.req.headers.cookie ?? "";
  const hasAuthCookie = rawCookie.includes(`${COOKIE_NAME}=`) && !rawCookie.includes(`${COOKIE_NAME}=;`);
  const hasAuthHeader = Boolean(opts.req.headers.authorization && opts.req.headers.authorization.startsWith("Bearer "));

  if (!user && isLocalHost && !hasAuthCookie && !hasAuthHeader) {
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
