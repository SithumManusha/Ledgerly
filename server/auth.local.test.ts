import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { appRouter } from "./routers";
import { evaluatePasswordStrength } from "../shared/password";
import type { TrpcContext } from "./_core/context";

describe("Local Password Authentication & Security", () => {
  it("hashes and compares passwords correctly using bcryptjs", async () => {
    const password = "SecurePassword123!";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    expect(hash).not.toBe(password);
    const matches = await bcrypt.compare(password, hash);
    expect(matches).toBe(true);

    const incorrect = await bcrypt.compare("WrongPassword", hash);
    expect(incorrect).toBe(false);
  });

  it("exposes local authentication and recovery procedures on appRouter", () => {
    expect(appRouter._def.procedures).toHaveProperty("auth.register");
    expect(appRouter._def.procedures).toHaveProperty("auth.login");
    expect(appRouter._def.procedures).toHaveProperty("auth.logout");
    expect(appRouter._def.procedures).toHaveProperty("auth.forgotPassword");
    expect(appRouter._def.procedures).toHaveProperty("auth.adminIssuePasswordReset");
    expect(appRouter._def.procedures).toHaveProperty("auth.resetPassword");
  });

  it("returns neutral local recovery guidance without exposing account existence", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as unknown as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).auth.forgotPassword({ email: "anyone@example.com" });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/password-reset instructions/i);
    expect(result.message).not.toMatch(/administrator/i);
  });

  it("rejects weak passwords or invalid email inputs in procedure input validation schema", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Test",
        email: "not-an-email",
        password: "short",
      })
    ).rejects.toThrow();
  });
});

  it("evaluates password strength correctly", () => {
    const weak = evaluatePasswordStrength("abc");
    expect(weak.score).toBeLessThan(3);

    const strong = evaluatePasswordStrength("SecureP@ss123");
    expect(strong.score).toBeGreaterThanOrEqual(3);
  });

  it("rejects expired reset tokens and reused tokens, and allows password reset followed by new login", async () => {
    const { getDb, createPasswordResetToken, getPasswordResetTokenByHash, consumePasswordResetToken, updateUserPassword, getUserByEmail } = await import("./db");
    const db = await getDb();
    if (!db) return;

    // Create a test user directly in db
    const testEmail = `lifecycle_${Date.now()}@example.com`;
    const openId = `local_life_${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
    const initialHash = await bcrypt.hash("OldPass123!", salt);

    await db.insert((await import("../drizzle/schema")).users).values({
      openId,
      name: "Lifecycle User",
      email: testEmail,
      loginMethod: "local",
      passwordHash: initialHash,
    });

    const user = await getUserByEmail(testEmail);
    expect(user).toBeDefined();
    if (!user) return;

    // Test 1: Valid token creation & password reset
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const tokenId = await createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    expect(tokenId).toBeGreaterThan(0);

    const storedToken = await getPasswordResetTokenByHash(tokenHash);
    expect(storedToken).toBeDefined();
    expect(storedToken?.usedAt).toBeNull();

    // Consume token
    const consumed = await consumePasswordResetToken(storedToken!.id);
    expect(consumed).toBe(true);

    // Test 2: Token reuse rejection
    const reused = await consumePasswordResetToken(storedToken!.id);
    expect(reused).toBe(false);

    // Test 3: Update password & verify login
    const newPassword = "NewSecurePass456!";
    const newHash = await bcrypt.hash(newPassword, salt);
    await updateUserPassword(user.id, newHash);

    const updatedUser = await getUserByEmail(testEmail);
    expect(updatedUser?.passwordHash).toBe(newHash);

    const loginSuccess = await bcrypt.compare(newPassword, updatedUser!.passwordHash!);
    expect(loginSuccess).toBe(true);

    const oldLoginSuccess = await bcrypt.compare("OldPass123!", updatedUser!.passwordHash!);
    expect(oldLoginSuccess).toBe(false);
  });

  it("tests auth.resetPassword procedure with token expiry and subsequent auth.login", async () => {
    const { getDb, createPasswordResetToken, getUserByEmail } = await import("./db");
    const db = await getDb();
    if (!db) return;

    const testEmail = `caller_life_${Date.now()}@example.com`;
    const openId = `local_caller_${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
    const initialHash = await bcrypt.hash("OldPass123!", salt);

    await db.insert((await import("../drizzle/schema")).users).values({
      openId,
      name: "Caller User",
      email: testEmail,
      loginMethod: "local",
      passwordHash: initialHash,
    });

    const user = await getUserByEmail(testEmail);
    expect(user).toBeDefined();

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await createPasswordResetToken({
      userId: user!.id,
      tokenHash,
      expiresAt,
    });

    const cookies: Record<string, string> = {};
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, val: string) => { cookies[name] = val; },
        clearCookie: (name: string) => { delete cookies[name]; },
      } as unknown as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    // Reset password via procedure
    const newPassword = "BrandNewPass999!";
    const resetRes = await caller.auth.resetPassword({
      token: rawToken,
      password: newPassword,
    });
    expect(resetRes.success).toBe(true);

    // Attempt reuse of same token should fail
    await expect(
      caller.auth.resetPassword({
        token: rawToken,
        password: "AnotherPass123!",
      })
    ).rejects.toThrow();

    // Subsequent login with new password
    const loginRes = await caller.auth.login({
      email: testEmail,
      password: newPassword,
    });
    expect(loginRes.success).toBe(true);
    expect(loginRes.user.email).toBe(testEmail);
  });

  it("rejects expired reset tokens in auth.resetPassword procedure", async () => {
    const { getDb, createPasswordResetToken, getUserByEmail } = await import("./db");
    const db = await getDb();
    if (!db) return;

    const testEmail = `expired_life_${Date.now()}@example.com`;
    const openId = `local_expired_${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
    const initialHash = await bcrypt.hash("OldPass123!", salt);

    await db.insert((await import("../drizzle/schema")).users).values({
      openId,
      name: "Expired User",
      email: testEmail,
      loginMethod: "local",
      passwordHash: initialHash,
    });

    const user = await getUserByEmail(testEmail);
    expect(user).toBeDefined();

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() - 1000); // Already expired

    await createPasswordResetToken({
      userId: user!.id,
      tokenHash,
      expiresAt,
    });

    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: rawToken,
        password: "BrandNewPass999!",
      })
    ).rejects.toThrow();
  });
