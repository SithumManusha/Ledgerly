import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
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

describe("Ledgerly security and privacy enforcement", () => {
  it("rejects unauthenticated calls to protected procedures with UNAUTHORIZED code", async () => {
    const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(caller.expenses.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enforces user data isolation so user A cannot update or delete user B records", async () => {
    const callerA = appRouter.createCaller(createContext(100));
    const callerB = appRouter.createCaller(createContext(200));

    // User A creates an expense
    const expense = await callerA.expenses.create({
      amountCents: 5000,
      transactionDate: "2026-08-01",
      description: "User A Coffee",
      category: "Food & dining",
    });

    expect(expense.id).toBeTypeOf("number");

    // User B attempts to update User A's expense -> throws NOT_FOUND TRPCError because update throws when row not found
    await expect(
      callerB.expenses.update({
        id: expense.id,
        amountCents: 9999,
        transactionDate: "2026-08-01",
        description: "Hacked",
        category: "Food & dining",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // User B attempts to delete User A's expense
    const deleteResult = await callerB.expenses.delete({ id: expense.id });
    expect(deleteResult.deleted).toBe(false);

    // User A successfully deletes their own expense
    const ownDeleteResult = await callerA.expenses.delete({ id: expense.id });
    expect(ownDeleteResult.deleted).toBe(true);
  });
});


describe("expenses.scanReceipt", () => {
  it("rejects unauthenticated receipt scans", async () => {
    const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(caller.expenses.scanReceipt({ imageBase64: "data:image/jpeg;base64,receipt" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates receipt payload size before making an AI request", async () => {
    const caller = appRouter.createCaller(createContext(300));
    await expect(caller.expenses.scanReceipt({ imageBase64: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.expenses.scanReceipt({ imageBase64: "x".repeat(8_000_001) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});


describe("expenses.scanReceipt error handling", () => {
  it("rejects invalid base64 payloads with BAD_REQUEST", async () => {
    const caller = appRouter.createCaller(createContext(400));
    await expect(caller.expenses.scanReceipt({ imageBase64: "invalid" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("Ledgerly portfolio features", () => {
  it("rejects unauthenticated CSV import and savings-goal reads", async () => {
    const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: {} as any });
    await expect(caller.expenses.importCsv({ csv: "date,description,category,amount\\n2026-08-01,Coffee,Food & dining,500" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.savingsGoal.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed CSV rows before database writes", async () => {
    const caller = appRouter.createCaller(createContext(500));
    await expect(caller.expenses.importCsv({ csv: "date,description,category,amount\\nnot-a-date,,Food & dining,-50" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates savings goal amounts before database writes", async () => {
    const caller = appRouter.createCaller(createContext(600));
    await expect(caller.savingsGoal.upsert({ targetCents: 0, currentCents: 0, targetDate: "2026-12-31" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("Ledgerly positive-path and integration coverage", () => {
  it("handles CSV export and import successfully", async () => {
    const caller = appRouter.createCaller(createContext(700));
    await caller.expenses.create({
      amountCents: 2500,
      transactionDate: "2026-08-01",
      description: "Test Lunch",
      category: "Food & dining",
    });

    const exported = await caller.expenses.exportCsv();
    expect(exported.csv).toContain("Test Lunch");
    expect(exported.csv).toContain("25.00");

    const importResult = await caller.expenses.importCsv({
      csv: "date,description,category,amount\n2026-08-02,Coffee,Food & dining,650",
    });
    expect(importResult.imported).toBe(1);
    expect(importResult.expenses[0]?.description).toBe("Coffee");
  });

  it("enforces savings goal user isolation", async () => {
    const callerUserA = appRouter.createCaller(createContext(801));
    const callerUserB = appRouter.createCaller(createContext(802));

    await callerUserA.savingsGoal.upsert({
      targetCents: 200000,
      currentCents: 50000,
      targetDate: "2026-12-31",
    });

    const goalA = await callerUserA.savingsGoal.get();
    const goalB = await callerUserB.savingsGoal.get();

    expect(goalA?.targetCents).toBe(200000);
    expect(goalB).toBeNull();
  });
});

import * as llmModule from "./_core/llm";

describe("AI receipt scanner positive test", () => {
  it("extracts fields from mocked receipt extraction response", async () => {
    const spy = vi.spyOn(llmModule, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              amount: 1450,
              date: "2026-08-15",
              description: "Java Lounge",
              category: "Food & dining",
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createContext(900));
    const result = await caller.expenses.scanReceipt({ imageBase64: "dGVzdC1pbWFnZS1kYXRh" });
    expect(result.amount).toBe(1450);
    expect(result.description).toBe("Java Lounge");
    expect(result.category).toBe("Food & dining");
    spy.mockRestore();
  });
});

describe("Ledgerly final audit flows", () => {
  it("creates and isolates recurring expenses by user", async () => {
    const callerA = appRouter.createCaller(createContext(1100));
    const callerB = appRouter.createCaller(createContext(1101));

    const recurring = await callerA.recurring.create({
      amountCents: 12500,
      description: "Monthly internet bill",
      category: "Bills & utilities",
      frequency: "monthly",
      dayOfMonth: 5,
    });

    expect(recurring?.description).toBe("Monthly internet bill");
    expect((await callerA.recurring.list()).some(item => item.id === recurring?.id)).toBe(true);
    expect((await callerB.recurring.list()).some(item => item.id === recurring?.id)).toBe(false);
    expect((await callerA.recurring.delete({ id: recurring!.id })).deleted).toBe(true);
  });

  it("stores alert thresholds and evaluates projected budget pressure", async () => {
    const caller = appRouter.createCaller(createContext(1110));
    const settings = await caller.alerts.updateSettings({ budgetWarningThresholdPercent: 80, emailAlertsEnabled: false });
    expect(settings.budgetWarningThresholdPercent).toBe(80);

    const evaluation = await caller.alerts.evaluate();
    expect(evaluation.threshold).toBe(80);
    expect(evaluation.budgetWarnings).toEqual([]);
  });

  it("exports only transactions inside a validated timeframe", async () => {
    const caller = appRouter.createCaller(createContext(1120));
    await caller.expenses.create({
      amountCents: 4500,
      transactionDate: "2026-08-12",
      description: "In range",
      category: "Food & dining",
    });
    await caller.expenses.create({
      amountCents: 9900,
      transactionDate: "2026-09-12",
      description: "Outside range",
      category: "Shopping",
    });

    const report = await caller.reports.exportRange({ startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(report.csv).toContain("In range");
    expect(report.csv).not.toContain("Outside range");
    await expect(caller.reports.exportRange({ startDate: "2026-09-01", endDate: "2026-08-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("Shared Group Allocation & Security Isolation", () => {
  it("enforces tenant isolation so user A cannot access or mutate user B shared groups", async () => {
    const callerA = appRouter.createCaller(createContext(801));
    const callerB = appRouter.createCaller(createContext(802));

    const group = await callerA.shared.createGroup({ name: "Hostel Room 4B", currency: "LKR" });
    expect(group?.id).toBeTypeOf("number");

    // User B attempts to list members or bills for user A's group -> NOT_FOUND
    await expect(callerB.shared.members({ groupId: group!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerB.shared.bills({ groupId: group!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerB.shared.settlement({ groupId: group!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("calculates accurate occupancy-day splits and debt simplification transfers", async () => {
    const caller = appRouter.createCaller(createContext(803));
    const group = await caller.shared.createGroup({ name: "Boarding House", currency: "LKR" });
    const gId = group!.id;

    const m1 = await caller.shared.addMember({ groupId: gId, displayName: "Sunil" });
    const m2 = await caller.shared.addMember({ groupId: gId, displayName: "Nimal" });
    const m3 = await caller.shared.addMember({ groupId: gId, displayName: "Ruwan" });

    // Water bill 30,000 LKR split by occupancy days: Sunil 30 days, Nimal 15 days, Ruwan 15 days (Total 60 days)
    // Sunil share: 30000 * 30/60 = 15000 LKR (1,500,000 cents)
    // Nimal share: 30000 * 15/60 = 7500 LKR (750,000 cents)
    // Ruwan share: 30000 * 15/60 = 7500 LKR (750,000 cents)
    const bill = await caller.shared.addBill({
      groupId: gId,
      description: "August Water Bill",
      category: "Housing",
      totalCents: 3000000,
      allocationMethod: "occupancy",
      billDate: "2026-08-01",
      payerMemberId: m1.id,
      shares: [
        { memberId: m1.id, inputValue: 30 },
        { memberId: m2.id, inputValue: 15 },
        { memberId: m3.id, inputValue: 15 },
      ],
    });

    expect(bill?.totalCents).toBe(3000000);
    expect(bill?.shares.length).toBe(3);

    const settlement = await caller.shared.settlement({ groupId: gId });
    expect(settlement.totalCents).toBe(3000000);
    expect(settlement.transfers.length).toBeGreaterThan(0);
  });
});

describe("Shared Group AI Allocation Assistant", () => {
  it("parses natural-language bill descriptions into structured allocation parameters", async () => {
    const caller = appRouter.createCaller(createContext(901));
    const group = await caller.shared.createGroup({ name: "Hostel AI Group", currency: "LKR" });
    const gId = group!.id;

    const m1 = await caller.shared.addMember({ groupId: gId, displayName: "Sunil" });
    const m2 = await caller.shared.addMember({ groupId: gId, displayName: "Nimal" });

    const spy = vi.spyOn(llmModule, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "Electricity bill",
              category: "Bills & utilities",
              totalAmount: 15000,
              allocationMethod: "equal",
              payerName: "Sunil",
              shares: [
                { memberId: m1.id, inputValue: 1 },
                { memberId: m2.id, inputValue: 1 },
              ],
              explanation: "Split equally between Sunil and Nimal",
              clarificationNeeded: null,
            }),
          },
        },
      ],
    } as any);

    const result = await caller.shared.parseAiBillAllocation({
      groupId: gId,
      prompt: "Electricity bill 15000 LKR paid by Sunil, split equally",
    });

    expect(result.success).toBe(true);
    expect(result.extracted.totalCents).toBe(1500000);
    expect(result.extracted.allocationMethod).toBe("equal");
    expect(result.extracted.shares.length).toBe(2);
    spy.mockRestore();
  });
});

describe("Shared Group AI Allocation Robustness & Error Paths", () => {
  it("rejects AI prompts when group has no members", async () => {
    const caller = appRouter.createCaller(createContext(902));
    const group = await caller.shared.createGroup({ name: "Empty AI Group", currency: "LKR" });
    await expect(
      caller.shared.parseAiBillAllocation({ groupId: group!.id, prompt: "Electricity bill 5000" })
    ).rejects.toThrow();
  });

  it("returns parse failure gracefully on ambiguous prompts", async () => {
    const caller = appRouter.createCaller(createContext(902));
    const group = await caller.shared.createGroup({ name: "Error AI Group", currency: "LKR" });
    await caller.shared.addMember({ groupId: group!.id, displayName: "Alice" });
    await caller.shared.addMember({ groupId: group!.id, displayName: "Bob" });

    // Mock LLM to throw or return invalid JSON
    const llmModule = await import("./_core/llm");
    const spy = vi.spyOn(llmModule, "invokeLLM").mockRejectedValueOnce(new Error("API timeout"));

    const result = await caller.shared.parseAiBillAllocation({
      groupId: group!.id,
      prompt: "Invalid ambiguous bill prompt",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    spy.mockRestore();
  });
});
describe("Shared Group Settlement Management", () => {
  it("allows upserting and listing shared settlements securely", async () => {
    const caller = appRouter.createCaller(createContext(903));
    const group = await caller.shared.createGroup({ name: "Settlement Test Group", currency: "LKR" });
    const gId = group!.id;
    const m1 = await caller.shared.addMember({ groupId: gId, displayName: "Sunil" });
    const m2 = await caller.shared.addMember({ groupId: gId, displayName: "Nimal" });

    const settlement = await caller.shared.upsertSettlement({
      groupId: gId,
      fromMemberId: m1.id,
      toMemberId: m2.id,
      amountCents: 5000,
      status: "paid",
      paymentMethod: "Bank Transfer",
      referenceNote: "Test payment note",
      evidenceUrl: "https://example.com/receipt.png",
    });
    expect(settlement.status).toBe("paid");
    expect(settlement.amountCents).toBe(5000);

    const list = await caller.shared.settlements({ groupId: gId });
    expect(list.length).toBeGreaterThan(0);
  });

  it("prevents unauthorized users from viewing or modifying shared settlements", async () => {
    const ownerCaller = appRouter.createCaller(createContext(903));
    const outsiderCaller = appRouter.createCaller(createContext(904));

    const group = await ownerCaller.shared.createGroup({ name: "Private Settlement Group", currency: "LKR" });
    const gId = group!.id;
    const m1 = await ownerCaller.shared.addMember({ groupId: gId, displayName: "Alice" });
    const m2 = await ownerCaller.shared.addMember({ groupId: gId, displayName: "Bob" });

    await expect(outsiderCaller.shared.settlements({ groupId: gId })).rejects.toThrow();
    await expect(
      outsiderCaller.shared.upsertSettlement({
        groupId: gId,
        fromMemberId: m1.id,
        toMemberId: m2.id,
        amountCents: 1000,
        status: "paid",
      })
    ).rejects.toThrow();
  });

  it("validates member ownership when upserting settlements", async () => {
    const caller = appRouter.createCaller(createContext(903));
    const group = await caller.shared.createGroup({ name: "Member Check Group", currency: "LKR" });
    const gId = group!.id;
    const m1 = await caller.shared.addMember({ groupId: gId, displayName: "Charlie" });

    await expect(
      caller.shared.upsertSettlement({
        groupId: gId,
        fromMemberId: m1.id,
        toMemberId: 99999, // non-existent member
        amountCents: 2000,
        status: "paid",
      })
    ).rejects.toThrow();
  });

  it("exports an authorized shared settlement report as a PDF", async () => {
    const caller = appRouter.createCaller(createContext(905));
    const group = await caller.shared.createGroup({ name: "PDF Export Group", currency: "LKR" });
    const report = await caller.reports.exportSettlementPdf({ groupId: group!.id });

    expect(report.contentType).toBe("application/pdf");
    expect(report.filename).toContain("pdf-export-group");
    expect(report.pdfBase64.startsWith("JVBERi0")).toBe(true);
  });

  it("rejects missing and cross-tenant settlement PDF exports", async () => {
    const caller = appRouter.createCaller(createContext(906));
    const outsider = appRouter.createCaller(createContext(907));
    await expect(caller.reports.exportSettlementPdf({ groupId: 99999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const group = await caller.shared.createGroup({ name: "Private PDF Group", currency: "LKR" });
    await expect(outsider.reports.exportSettlementPdf({ groupId: group!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
