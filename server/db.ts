import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import {
  budgets,
  expenses,
  InsertBudget,
  InsertExpense,
  InsertUser,
  InsertSavingsGoal,
  savingsGoals,
  users,
  sharedGroups,
  sharedGroupMembers,
  sharedBills,
  sharedBillShares,
  sharedSettlements,
  sharedGroupInvitations,
  recurringSharedBills,
  recurringExpenses,
  InsertRecurringExpense,
  userAlertSettings,
  InsertUserAlertSetting,
  passwordResetTokens,
  type InsertSharedGroup,
  type InsertSharedGroupMember,
  type InsertSharedBill,
  type InsertSharedBillShare,
  type InsertSharedSettlement,
  type Expense,
  type Budget,
  type SavingsGoal,
  type RecurringExpense,
  type UserAlertSetting,
  type SharedGroup,
  type SharedGroupMember,
  type SharedBill,
  type SharedBillShare,
  type SharedSettlement,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { normalizeEmail } from "../shared/password";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

export async function getDb() {
  if (process.env.USE_MEMORY_DB === "true") {
    return null;
  }
  if (!_db && process.env.DATABASE_URL) {
    try {
      let connUrl = process.env.DATABASE_URL;
      const isLocal = connUrl.includes("localhost") || connUrl.includes("127.0.0.1");
      if (!isLocal && !connUrl.includes("search_path")) {
        const delimiter = connUrl.includes("?") ? "&" : "?";
        connUrl = `${connUrl}${delimiter}options=-csearch_path%3Dpublic`;
      }
      _pool = new Pool({
        connectionString: connUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        options: "-c search_path=public",
      });
      _pool.on("connect", (client) => {
        client.query("SET search_path TO public;").catch(() => {});
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect to PostgreSQL:", error);
      _db = null;
    }
  }
  return _db;
}

// In-Memory Test/Fallback Storage when Live PostgreSQL is unavailable
const memStore = {
  users: new Map<string, any>(),
  expenses: new Map<number, any>(),
  budgets: new Map<string, any>(),
  savingsGoals: new Map<number, any>(),
  recurringExpenses: new Map<number, any>(),
  userAlertSettings: new Map<number, any>(),
  sharedGroups: new Map<number, any>(),
  sharedGroupMembers: new Map<number, any>(),
  sharedBills: new Map<number, any>(),
  sharedBillShares: new Map<string, any>(),
  sharedSettlements: new Map<number, any>(),
  sharedGroupInvitations: new Map<number, any>(),
  recurringSharedBills: new Map<number, any>(),
  passwordResetTokens: new Map<string, any>(),
  nextId: 1000,
};

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (db) {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;

    for (const field of textFields) {
      if (user[field] !== undefined) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    }

    values.lastSignedIn = user.lastSignedIn ?? new Date();
    updateSet.lastSignedIn = values.lastSignedIn;

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
    return;
  }

  // Memory fallback
  const existing = memStore.users.get(user.openId) || {
    id: ++memStore.nextId,
    openId: user.openId,
    createdAt: new Date(),
  };
  Object.assign(existing, user, { updatedAt: new Date() });
  memStore.users.set(user.openId, existing);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  }
  return memStore.users.get(openId);
}

export async function listExpenses(userId: number): Promise<Expense[]> {
  const db = await getDb();
  if (db) {
    return db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.transactionDate), desc(expenses.createdAt));
  }
  return Array.from(memStore.expenses.values())
    .filter(e => e.userId === userId)
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
}

export async function getExpenseById(userId: number, id: number): Promise<Expense | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .limit(1);
    return result[0];
  }
  const item = memStore.expenses.get(id);
  return item && item.userId === userId ? item : undefined;
}

export async function createExpense(input: InsertExpense): Promise<Expense> {
  const db = await getDb();
  if (db) {
    const [created] = await db.insert(expenses).values(input).returning();
    return created;
  }
  const id = ++memStore.nextId;
  const row: Expense = {
    id,
    userId: input.userId,
    amountCents: input.amountCents,
    currency: input.currency ?? "LKR",
    convertedAmountCents: input.convertedAmountCents ?? null,
    conversionRateBps: input.conversionRateBps ?? null,
    transactionDate: input.transactionDate,
    description: input.description,
    category: input.category,
    aiSuggestedCategory: input.aiSuggestedCategory ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.expenses.set(id, row);
  return row;
}

export async function updateExpense(userId: number, id: number, input: Partial<InsertExpense>): Promise<Expense | undefined> {
  const db = await getDb();
  if (db) {
    const [updated] = await db
      .update(expenses)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .returning();
    return updated;
  }
  const item = memStore.expenses.get(id);
  if (!item || item.userId !== userId) return undefined;
  Object.assign(item, input, { updatedAt: new Date() });
  memStore.expenses.set(id, item);
  return item;
}

export async function deleteExpense(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const result = await db
      .delete(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .returning();
    return result.length > 0;
  }
  const item = memStore.expenses.get(id);
  if (item && item.userId === userId) {
    memStore.expenses.delete(id);
    return true;
  }
  return false;
}

export async function listBudgets(userId: number, monthKey: string): Promise<Budget[]> {
  const db = await getDb();
  if (db) {
    return db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.monthKey, monthKey)))
      .orderBy(budgets.category);
  }
  return Array.from(memStore.budgets.values()).filter(b => b.userId === userId && b.monthKey === monthKey);
}

export async function getBudgetById(userId: number, id: number): Promise<Budget | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
      .limit(1);
    return result[0];
  }
  return Array.from(memStore.budgets.values()).find(b => b.id === id && b.userId === userId);
}

export async function upsertBudget(input: InsertBudget): Promise<Budget> {
  const db = await getDb();
  if (db) {
    await db
      .insert(budgets)
      .values(input)
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.monthKey, budgets.category],
        set: {
          limitCents: input.limitCents,
          updatedAt: new Date(),
        },
      });
    const result = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, input.userId),
          eq(budgets.monthKey, input.monthKey),
          eq(budgets.category, input.category),
        ),
      )
      .limit(1);
    return result[0];
  }
  const key = `${input.userId}-${input.monthKey}-${input.category}`;
  const existing = memStore.budgets.get(key) || {
    id: ++memStore.nextId,
    userId: input.userId,
    monthKey: input.monthKey,
    category: input.category,
    createdAt: new Date(),
  };
  existing.limitCents = input.limitCents;
  existing.updatedAt = new Date();
  memStore.budgets.set(key, existing);
  return existing;
}

export async function deleteBudget(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const result = await db.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.id, id))).returning();
    return result.length > 0;
  }
  for (const [key, budget] of Array.from(memStore.budgets.entries())) {
    if (budget.id === id && budget.userId === userId) {
      memStore.budgets.delete(key);
      return true;
    }
  }
  return false;
}

export async function getUserBudgets(userId: number, monthKey: string) {
  return listBudgets(userId, monthKey);
}

export async function getSavingsGoal(userId: number): Promise<SavingsGoal | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)).limit(1);
    return result[0];
  }
  return memStore.savingsGoals.get(userId);
}

export async function upsertSavingsGoal(input: InsertSavingsGoal): Promise<SavingsGoal | undefined> {
  const db = await getDb();
  if (db) {
    await db.insert(savingsGoals).values(input).onConflictDoUpdate({
      target: savingsGoals.userId,
      set: {
        targetCents: input.targetCents,
        currentCents: input.currentCents ?? 0,
        targetDate: input.targetDate,
        updatedAt: new Date(),
      },
    });
    return getSavingsGoal(input.userId);
  }
  const existing: SavingsGoal = memStore.savingsGoals.get(input.userId) || {
    id: ++memStore.nextId,
    userId: input.userId,
    targetCents: input.targetCents,
    currentCents: input.currentCents ?? 0,
    targetDate: input.targetDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  existing.targetCents = input.targetCents;
  existing.currentCents = input.currentCents ?? 0;
  existing.targetDate = input.targetDate;
  existing.updatedAt = new Date();
  memStore.savingsGoals.set(input.userId, existing);
  return existing;
}

export async function deleteSavingsGoal(userId: number): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const result = await db.delete(savingsGoals).where(eq(savingsGoals.userId, userId)).returning();
    return result.length > 0;
  }
  return memStore.savingsGoals.delete(userId);
}

export async function listRecurringExpenses(userId: number): Promise<RecurringExpense[]> {
  const db = await getDb();
  if (db) {
    return db
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.userId, userId))
      .orderBy(desc(recurringExpenses.createdAt));
  }
  return Array.from(memStore.recurringExpenses.values()).filter(r => r.userId === userId);
}

export async function getRecurringExpenseById(userId: number, id: number): Promise<RecurringExpense | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.id, id)))
      .limit(1);
    return result[0];
  }
  const item = memStore.recurringExpenses.get(id);
  return item && item.userId === userId ? item : undefined;
}

export async function createRecurringExpense(input: InsertRecurringExpense): Promise<RecurringExpense> {
  const db = await getDb();
  if (db) {
    const [created] = await db.insert(recurringExpenses).values(input).returning();
    return created;
  }
  const id = ++memStore.nextId;
  const row: RecurringExpense = {
    id,
    userId: input.userId,
    amountCents: input.amountCents,
    description: input.description,
    category: input.category,
    frequency: input.frequency ?? "monthly",
    dayOfMonth: input.dayOfMonth ?? 1,
    active: input.active ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.recurringExpenses.set(id, row);
  return row;
}

export async function updateRecurringExpense(userId: number, id: number, input: Partial<InsertRecurringExpense>): Promise<RecurringExpense | undefined> {
  const db = await getDb();
  if (db) {
    const [updated] = await db
      .update(recurringExpenses)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.id, id)))
      .returning();
    return updated;
  }
  const item = memStore.recurringExpenses.get(id);
  if (!item || item.userId !== userId) return undefined;
  Object.assign(item, input, { updatedAt: new Date() });
  memStore.recurringExpenses.set(id, item);
  return item;
}

export async function deleteRecurringExpense(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  if (db) {
    const result = await db
      .delete(recurringExpenses)
      .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.id, id)))
      .returning();
    return result.length > 0;
  }
  const item = memStore.recurringExpenses.get(id);
  if (item && item.userId === userId) {
    memStore.recurringExpenses.delete(id);
    return true;
  }
  return false;
}

export async function getAlertSettings(userId: number): Promise<UserAlertSetting | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(userAlertSettings).where(eq(userAlertSettings.userId, userId)).limit(1);
    return result[0];
  }
  return memStore.userAlertSettings.get(userId);
}

export async function upsertAlertSettings(input: InsertUserAlertSetting): Promise<UserAlertSetting> {
  const db = await getDb();
  if (db) {
    await db.insert(userAlertSettings).values(input).onConflictDoUpdate({
      target: userAlertSettings.userId,
      set: {
        budgetWarningThresholdPercent: input.budgetWarningThresholdPercent,
        emailAlertsEnabled: input.emailAlertsEnabled ?? 0,
        updatedAt: new Date(),
      },
    });
    return (await getAlertSettings(input.userId))!;
  }
  const existing: UserAlertSetting = memStore.userAlertSettings.get(input.userId) || {
    id: ++memStore.nextId,
    userId: input.userId,
    budgetWarningThresholdPercent: input.budgetWarningThresholdPercent ?? 80,
    emailAlertsEnabled: input.emailAlertsEnabled ?? 0,
    scheduleCronTaskUid: input.scheduleCronTaskUid ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  existing.budgetWarningThresholdPercent = input.budgetWarningThresholdPercent ?? 80;
  existing.emailAlertsEnabled = input.emailAlertsEnabled ?? 0;
  existing.updatedAt = new Date();
  memStore.userAlertSettings.set(input.userId, existing);
  return existing;
}

export async function listSharedGroups(userId: number): Promise<SharedGroup[]> {
  const db = await getDb();
  if (db) {
    return db.select().from(sharedGroups).where(eq(sharedGroups.ownerUserId, userId)).orderBy(desc(sharedGroups.createdAt));
  }
  return Array.from(memStore.sharedGroups.values()).filter(g => g.ownerUserId === userId);
}

export async function getSharedGroup(userId: number, groupId: number): Promise<SharedGroup | undefined> {
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(sharedGroups)
      .where(and(eq(sharedGroups.ownerUserId, userId), eq(sharedGroups.id, groupId)))
      .limit(1);
    return result[0];
  }
  const group = memStore.sharedGroups.get(groupId);
  return group && group.ownerUserId === userId ? group : undefined;
}

export async function createSharedGroup(input: InsertSharedGroup): Promise<SharedGroup> {
  const db = await getDb();
  if (db) {
    const [created] = await db.insert(sharedGroups).values(input).returning();
    return created;
  }
  const id = ++memStore.nextId;
  const row: SharedGroup = {
    id,
    ownerUserId: input.ownerUserId,
    name: input.name,
    currency: input.currency ?? "LKR",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.sharedGroups.set(id, row);
  return row;
}

export async function listSharedMembers(userId: number, groupId: number): Promise<SharedGroupMember[] | undefined> {
  const group = await getSharedGroup(userId, groupId);
  if (!group) return undefined;
  const db = await getDb();
  if (db) {
    return db.select().from(sharedGroupMembers).where(eq(sharedGroupMembers.groupId, groupId)).orderBy(sharedGroupMembers.displayName);
  }
  return Array.from(memStore.sharedGroupMembers.values()).filter(m => m.groupId === groupId);
}

export async function createSharedMember(userId: number, input: InsertSharedGroupMember): Promise<SharedGroupMember | undefined> {
  const group = await getSharedGroup(userId, input.groupId);
  if (!group) return undefined;
  const db = await getDb();
  if (db) {
    const [created] = await db.insert(sharedGroupMembers).values(input).returning();
    return created;
  }
  const id = ++memStore.nextId;
  const row: SharedGroupMember = {
    id,
    groupId: input.groupId,
    displayName: input.displayName,
    linkedUserId: input.linkedUserId ?? null,
    createdAt: new Date(),
  };
  memStore.sharedGroupMembers.set(id, row);
  return row;
}

export async function deleteSharedMember(userId: number, groupId: number, memberId: number): Promise<boolean> {
  const group = await getSharedGroup(userId, groupId);
  if (!group) return false;
  const db = await getDb();
  if (db) {
    const result = await db
      .delete(sharedGroupMembers)
      .where(and(eq(sharedGroupMembers.groupId, groupId), eq(sharedGroupMembers.id, memberId)))
      .returning();
    return result.length > 0;
  }
  const member = memStore.sharedGroupMembers.get(memberId);
  if (member && member.groupId === groupId) {
    memStore.sharedGroupMembers.delete(memberId);
    return true;
  }
  return false;
}

export async function createSharedBill(userId: number, input: InsertSharedBill, shares: InsertSharedBillShare[]): Promise<any> {
  const group = await getSharedGroup(userId, input.groupId);
  if (!group) return undefined;
  const db = await getDb();
  if (db) {
    const [bill] = await db.insert(sharedBills).values(input).returning();
    const billId = bill.id;
    if (shares.length > 0) {
      await db.insert(sharedBillShares).values(shares.map(share => ({ ...share, billId })));
    }
    return getSharedBill(userId, billId);
  }
  const billId = ++memStore.nextId;
  const bill: SharedBill = {
    id: billId,
    groupId: input.groupId,
    createdByUserId: input.createdByUserId,
    description: input.description,
    category: input.category ?? "Other",
    totalCents: input.totalCents,
    currency: input.currency ?? "LKR",
    reportingCurrency: input.reportingCurrency ?? "LKR",
    conversionRateBps: input.conversionRateBps ?? 10000,
    allocationMethod: input.allocationMethod,
    billDate: input.billDate,
    payerMemberId: input.payerMemberId ?? null,
    createdAt: new Date(),
  };
  memStore.sharedBills.set(billId, bill);
  const createdShares: SharedBillShare[] = [];
  for (const s of shares) {
    const shareId = ++memStore.nextId;
    const shareRow: SharedBillShare = {
      id: shareId,
      billId,
      memberId: s.memberId,
      inputValue: s.inputValue ?? 0,
      shareCents: s.shareCents,
      createdAt: new Date(),
    };
    memStore.sharedBillShares.set(`${billId}-${s.memberId}`, shareRow);
    createdShares.push(shareRow);
  }
  return { ...bill, shares: createdShares };
}

export async function getSharedBill(userId: number, billId: number): Promise<any> {
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(sharedBills).where(eq(sharedBills.id, billId)).limit(1);
    const bill = rows[0];
    if (!bill) return undefined;
    const group = await getSharedGroup(userId, bill.groupId);
    if (!group) return undefined;
    const shares = await db.select().from(sharedBillShares).where(eq(sharedBillShares.billId, billId));
    return { ...bill, shares };
  }
  const bill = memStore.sharedBills.get(billId);
  if (!bill) return undefined;
  const group = await getSharedGroup(userId, bill.groupId);
  if (!group) return undefined;
  const shares = Array.from(memStore.sharedBillShares.values()).filter(s => s.billId === billId);
  return { ...bill, shares };
}

export async function listSharedBills(userId: number, groupId: number): Promise<any> {
  const group = await getSharedGroup(userId, groupId);
  if (!group) return undefined;
  const db = await getDb();
  if (db) {
    const bills = await db.select().from(sharedBills).where(eq(sharedBills.groupId, groupId)).orderBy(desc(sharedBills.billDate), desc(sharedBills.createdAt));
    const results = [];
    for (const bill of bills) {
      const shares = await db.select().from(sharedBillShares).where(eq(sharedBillShares.billId, bill.id));
      results.push({ ...bill, shares });
    }
    return results;
  }
  const bills = Array.from(memStore.sharedBills.values()).filter(b => b.groupId === groupId);
  return bills.map(bill => ({
    ...bill,
    shares: Array.from(memStore.sharedBillShares.values()).filter(s => s.billId === bill.id),
  }));
}

export async function deleteSharedBill(userId: number, groupId: number, billId: number): Promise<boolean> {
  const group = await getSharedGroup(userId, groupId);
  if (!group) return false;
  const db = await getDb();
  if (db) {
    await db.delete(sharedBillShares).where(eq(sharedBillShares.billId, billId));
    const result = await db.delete(sharedBills).where(and(eq(sharedBills.groupId, groupId), eq(sharedBills.id, billId))).returning();
    return result.length > 0;
  }
  const bill = memStore.sharedBills.get(billId);
  if (bill && bill.groupId === groupId) {
    memStore.sharedBills.delete(billId);
    for (const [k, s] of Array.from(memStore.sharedBillShares.entries())) {
      if (s.billId === billId) memStore.sharedBillShares.delete(k);
    }
    return true;
  }
  return false;
}

export async function listSharedSettlements(groupId: number): Promise<SharedSettlement[]> {
  const db = await getDb();
  if (db) {
    return db
      .select()
      .from(sharedSettlements)
      .where(eq(sharedSettlements.groupId, groupId))
      .orderBy(desc(sharedSettlements.createdAt));
  }
  return Array.from(memStore.sharedSettlements.values()).filter(s => s.groupId === groupId);
}

export async function upsertSharedSettlement(input: {
  groupId: number;
  fromMemberId: number;
  toMemberId: number;
  amountCents: number;
  status: string;
  paymentMethod?: string;
  referenceNote?: string;
  evidenceUrl?: string;
  userId: number;
}): Promise<SharedSettlement> {
  const db = await getDb();
  if (db) {
    const existing = await db
      .select()
      .from(sharedSettlements)
      .where(
        and(
          eq(sharedSettlements.groupId, input.groupId),
          eq(sharedSettlements.fromMemberId, input.fromMemberId),
          eq(sharedSettlements.toMemberId, input.toMemberId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(sharedSettlements)
        .set({
          amountCents: input.amountCents,
          status: input.status,
          paymentMethod: input.paymentMethod ?? null,
          referenceNote: input.referenceNote ?? null,
          evidenceUrl: input.evidenceUrl ?? null,
          updatedByUserId: input.userId,
          updatedAt: new Date(),
        })
        .where(eq(sharedSettlements.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(sharedSettlements).values({
        groupId: input.groupId,
        fromMemberId: input.fromMemberId,
        toMemberId: input.toMemberId,
        amountCents: input.amountCents,
        status: input.status,
        paymentMethod: input.paymentMethod ?? null,
        referenceNote: input.referenceNote ?? null,
        evidenceUrl: input.evidenceUrl ?? null,
        updatedByUserId: input.userId,
      }).returning();
      return created;
    }
  }

  const existing = Array.from(memStore.sharedSettlements.values()).find(
    s => s.groupId === input.groupId && s.fromMemberId === input.fromMemberId && s.toMemberId === input.toMemberId
  );
  if (existing) {
    existing.amountCents = input.amountCents;
    existing.status = input.status;
    existing.paymentMethod = input.paymentMethod ?? null;
    existing.referenceNote = input.referenceNote ?? null;
    existing.evidenceUrl = input.evidenceUrl ?? null;
    existing.updatedByUserId = input.userId;
    existing.updatedAt = new Date();
    return existing;
  }
  const id = ++memStore.nextId;
  const row: SharedSettlement = {
    id,
    groupId: input.groupId,
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    amountCents: input.amountCents,
    status: input.status,
    paymentMethod: input.paymentMethod ?? null,
    referenceNote: input.referenceNote ?? null,
    evidenceUrl: input.evidenceUrl ?? null,
    updatedByUserId: input.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memStore.sharedSettlements.set(id, row);
  return row;
}

export async function createGroupInvitation(data: {
  groupId: number;
  inviterUserId: string;
  inviteeEmail: string;
  role?: string;
  token: string;
}) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(sharedGroupInvitations).values({
      groupId: data.groupId,
      inviterUserId: data.inviterUserId,
      inviteeEmail: data.inviteeEmail,
      role: data.role || 'member',
      token: data.token,
      status: 'pending',
    }).returning();
    return result.id;
  }
  const id = ++memStore.nextId;
  memStore.sharedGroupInvitations.set(id, { id, ...data, status: 'pending', createdAt: new Date() });
  return id;
}

export async function listGroupInvitations(groupId: number) {
  const db = await getDb();
  if (db) {
    return db.select().from(sharedGroupInvitations).where(eq(sharedGroupInvitations.groupId, groupId));
  }
  return Array.from(memStore.sharedGroupInvitations.values()).filter(i => i.groupId === groupId);
}

export async function acceptGroupInvitation(token: string, userId: string, userName: string) {
  const db = await getDb();
  if (db) {
    const [invitation] = await db.select().from(sharedGroupInvitations).where(eq(sharedGroupInvitations.token, token));
    if (!invitation || invitation.status !== 'pending') {
      throw new Error('Invalid or expired invitation token');
    }
    await db.insert(sharedGroupMembers).values({
      groupId: invitation.groupId,
      displayName: userName,
    });
    await db.update(sharedGroupInvitations)
      .set({ status: 'accepted' })
      .where(eq(sharedGroupInvitations.id, invitation.id));
    return invitation.groupId;
  }
  const invitation = Array.from(memStore.sharedGroupInvitations.values()).find(i => i.token === token);
  if (!invitation || invitation.status !== 'pending') throw new Error('Invalid or expired invitation token');
  invitation.status = 'accepted';
  const memberId = ++memStore.nextId;
  memStore.sharedGroupMembers.set(memberId, { id: memberId, groupId: invitation.groupId, displayName: userName, createdAt: new Date() });
  return invitation.groupId;
}

export async function createRecurringSharedBill(data: {
  groupId: number;
  title: string;
  amountCents: number;
  currency?: string;
  splitMode?: string;
  frequency?: string;
  payerUserId: string;
  nextDueDate: Date;
}) {
  const db = await getDb();
  if (db) {
    const [result] = await db.insert(recurringSharedBills).values({
      groupId: data.groupId,
      title: data.title,
      amountCents: data.amountCents,
      currency: data.currency || 'LKR',
      splitMode: data.splitMode || 'equal',
      frequency: data.frequency || 'monthly',
      payerUserId: data.payerUserId,
      nextDueDate: data.nextDueDate,
      isActive: true,
    }).returning();
    return result.id;
  }
  const id = ++memStore.nextId;
  memStore.recurringSharedBills.set(id, { id, ...data, isActive: true, createdAt: new Date() });
  return id;
}

export async function listRecurringSharedBills(groupId: number) {
  const db = await getDb();
  if (db) {
    return db.select().from(recurringSharedBills).where(eq(recurringSharedBills.groupId, groupId));
  }
  return Array.from(memStore.recurringSharedBills.values()).filter(r => r.groupId === groupId);
}

export async function deleteRecurringSharedBill(recurringId: number) {
  const db = await getDb();
  if (db) {
    await db.delete(recurringSharedBills).where(eq(recurringSharedBills.id, recurringId));
    return;
  }
  memStore.recurringSharedBills.delete(recurringId);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
    return result[0];
  }
  const normalized = normalizeEmail(email);
  return Array.from(memStore.users.values()).find(u => u.email && normalizeEmail(u.email) === normalized);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  return Array.from(memStore.users.values()).find(u => u.id === id);
}

export async function invalidatePasswordResetTokens(userId: number) {
  const db = await getDb();
  if (db) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    return;
  }
  for (const token of Array.from(memStore.passwordResetTokens.values())) {
    if (token.userId === userId && !token.usedAt) {
      token.usedAt = new Date();
    }
  }
}

export async function createPasswordResetToken(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (db) {
    const [created] = await db.insert(passwordResetTokens).values(input).returning();
    return created.id;
  }
  const id = ++memStore.nextId;
  const token = { id, ...input, createdAt: new Date() };
  memStore.passwordResetTokens.set(input.tokenHash, token);
  return id;
}

export async function getPasswordResetTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (db) {
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return result[0];
  }
  return memStore.passwordResetTokens.get(tokenHash);
}

export async function consumePasswordResetToken(id: number) {
  const db = await getDb();
  if (db) {
    const result = await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
      .returning();
    return result.length > 0;
  }
  for (const token of Array.from(memStore.passwordResetTokens.values())) {
    if (token.id === id && !token.usedAt) {
      token.usedAt = new Date();
      return true;
    }
  }
  return false;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (db) {
    await db
      .update(users)
      .set({ passwordHash, loginMethod: "local", updatedAt: new Date() })
      .where(eq(users.id, userId));
    return;
  }
  const user = await getUserById(userId);
  if (user) {
    user.passwordHash = passwordHash;
    user.loginMethod = "local";
    user.updatedAt = new Date();
  }
}
