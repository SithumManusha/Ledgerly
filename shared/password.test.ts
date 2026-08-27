import { describe, expect, it } from "vitest";
import {
  evaluatePasswordStrength,
  isPasswordAcceptable,
  passwordStrengthChecks,
} from "./password";

describe("password-strength policy", () => {
  it("reports an empty password as empty and unacceptable", () => {
    expect(evaluatePasswordStrength("").label).toBe("Empty");
    expect(isPasswordAcceptable("")).toBe(false);
  });

  it("tracks the core strength requirements", () => {
    const checks = passwordStrengthChecks("LongerPassword123!");
    expect(checks.minimumLength).toBe(true);
    expect(checks.longEnough).toBe(true);
    expect(checks.mixedCase).toBe(true);
    expect(checks.numberAndSymbol).toBe(true);
    expect(evaluatePasswordStrength("LongerPassword123!").label).toBe("Strong");
  });

  it("accepts the minimum local password length without requiring complexity claims", () => {
    expect(isPasswordAcceptable("12345678")).toBe(true);
  });
});
