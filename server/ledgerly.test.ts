import { describe, expect, it } from "vitest";
import { aliasCategory, normalizeCategory } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(userId = 42): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Ledgerly category helpers", () => {
  it("maps common descriptions to a supported category", () => {
    expect(aliasCategory("Uber ride to work")).toBe("Transport");
    expect(aliasCategory("food")).toBe("Food & dining");
    expect(normalizeCategory("Not a real category")).toBe("Other");
  });
});

describe("Ledgerly protected procedures", () => {
  it("exposes a healthy public system response", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.system.health()).resolves.toEqual({ ok: true, service: "ledgerly" });
  });

  it("returns a user-scoped empty dashboard without leaking another account's data", async () => {
    const caller = appRouter.createCaller(createContext(9001));
    const result = await caller.analytics.dashboard({ monthKey: "2026-08" });
    expect(result.monthKey).toBe("2026-08");
    expect(result.summary.totalCents).toBeGreaterThanOrEqual(0);
    expect(result.categoryTotals).toBeInstanceOf(Array);
    expect(result.monthlyTotals).toHaveLength(6);
    expect(result.monthlyTotals[5]?.monthKey).toBe("2026-08");
    expect(result.dailyTotals).toBeInstanceOf(Array);
  });

  it("rejects malformed month keys before querying", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.analytics.dashboard({ monthKey: "August 2026" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
