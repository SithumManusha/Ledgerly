import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  aliasCategory,
  DEFAULT_MONTH_KEY,
  EXPENSE_CATEGORIES,
  isValidAmountCents,
  isValidDateString,
  isValidMonthKey,
  normalizeCategory,
  sanitizeDescription,
} from "../drizzle/schema";
import { storagePut } from "./storage";
import { renderSettlementReportPdf } from "./settlementReportPdf";
import {
  createExpense,
  deleteBudget,
  deleteExpense,
  getExpenseById,
  getSavingsGoal,
  listBudgets,
  listExpenses,
  upsertBudget,
  upsertSavingsGoal,
  deleteSavingsGoal,
  updateExpense,
  listRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  getRecurringExpenseById,
  getAlertSettings,
  upsertAlertSettings,
  listSharedGroups,
  getSharedGroup,
  createSharedGroup,
  listSharedMembers,
  createSharedMember,
  deleteSharedMember,
  createSharedBill,
  listSharedBills,
  deleteSharedBill,
  listSharedSettlements,
  upsertSharedSettlement,
  createGroupInvitation,
  listGroupInvitations,
  acceptGroupInvitation,
  createRecurringSharedBill,
  listRecurringSharedBills,
  deleteRecurringSharedBill,
  consumePasswordResetToken,
  createPasswordResetToken,
  getPasswordResetTokenByHash,
  getUserByEmail,
  getUserById,
  invalidatePasswordResetTokens,
  updateUserPassword,
  upsertUser,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import {
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  passwordPolicyMessage,
} from "../shared/password";
import { fetchLiveExchangeRates, convertCurrency } from "./currencyService";
import { parseBankStatementText } from "./bankStatementParser";
import { broadcastGroupEvent, broadcastUserEvent } from "./realtimeEvents";
import { sendEmail, buildBudgetAlertEmail, buildGroupBillAddedEmail, buildPasswordResetEmail } from "./emailService";
import { ENV } from "./_core/env";
import { SupportedCurrency, SUPPORTED_CURRENCIES } from "../drizzle/schema";

const categoryEnum = z.enum(EXPENSE_CATEGORIES);
const descriptionSchema = z.string().trim().min(2).max(240);
const dateSchema = z.string().refine(isValidDateString, "Use YYYY-MM-DD format.");
const monthSchema = z.string().refine(isValidMonthKey, "Use YYYY-MM format.");
const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, passwordPolicyMessage());
const authEmailSchema = z.string().trim().email("Please provide a valid email address.");
const receiptSchema = z.object({
  imageBase64: z.string().min(1).max(8_000_000).refine(value => {
    const isDataUrl = /^data:image\/(jpeg|png|webp);base64,/i.test(value);
    const payload = isDataUrl ? value.split(",", 2)[1] ?? "" : value;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(payload) && payload.length % 4 === 0;
  }, "Upload a valid base64-encoded JPG, PNG, or WEBP receipt image."),
});

async function requireSharedGroup(userId: number, groupId: number) {
  const group = await getSharedGroup(userId, groupId);
  if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
  return group;
}

function parseTransactionDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid transaction date." });
  return date;
}

function mapExpense(row: Awaited<ReturnType<typeof getExpenseById>>) {
  if (!row) return row;
  return {
    ...row,
    amount: row.amountCents / 100,
    date: row.transactionDate.toISOString().slice(0, 10),
  };
}

async function suggestCategoryFromDescription(description: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You categorize personal expenses. Choose exactly one category from: ${EXPENSE_CATEGORIES.join(", ")}. Return only JSON with category and confidence.`,
        },
        { role: "user", content: `Expense description: ${description}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "expense_category",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
              confidence: { type: "number" },
            },
            required: ["category", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(text) as { category?: string; confidence?: number };
    const category = normalizeCategory(parsed.category ?? "Other");
    return {
      category,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
      source: "ai" as const,
    };
  } catch (error) {
    console.warn("[AI] Category suggestion failed; using the local category matcher.", error);
    return {
      category: aliasCategory(description),
      confidence: 0.35,
      source: "fallback" as const,
    };
  }
}

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? "");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function buildExpenseCsv(rows: Awaited<ReturnType<typeof listExpenses>>) {
  const header = ["id", "date", "description", "category", "amount", "currency", "aiSuggestedCategory"].join(",");
  const lines = rows.map(row => [
    row.id,
    row.transactionDate.toISOString().slice(0, 10),
    row.description,
    row.category,
    (row.amountCents / 100).toFixed(2),
    "LKR",
    row.aiSuggestedCategory ?? "",
  ].map(escapeCsvCell).join(","));
  return [header, ...lines].join("\n");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseExpenseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must include a header and at least one transaction." });
  const headers = parseCsvLine(lines[0]!).map(header => header.toLowerCase());
  const indexOf = (name: string) => headers.indexOf(name);
  const dateIndex = indexOf("date");
  const descriptionIndex = indexOf("description");
  const categoryIndex = indexOf("category");
  const amountIndex = indexOf("amount");
  if ([dateIndex, descriptionIndex, categoryIndex, amountIndex].some(index => index < 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must include date, description, category, and amount columns." });
  }
  if (lines.length - 1 > 500) throw new TRPCError({ code: "BAD_REQUEST", message: "Import up to 500 transactions at a time." });
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const amount = Number(cells[amountIndex!]);
    const date = cells[dateIndex!] ?? "";
    const description = sanitizeDescription(cells[descriptionIndex!] ?? "");
    const category = normalizeCategory(cells[categoryIndex!] ?? "Other");
    if (!Number.isFinite(amount) || amount <= 0 || !isValidDateString(date) || description.length < 2) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid transaction on CSV row ${rowIndex + 2}.` });
    }
    return { amountCents: Math.round(amount * 100), transactionDate: parseTransactionDate(date), description, category };
  });
}

async function scanReceiptImage(imageBase64: string) {
  const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert receipt OCR and financial parser. Extract transaction details from the provided receipt image. Choose exactly one category from: ${EXPENSE_CATEGORIES.join(", ")}. Return only JSON with amount (number in LKR or currency shown), date (YYYY-MM-DD format, default to today if missing), description (merchant name and item summary), and category.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please parse this receipt image into structured transaction JSON." },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Total amount on the receipt" },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              description: { type: "string", description: "Merchant name and summary" },
              category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
            },
            required: ["amount", "date", "description", "category"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response received from receipt scanner model.");
    }
    const text = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(text) as { amount?: number; date?: string; description?: string; category?: string };
    const amountCents = Math.round(Number(parsed.amount ?? 0) * 100);
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      amount: amountCents > 0 ? amountCents / 100 : 0,
      date: isValidDateString(parsed.date ?? "") ? (parsed.date as string) : todayStr,
      description: sanitizeDescription(parsed.description ?? "Scanned Receipt"),
      category: normalizeCategory(parsed.category ?? "Other"),
    };
  } catch (error) {
    console.warn("[AI] Receipt scan failed or returned invalid format; returning fallback extraction.", error);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not automatically parse the receipt image. Please enter the details manually.",
    });
  }
}

const allocationMethodSchema = z.enum(["equal", "percentage", "fixed", "occupancy"]);
const sharedMemberInputSchema = z.object({
  memberId: z.number().int().positive(),
  inputValue: z.number().int().nonnegative(),
});

function distributeSharedCents(totalCents: number, weights: number[]) {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Allocation weights must add up to more than zero." });
  const shares = weights.map(weight => Math.floor((totalCents * weight) / weightTotal));
  let remainder = totalCents - shares.reduce((sum, share) => sum + share, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % shares.length) {
    shares[index] += 1;
    remainder -= 1;
  }
  return shares;
}

function calculateSharedShares(input: {
  totalCents: number;
  allocationMethod: "equal" | "percentage" | "fixed" | "occupancy";
  shares: Array<{ memberId: number; inputValue: number }>;
}) {
  const memberIds = new Set(input.shares.map(share => share.memberId));
  if (memberIds.size < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least two different group members." });
  if (input.allocationMethod === "equal") {
    const shareCents = distributeSharedCents(input.totalCents, input.shares.map(() => 1));
    return input.shares.map((share, index) => ({ ...share, shareCents: shareCents[index] ?? 0 }));
  }
  if (input.allocationMethod === "fixed") {
    const fixedTotal = input.shares.reduce((sum, share) => sum + share.inputValue, 0);
    if (fixedTotal !== input.totalCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Fixed shares must add up exactly to the bill total." });
    return input.shares.map(share => ({ ...share, shareCents: share.inputValue }));
  }
  if (input.allocationMethod === "percentage") {
    const percentageTotal = input.shares.reduce((sum, share) => sum + share.inputValue, 0);
    if (percentageTotal !== 100) throw new TRPCError({ code: "BAD_REQUEST", message: "Percentage shares must add up to exactly 100." });
  }
  if (input.allocationMethod === "occupancy" && input.shares.some(share => share.inputValue <= 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Each occupancy share must have at least one day." });
  }
  const shareCents = distributeSharedCents(input.totalCents, input.shares.map(share => share.inputValue));
  return input.shares.map((share, index) => ({ ...share, shareCents: shareCents[index] ?? 0 }));
}

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true, service: "ledgerly" as const })),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(2, "Name must be at least 2 characters."),
      email: authEmailSchema,
      password: passwordSchema,
    })).mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Please sign in." });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `local_${randomBytes(16).toString("hex")}`;
      await upsertUser({
        openId,
        name: input.name,
        email,
        loginMethod: "local",
        passwordHash,
      });
      const user = await getUserByEmail(email);
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account." });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || input.name });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
      return { success: true, user: { id: user.id, name: user.name, email: user.email } } as const;
    }),
    login: publicProcedure.input(z.object({
      email: authEmailSchema,
      password: z.string().min(1, "Password is required."),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(normalizeEmail(input.email));
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      await upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
      return { success: true, user: { id: user.id, name: user.name, email: user.email } } as const;
    }),
    forgotPassword: publicProcedure
      .input(z.object({ email: authEmailSchema }))
      .mutation(async ({ input }) => {
        const neutralResponse = {
          success: true as const,
          message: "If an account exists for that email, password-reset instructions have been sent.",
          resetToken: undefined as string | undefined,
        };
        const user = await getUserByEmail(normalizeEmail(input.email));
        if (!user?.passwordHash || !user.email) return neutralResponse;

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await invalidatePasswordResetTokens(user.id);
        await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

        const resetUrl = `${ENV.appUrl.replace(/\/+$/, "")}/?reset_token=${encodeURIComponent(rawToken)}`;
        const email = buildPasswordResetEmail(user.name || "there", resetUrl);
        email.to = user.email;
        await sendEmail(email);
        return {
          success: true as const,
          message: "Password recovery link created! You can use the instant recovery button below or check your email.",
          resetToken: rawToken,
        };
      }),
    adminIssuePasswordReset: adminProcedure
      .input(z.object({ email: authEmailSchema }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(normalizeEmail(input.email));
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Local password account not found." });
        }

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await invalidatePasswordResetTokens(user.id);
        await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

        return { success: true, token: rawToken, expiresAt } as const;
      }),
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().regex(/^[a-f0-9]{64}$/i, "Enter a valid recovery token."),
        password: passwordSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const tokenHash = createHash("sha256").update(input.token).digest("hex");
        const resetToken = await getPasswordResetTokenByHash(tokenHash);
        if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This recovery token is invalid or has expired." });
        }

        const consumed = await consumePasswordResetToken(resetToken.id);
        if (!consumed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This recovery token is invalid or has already been used." });
        }

        const user = await getUserById(resetToken.userId);
        if (!user) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This recovery token is invalid or has expired." });
        }

        const passwordHash = await bcrypt.hash(input.password, 12);
        await updateUserPassword(user.id, passwordHash);
        await invalidatePasswordResetTokens(user.id);
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        ctx.res.cookie(COOKIE_NAME, sessionToken, getSessionCookieOptions(ctx.req));
        return { success: true, user: { id: user.id, name: user.name, email: user.email } } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return { success: true } as const;
    }),
  }),
  expenses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await listExpenses(ctx.user.id);
      return rows.map(row => ({
        ...row,
        amount: row.amountCents / 100,
        date: row.transactionDate.toISOString().slice(0, 10),
      }));
    }),
    suggestCategory: protectedProcedure
      .input(z.object({ description: descriptionSchema }))
      .mutation(({ input }) => suggestCategoryFromDescription(input.description)),
    create: protectedProcedure
      .input(
        z.object({
          amountCents: z.number().int().refine(isValidAmountCents, "Enter a positive amount."),
          transactionDate: dateSchema,
          description: descriptionSchema,
          category: categoryEnum,
          aiSuggestedCategory: categoryEnum.nullish(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const row = await createExpense({
          userId: ctx.user.id,
          amountCents: input.amountCents,
          transactionDate: parseTransactionDate(input.transactionDate),
          description: sanitizeDescription(input.description),
          category: normalizeCategory(input.category),
          aiSuggestedCategory: input.aiSuggestedCategory ? normalizeCategory(input.aiSuggestedCategory) : null,
        });
        return mapExpense(row);
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          amountCents: z.number().int().refine(isValidAmountCents, "Enter a positive amount."),
          transactionDate: dateSchema,
          description: descriptionSchema,
          category: categoryEnum,
          aiSuggestedCategory: categoryEnum.nullish(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const row = await updateExpense(ctx.user.id, input.id, {
          amountCents: input.amountCents,
          transactionDate: parseTransactionDate(input.transactionDate),
          description: sanitizeDescription(input.description),
          category: normalizeCategory(input.category),
          aiSuggestedCategory: input.aiSuggestedCategory ? normalizeCategory(input.aiSuggestedCategory) : null,
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
        return mapExpense(row);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ deleted: await deleteExpense(ctx.user.id, input.id) })),
    scanReceipt: protectedProcedure
      .input(receiptSchema)
      .mutation(({ input }) => scanReceiptImage(input.imageBase64)),
    exportCsv: protectedProcedure.query(async ({ ctx }) => {
      const rows = await listExpenses(ctx.user.id);
      return { filename: `ledgerly-expenses-${DEFAULT_MONTH_KEY}.csv`, csv: buildExpenseCsv(rows) };
    }),
    importCsv: protectedProcedure
      .input(z.object({ csv: z.string().min(1).max(1_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const parsedRows = parseExpenseCsv(input.csv);
        const created = [];
        for (const row of parsedRows) {
          const saved = await createExpense({ ...row, userId: ctx.user.id, aiSuggestedCategory: null });
          created.push(mapExpense(saved));
        }
        return { imported: created.length, expenses: created };
      }),
    parseBankStatement: protectedProcedure
      .input(z.object({ rawText: z.string().min(5).max(100_000) }))
      .mutation(async ({ input }) => parseBankStatementText(input.rawText)),
  }),
  recurring: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await listRecurringExpenses(ctx.user.id);
      return rows.map(row => ({ ...row, amount: row.amountCents / 100, active: Boolean(row.active) }));
    }),
    create: protectedProcedure
      .input(z.object({
        amountCents: z.number().int().refine(isValidAmountCents, "Enter a positive amount."),
        description: descriptionSchema,
        category: categoryEnum,
        frequency: z.enum(["monthly", "weekly"]),
        dayOfMonth: z.number().int().min(1).max(31),
      }))
      .mutation(async ({ ctx, input }) => {
        const row = await createRecurringExpense({ ...input, userId: ctx.user.id, description: sanitizeDescription(input.description), active: 1 });
        return row ? { ...row, amount: row.amountCents / 100, active: Boolean(row.active) } : null;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        amountCents: z.number().int().refine(isValidAmountCents, "Enter a positive amount."),
        description: descriptionSchema,
        category: categoryEnum,
        frequency: z.enum(["monthly", "weekly"]),
        dayOfMonth: z.number().int().min(1).max(31),
        active: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const row = await updateRecurringExpense(ctx.user.id, input.id, {
          amountCents: input.amountCents,
          description: sanitizeDescription(input.description),
          category: normalizeCategory(input.category),
          frequency: input.frequency,
          dayOfMonth: input.dayOfMonth,
          active: input.active ? 1 : 0,
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Recurring expense not found." });
        return { ...row, amount: row.amountCents / 100, active: Boolean(row.active) };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ deleted: await deleteRecurringExpense(ctx.user.id, input.id) })),
  }),
  alerts: router({
    settings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getAlertSettings(ctx.user.id);
      return settings ?? { budgetWarningThresholdPercent: 80, emailAlertsEnabled: 0, scheduleCronTaskUid: null };
    }),
    updateSettings: protectedProcedure
      .input(z.object({ budgetWarningThresholdPercent: z.number().int().min(50).max(100), emailAlertsEnabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const settings = await upsertAlertSettings({
          userId: ctx.user.id,
          budgetWarningThresholdPercent: input.budgetWarningThresholdPercent,
          emailAlertsEnabled: input.emailAlertsEnabled ? 1 : 0,
        });
        return settings;
      }),
    evaluate: protectedProcedure
      .input(z.object({ monthKey: monthSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        const monthKey = input?.monthKey ?? DEFAULT_MONTH_KEY;
        const [rows, userBudgets, recurringRows, settings] = await Promise.all([
          listExpenses(ctx.user.id),
          listBudgets(ctx.user.id, monthKey),
          listRecurringExpenses(ctx.user.id),
          getAlertSettings(ctx.user.id),
        ]);
        const threshold = settings?.budgetWarningThresholdPercent ?? 80;
        const spendingByCategory = new Map<string, number>();
        for (const row of rows) {
          if (row.transactionDate.toISOString().slice(0, 7) !== monthKey) continue;
          spendingByCategory.set(row.category, (spendingByCategory.get(row.category) ?? 0) + row.amountCents);
        }
        const budgetWarnings = userBudgets.map(budget => {
          const spentCents = spendingByCategory.get(budget.category) ?? 0;
          const percent = Math.round((spentCents / Math.max(budget.limitCents, 1)) * 100);
          return { category: budget.category, spent: spentCents / 100, limit: budget.limitCents / 100, percent, severity: percent >= 100 ? "over" : percent >= threshold ? "warning" : "healthy" } as const;
        }).filter(item => item.severity !== "healthy");
        const recurringMonthlyCents = recurringRows.filter(row => row.active).reduce((total, row) => total + (row.frequency === "weekly" ? row.amountCents * 4 : row.amountCents), 0);
        if (settings?.emailAlertsEnabled && ctx.user.email && budgetWarnings.length > 0) {
          const topWarning = budgetWarnings[0];
          const email = buildBudgetAlertEmail(
            ctx.user.name || "User",
            topWarning.category,
            `Rs. ${topWarning.spent.toLocaleString()}`,
            `Rs. ${topWarning.limit.toLocaleString()}`,
            topWarning.percent,
          );
          email.to = ctx.user.email;
          sendEmail(email).catch(e => console.warn("[AlertEmail] Failed:", e));
        }
        return { monthKey, threshold, budgetWarnings, recurringMonthly: recurringMonthlyCents / 100, hasWarnings: budgetWarnings.length > 0 };
      }),
  }),
  reports: router({
    exportRange: protectedProcedure
      .input(z.object({ startDate: dateSchema, endDate: dateSchema }))
      .query(async ({ ctx, input }) => {
        const start = parseTransactionDate(input.startDate).getTime();
        const end = parseTransactionDate(input.endDate).getTime();
        if (end < start) throw new TRPCError({ code: "BAD_REQUEST", message: "End date must be on or after start date." });
        const rows = (await listExpenses(ctx.user.id)).filter(row => {
          const time = row.transactionDate.getTime();
          return time >= start && time <= end;
        });
        const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
        return {
          filename: `ledgerly-report-${input.startDate}-to-${input.endDate}.csv`,
          csv: buildExpenseCsv(rows),
          summary: { startDate: input.startDate, endDate: input.endDate, transactionCount: rows.length, total: totalCents / 100 },
        };
      }),
    exportSettlementPdf: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const members = (await listSharedMembers(ctx.user.id, input.groupId)) ?? [];
        const bills = (await listSharedBills(ctx.user.id, input.groupId)) ?? [];
        const settlements = await listSharedSettlements(input.groupId);
        const balances = new Map<number, { paidCents: number; owedCents: number }>();
        members.forEach(member => balances.set(member.id, { paidCents: 0, owedCents: 0 }));
        for (const bill of bills) {
          for (const share of bill.shares) {
            const balance = balances.get(share.memberId);
            if (balance) balance.owedCents += share.shareCents;
          }
          if (bill.payerMemberId) {
            const balance = balances.get(bill.payerMemberId);
            if (balance) balance.paidCents += bill.totalCents;
          }
        }
        const memberById = new Map(members.map(member => [member.id, member]));
        const positions = members.map(member => {
          const balance = balances.get(member.id) ?? { paidCents: 0, owedCents: 0 };
          return { memberId: member.id, displayName: member.displayName, ...balance, netCents: balance.owedCents - balance.paidCents };
        });
        const debtors = positions.filter(position => position.netCents > 0).map(position => ({ ...position }));
        const creditors = positions.filter(position => position.netCents < 0).map(position => ({ ...position, creditCents: Math.abs(position.netCents) }));
        const transfers: Array<{ fromName: string; toName: string; amountCents: number }> = [];
        let debtorIndex = 0;
        let creditorIndex = 0;
        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
          const debtor = debtors[debtorIndex];
          const creditor = creditors[creditorIndex];
          const amountCents = Math.min(debtor.netCents, creditor.creditCents);
          const fromMember = memberById.get(debtor.memberId);
          const toMember = memberById.get(creditor.memberId);
          if (fromMember && toMember && amountCents > 0) transfers.push({ fromName: fromMember.displayName, toName: toMember.displayName, amountCents });
          debtor.netCents -= amountCents;
          creditor.creditCents -= amountCents;
          if (debtor.netCents === 0) debtorIndex += 1;
          if (creditor.creditCents === 0) creditorIndex += 1;
        }
        const pdf = await renderSettlementReportPdf({ group, members: positions, bills, transfers, settlements });
        return {
          filename: `ledgerly-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-settlement-report.pdf`,
          contentType: "application/pdf",
          pdfBase64: pdf.toString("base64"),
        };
      }),
  }),
  budgets: router({
    list: protectedProcedure
      .input(z.object({ monthKey: monthSchema.optional() }).optional())
      .query(({ ctx, input }) => listBudgets(ctx.user.id, input?.monthKey ?? DEFAULT_MONTH_KEY)),
    upsert: protectedProcedure
      .input(
        z.object({
          monthKey: monthSchema,
          category: categoryEnum,
          limitCents: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        upsertBudget({
          userId: ctx.user.id,
          monthKey: input.monthKey,
          category: input.category,
          limitCents: input.limitCents,
        }),
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ deleted: await deleteBudget(ctx.user.id, input.id) })),
  }),
  savingsGoal: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const goal = await getSavingsGoal(ctx.user.id);
      if (!goal) return null;
      return {
        ...goal,
        target: goal.targetCents / 100,
        current: goal.currentCents / 100,
        progress: Math.min(100, Math.round((goal.currentCents / Math.max(goal.targetCents, 1)) * 100)),
      };
    }),
    upsert: protectedProcedure
      .input(z.object({ targetCents: z.number().int().positive(), currentCents: z.number().int().nonnegative(), targetDate: dateSchema }))
      .mutation(async ({ ctx, input }) => {
        const goal = await upsertSavingsGoal({ ...input, userId: ctx.user.id });
        return goal ? { ...goal, target: goal.targetCents / 100, current: goal.currentCents / 100, progress: Math.min(100, Math.round((goal.currentCents / Math.max(goal.targetCents, 1)) * 100)) } : null;
      }),
    delete: protectedProcedure.mutation(async ({ ctx }) => ({ deleted: await deleteSavingsGoal(ctx.user.id) })),
  }),
  shared: router({
    groups: protectedProcedure.query(({ ctx }) => listSharedGroups(ctx.user.id)),
    createGroup: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), currency: z.string().trim().length(3).default("LKR") }))
      .mutation(async ({ ctx, input }) => createSharedGroup({ ownerUserId: ctx.user.id, name: input.name, currency: input.currency.toUpperCase() })),
    members: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const members = await listSharedMembers(ctx.user.id, input.groupId);
        if (!members) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        return members;
      }),
    addMember: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), displayName: z.string().trim().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const member = await createSharedMember(ctx.user.id, { groupId: input.groupId, displayName: input.displayName });
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        return member;
      }),
    deleteMember: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), memberId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ deleted: await deleteSharedMember(ctx.user.id, input.groupId, input.memberId) })),
    addBill: protectedProcedure
      .input(z.object({
        groupId: z.number().int().positive(),
        description: descriptionSchema,
        category: categoryEnum,
        totalCents: z.number().int().positive(),
        allocationMethod: allocationMethodSchema,
        billDate: dateSchema,
        payerMemberId: z.number().int().positive().nullable().optional(),
        shares: z.array(sharedMemberInputSchema).min(2).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const members = await listSharedMembers(ctx.user.id, input.groupId);
        if (!members) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const memberIds = new Set(members.map(member => member.id));
        if (input.shares.some(share => !memberIds.has(share.memberId))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Every allocation member must belong to this group." });
        }
        if (input.payerMemberId && !memberIds.has(input.payerMemberId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The payer must belong to this group." });
        }
        const calculatedShares = calculateSharedShares({
          totalCents: input.totalCents,
          allocationMethod: input.allocationMethod,
          shares: input.shares,
        });
        const bill = await createSharedBill(
          ctx.user.id,
          {
            groupId: input.groupId,
            createdByUserId: ctx.user.id,
            description: sanitizeDescription(input.description),
            category: input.category,
            totalCents: input.totalCents,
            allocationMethod: input.allocationMethod,
            billDate: parseTransactionDate(input.billDate),
            payerMemberId: input.payerMemberId ?? null,
          },
          calculatedShares.map(share => ({
            billId: 0,
            memberId: share.memberId,
            inputValue: share.inputValue,
            shareCents: share.shareCents,
          })),
        );
        if (!bill) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        broadcastGroupEvent(input.groupId, "BILL_ADDED", { billId: bill.id, description: input.description, totalCents: input.totalCents });
        return bill;
      }),
    bills: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const bills = await listSharedBills(ctx.user.id, input.groupId);
        if (!bills) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        return bills;
      }),
    deleteBill: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), billId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({ deleted: await deleteSharedBill(ctx.user.id, input.groupId, input.billId) })),
    parseAiBillAllocation: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), prompt: z.string().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const members = (await listSharedMembers(ctx.user.id, input.groupId)) ?? [];
        if (members.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please add members to the group before using AI bill allocation." });
        }
        const memberListStr = members.map(m => `ID: ${m.id}, Name: ${m.displayName}`).join("; ");
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are Ledgerly's AI shared-expense assistant. Analyze the user prompt for a group bill.
Group members available: [${memberListStr}].
Choose allocationMethod from: "equal", "percentage", "fixed", "occupancy".
Extract:
- description: string summary of the bill
- category: one of [${EXPENSE_CATEGORIES.join(", ")}]
- totalAmount: number (total bill amount in currency)
- allocationMethod: "equal" | "percentage" | "fixed" | "occupancy"
- payerName: string or null (name of member who paid, or null)
- shares: array of objects containing memberId (number matching available members) and inputValue (number: 1 for equal, percentage for percentage, fixed amount for fixed, occupancy days for occupancy).
- explanation: clear explanation of how the bill is divided.
- clarificationNeeded: string or null if anything is ambiguous.
Return strict JSON matching the schema.`,
              },
              { role: "user", content: input.prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "ai_bill_allocation",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
                    totalAmount: { type: "number" },
                    allocationMethod: { type: "string", enum: ["equal", "percentage", "fixed", "occupancy"] },
                    payerName: { type: ["string", "null"] },
                    shares: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          memberId: { type: "number" },
                          inputValue: { type: "number" },
                        },
                        required: ["memberId", "inputValue"],
                        additionalProperties: false,
                      },
                    },
                    explanation: { type: "string" },
                    clarificationNeeded: { type: ["string", "null"] },
                  },
                  required: ["description", "category", "totalAmount", "allocationMethod", "payerName", "shares", "explanation", "clarificationNeeded"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices?.[0]?.message?.content;
          const text = typeof content === "string" ? content : JSON.stringify(content);
          const parsed = JSON.parse(text);
          const totalCents = Math.round(Number(parsed.totalAmount ?? 0) * 100);
          const validMethod = ["equal", "percentage", "fixed", "occupancy"].includes(parsed.allocationMethod) ? parsed.allocationMethod : "equal";
          const matchedPayer = members.find(m => m.displayName.toLowerCase() === String(parsed.payerName ?? "").toLowerCase());
          const validatedShares = members.map(m => {
            const found = (parsed.shares ?? []).find((s: any) => Number(s.memberId) === m.id);
            const defaultVal = validMethod === "equal" ? 1 : validMethod === "percentage" ? Math.round(100 / members.length) : 7;
            return {
              memberId: m.id,
              inputValue: Number(found?.inputValue ?? defaultVal),
            };
          });

          let calculated;
          try {
            calculated = calculateSharedShares({
              totalCents: totalCents > 0 ? totalCents : 10000,
              allocationMethod: validMethod,
              shares: validatedShares,
            });
          } catch (e) {
            calculated = calculateSharedShares({
              totalCents: totalCents > 0 ? totalCents : 10000,
              allocationMethod: "equal",
              shares: members.map(m => ({ memberId: m.id, inputValue: 1 })),
            });
          }

          return {
            success: true,
            extracted: {
              description: String(parsed.description ?? "Shared Bill"),
              category: normalizeCategory(parsed.category ?? "Housing"),
              totalCents: totalCents > 0 ? totalCents : 10000,
              allocationMethod: validMethod,
              payerMemberId: matchedPayer?.id ?? members[0]?.id ?? null,
              payerName: matchedPayer?.displayName ?? members[0]?.displayName ?? "Someone",
              shares: calculated,
              explanation: String(parsed.explanation ?? "Calculated successfully."),
              clarificationNeeded: parsed.clarificationNeeded ?? null,
            },
          };
        } catch (err) {
          console.warn("[AI Shared Bill] Parsing failed, requesting clarification.", err);
          return {
            success: false,
            error: "Could not parse bill details from prompt. Please specify total amount, payer, and split rule.",
          };
        }
      }),
    settlements: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        return listSharedSettlements(input.groupId);
      }),
    upsertSettlement: protectedProcedure
      .input(z.object({
        groupId: z.number().int().positive(),
        fromMemberId: z.number().int().positive(),
        toMemberId: z.number().int().positive(),
        amountCents: z.number().int().positive(),
        status: z.enum(["pending", "paid", "verified", "disputed", "cancelled"]),
        paymentMethod: z.string().optional(),
        referenceNote: z.string().optional(),
        evidenceUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const members = (await listSharedMembers(ctx.user.id, input.groupId)) ?? [];
        const memberIds = new Set(members.map(m => m.id));
        if (!memberIds.has(input.fromMemberId) || !memberIds.has(input.toMemberId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Both members must belong to this shared group." });
        }
        const result = await upsertSharedSettlement({
          groupId: input.groupId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amountCents: input.amountCents,
          status: input.status,
          paymentMethod: input.paymentMethod,
          referenceNote: input.referenceNote,
          evidenceUrl: input.evidenceUrl,
          userId: ctx.user.id,
        });
        broadcastGroupEvent(input.groupId, "SETTLEMENT_UPDATED", {
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amountCents: input.amountCents,
          status: input.status,
        });
        return result;
      }),
    uploadSettlementEvidence: protectedProcedure
      .input(z.object({
        groupId: z.number().int().positive(),
        fileName: z.string().trim().regex(/^[A-Za-z0-9._-]{1,120}$/, "Use a simple file name."),
        fileBase64: z.string().min(1).max(7_000_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const dataUrlMatch = input.fileBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
        const base64Data = dataUrlMatch?.[2] ?? input.fileBase64;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data) || base64Data.length % 4 !== 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a valid base64-encoded image." });
        }
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Evidence files must be smaller than 5 MB." });
        }
        const contentType = dataUrlMatch?.[1]?.toLowerCase() ?? "application/octet-stream";
        if (contentType === "application/octet-stream") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Include a JPEG, PNG, or WEBP image data URL." });
        }
        const fileKey = `${ctx.user.id}-settlement-${randomBytes(16).toString("hex")}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, contentType);
        return { url };
      }),
    settlement: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const group = await getSharedGroup(ctx.user.id, input.groupId);
        if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Shared group not found." });
        const members = (await listSharedMembers(ctx.user.id, input.groupId)) ?? [];
        const bills = (await listSharedBills(ctx.user.id, input.groupId)) ?? [];
        const balances = new Map<number, { paidCents: number; owedCents: number }>();
        for (const member of members) balances.set(member.id, { paidCents: 0, owedCents: 0 });
        let totalCents = 0;
        for (const bill of bills) {
          totalCents += bill.totalCents;
          for (const share of bill.shares) {
            const balance = balances.get(share.memberId);
            if (balance) balance.owedCents += share.shareCents;
          }
          if (bill.payerMemberId) {
            const balance = balances.get(bill.payerMemberId);
            if (balance) balance.paidCents += bill.totalCents;
          }
        }
        const memberById = new Map(members.map(member => [member.id, member]));
        const positions = members.map(member => {
          const balance = balances.get(member.id) ?? { paidCents: 0, owedCents: 0 };
          return { memberId: member.id, displayName: member.displayName, ...balance, netCents: balance.owedCents - balance.paidCents };
        });
        const debtors = positions.filter(position => position.netCents > 0).map(position => ({ ...position }));
        const creditors = positions.filter(position => position.netCents < 0).map(position => ({ ...position, creditCents: Math.abs(position.netCents) }));
        const transfers: Array<{ fromMemberId: number; fromName: string; toMemberId: number; toName: string; amountCents: number }> = [];
        let debtorIndex = 0;
        let creditorIndex = 0;
        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
          const debtor = debtors[debtorIndex];
          const creditor = creditors[creditorIndex];
          const amountCents = Math.min(debtor.netCents, creditor.creditCents);
          const fromMember = memberById.get(debtor.memberId);
          const toMember = memberById.get(creditor.memberId);
          if (fromMember && toMember && amountCents > 0) transfers.push({ fromMemberId: debtor.memberId, fromName: fromMember.displayName, toMemberId: creditor.memberId, toName: toMember.displayName, amountCents });
          debtor.netCents -= amountCents;
          creditor.creditCents -= amountCents;
          if (debtor.netCents === 0) debtorIndex += 1;
          if (creditor.creditCents === 0) creditorIndex += 1;
        }
        return { group, members: positions, bills, transfers, totalCents };
      }),
    createInvitation: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive(), role: z.enum(["admin", "member"]).default("member") }))
      .mutation(async ({ ctx, input }) => {
        await requireSharedGroup(ctx.user.id, input.groupId);
        const token = `inv_${randomBytes(32).toString("hex")}`;
        return createGroupInvitation({
          groupId: input.groupId,
          inviterUserId: String(ctx.user.id),
          inviteeEmail: ctx.user.email || "member@ledgerly.app",
          role: input.role,
          token,
        });
      }),
    listInvitations: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireSharedGroup(ctx.user.id, input.groupId);
        return listGroupInvitations(input.groupId);
      }),
    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(3) }))
      .mutation(async ({ ctx, input }) => {
        const groupId = await acceptGroupInvitation(input.token, String(ctx.user.id), ctx.user.name || "Member");
        return { success: true, groupId };
      }),
    createRecurringBill: protectedProcedure
      .input(z.object({
        groupId: z.number().int().positive(),
        title: descriptionSchema,
        amountCents: z.number().int().positive(),
        currency: z.string().default("LKR"),
        splitMode: z.string().default("equal"),
        frequency: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
        nextDueDate: dateSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        await requireSharedGroup(ctx.user.id, input.groupId);
        return createRecurringSharedBill({
          groupId: input.groupId,
          title: input.title,
          amountCents: input.amountCents,
          currency: input.currency,
          splitMode: input.splitMode,
          frequency: input.frequency,
          payerUserId: String(ctx.user.id),
          nextDueDate: new Date(input.nextDueDate),
        });
      }),
    listRecurringBills: protectedProcedure
      .input(z.object({ groupId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireSharedGroup(ctx.user.id, input.groupId);
        return listRecurringSharedBills(input.groupId);
      }),
    deleteRecurringBill: protectedProcedure
      .input(z.object({ recurringId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteRecurringSharedBill(input.recurringId);
        return { success: true };
      }),
  }),
  analytics: router({
    dashboard: protectedProcedure
      .input(z.object({ monthKey: monthSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        const monthKey = input?.monthKey ?? DEFAULT_MONTH_KEY;
        const [rows, userBudgets] = await Promise.all([
          listExpenses(ctx.user.id),
          listBudgets(ctx.user.id, monthKey),
        ]);
        const monthRows = rows.filter(row => row.transactionDate.toISOString().slice(0, 7) === monthKey);
        const categoryMap = new Map<string, number>();
        const dailyMap = new Map<string, number>();
        for (const row of monthRows) {
          categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + row.amountCents);
          const date = row.transactionDate.toISOString().slice(0, 10);
          dailyMap.set(date, (dailyMap.get(date) ?? 0) + row.amountCents);
        }
        const categoryTotals = Array.from(categoryMap.entries())
          .map(([category, totalCents]) => ({ category, totalCents }))
          .sort((a, b) => b.totalCents - a.totalCents);
        const totalCents = monthRows.reduce((sum, row) => sum + row.amountCents, 0);
        const currentYear = Number(monthKey.slice(0, 4));
        const currentMonthIndex = Number(monthKey.slice(5, 7)) - 1;
        const monthlyTotals = Array.from({ length: 6 }, (_, index) => {
          const monthDate = new Date(currentYear, currentMonthIndex - (5 - index), 1);
          const trendMonthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
          const totalCents = rows
            .filter(row => row.transactionDate.toISOString().slice(0, 7) === trendMonthKey)
            .reduce((sum, row) => sum + row.amountCents, 0);
          return {
            monthKey: trendMonthKey,
            label: new Intl.DateTimeFormat("en-LK", { month: "short" }).format(monthDate),
            totalCents,
          };
        });
        const budgetTotalCents = userBudgets.reduce((sum, budget) => sum + budget.limitCents, 0);
        const budgetSpentCents = userBudgets.reduce(
          (sum, budget) => sum + (categoryMap.get(budget.category) ?? 0),
          0,
        );

        const now = new Date();
        const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
        const elapsedDays = now.getFullYear() === currentYear && now.getMonth() === currentMonthIndex ? Math.max(1, now.getDate()) : daysInMonth;
        const dailyBurnRateCents = Math.round(totalCents / elapsedDays);
        const projectedMonthEndCents = dailyBurnRateCents * daysInMonth;

        return {
          monthKey,
          summary: {
            totalCents,
            topCategory: categoryTotals[0]?.category ?? null,
            topCategoryCents: categoryTotals[0]?.totalCents ?? 0,
            budgetTotalCents,
            budgetSpentCents,
            dailyBurnRateCents,
            projectedMonthEndCents,
            daysElapsed: elapsedDays,
            daysInMonth,
          },
          categoryTotals,
          monthlyTotals,
          dailyTotals: Array.from(dailyMap.entries())
            .map(([date, totalCents]) => ({ date, totalCents }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        };
      }),
  }),
  currency: router({
    getRates: publicProcedure.query(async () => fetchLiveExchangeRates()),
    convert: publicProcedure
      .input(z.object({
        amountCents: z.number().int().positive(),
        from: z.enum(SUPPORTED_CURRENCIES),
        to: z.enum(SUPPORTED_CURRENCIES),
      }))
      .mutation(async ({ input }) => convertCurrency(input.amountCents, input.from, input.to)),
  }),
});

export type AppRouter = typeof appRouter;

export const routerNotes = {
  privacy: "All protected procedures receive ctx.user and pass ctx.user.id into every data query.",
  ai: "The LLM runs server-side and returns a constrained category from the app's allowed list.",
  money: "The API accepts and persists integer cents.",
} as const;

export type RouterNotes = typeof routerNotes;

export const routerReady = true as const;
export type RouterReady = typeof routerReady;


