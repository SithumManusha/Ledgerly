import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";

function createMockContext(userId = 801): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@ledgerly.local`,
      name: "Sithum Manusha",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    },
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Track 1: Autonomous AI Financial Intelligence Engine", () => {
  it("calculates financial health score, velocity anomalies, and budget breach forecasts", async () => {
    const caller = appRouter.createCaller(createMockContext(801));
    const result = await caller.intelligence.getHealthAndForecasts({ monthKey: "2026-09" });

    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(10);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["A+", "A", "B", "C", "D"]).toContain(result.grade);
    expect(result.breakdown).toHaveProperty("budgetAdherence");
    expect(result.breakdown).toHaveProperty("savingsRate");
    expect(result.breakdown).toHaveProperty("burnStability");
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(Array.isArray(result.forecasts)).toBe(true);
    expect(Array.isArray(result.proactiveTips)).toBe(true);
  });

  it("simulates What-If scenarios with discretionary cuts and major purchases", async () => {
    const caller = appRouter.createCaller(createMockContext(802));
    const simulation = await caller.intelligence.simulateWhatIf({
      discretionaryCutPct: 20,
      majorPurchaseCents: 15000000, // 150,000 LKR
      monthlyIncomeChangeCents: 0,
      monthKey: "2026-09",
    });

    expect(simulation).toBeDefined();
    expect(simulation.simulatedMonthlyBurnCents).toBeLessThanOrEqual(simulation.baselineMonthlyBurnCents);
    expect(simulation.monthlySavingsDeltaCents).toBeGreaterThan(0);
    expect(["LOW_RISK", "MODERATE_RISK", "CRITICAL_RUNWAY"]).toContain(simulation.riskLevel);
    expect(simulation.projectedTimeline.length).toBe(6);
    expect(typeof simulation.executiveSummary).toBe("string");
  });

  it("answers natural language financial queries via Copilot", async () => {
    const caller = appRouter.createCaller(createMockContext(803));
    const response = await caller.intelligence.askCopilot({
      prompt: "Can I afford a weekend trip to Ella for 40,000 LKR?",
    });

    expect(response).toBeDefined();
    expect(typeof response.answer).toBe("string");
    expect(response.answer.length).toBeGreaterThan(10);
  });
});

describe("Track 2: Real-Time Notification Bell & Activity Audit Stream", () => {
  it("lists notifications and unread counts for authenticated user", async () => {
    const caller = appRouter.createCaller(createMockContext(804));
    const result = await caller.notifications.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result.notifications)).toBe(true);
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.unreadCount).toBeGreaterThanOrEqual(0);
  });

  it("marks a single notification as read", async () => {
    const caller = appRouter.createCaller(createMockContext(805));
    const initial = await caller.notifications.list();
    const unread = initial.notifications.find(n => !n.isRead);
    
    if (unread) {
      const res = await caller.notifications.markAsRead({ id: unread.id });
      expect(res.success).toBe(true);

      const after = await caller.notifications.list();
      const updated = after.notifications.find(n => n.id === unread.id);
      expect(updated?.isRead).toBe(true);
    }
  });

  it("marks all notifications as read in one click", async () => {
    const caller = appRouter.createCaller(createMockContext(806));
    const res = await caller.notifications.markAllAsRead();
    expect(res.success).toBe(true);

    const after = await caller.notifications.list();
    expect(after.unreadCount).toBe(0);
    expect(after.notifications.every(n => n.isRead)).toBe(true);
  });

  it("retrieves financial audit activity stream for shared groups", async () => {
    const caller = appRouter.createCaller(createMockContext(807));
    const group = await caller.shared.createGroup({ name: "Audit Test Group", currency: "LKR" });
    const activities = await caller.shared.getActivityStream({ groupId: group!.id });

    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0]).toHaveProperty("action");
    expect(activities[0]).toHaveProperty("title");
    expect(activities[0]).toHaveProperty("timestamp");
  });
});
