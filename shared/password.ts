export const PASSWORD_MIN_LENGTH = 8;

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Empty" | "Very weak" | "Fair" | "Good" | "Strong";
  percent: number;
  hint: string;
};

export type PasswordStrengthChecks = {
  minimumLength: boolean;
  longEnough: boolean;
  mixedCase: boolean;
  numberAndSymbol: boolean;
};

export type PasswordStrengthIndicatorData = PasswordStrength & {
  checks: PasswordStrengthChecks;
  acceptable: boolean;
  requirement: string;
  colorClass: string;
  textClass: string;
};

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "Empty",
      percent: 0,
      hint: "Use a unique password for your Ledgerly account.",
    };
  }

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const labels: PasswordStrength["label"][] = [
    "Empty",
    "Very weak",
    "Fair",
    "Good",
    "Strong",
  ];
  const hints = [
    "Use a unique password for your Ledgerly account.",
    "Use at least 8 characters, with uppercase, lowercase, numbers, and symbols.",
    "Add more length and a mix of character types for a stronger password.",
    "Good password. Add more length or another symbol for maximum strength.",
    "Strong password.",
  ];

  return {
    score: score as PasswordStrength["score"],
    label: labels[score] ?? "Very weak",
    percent: Math.round((score / 4) * 100),
    hint: hints[score] ?? hints[1],
  };
}

export function passwordStrengthChecks(password: string): PasswordStrengthChecks {
  return {
    minimumLength: password.length >= PASSWORD_MIN_LENGTH,
    longEnough: password.length >= 12,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    numberAndSymbol: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordAcceptable(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function passwordPolicyMessage(): string {
  return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function passwordStrengthRequirement(password: string): string {
  return isPasswordAcceptable(password)
    ? "Minimum length met"
    : `${PASSWORD_MIN_LENGTH - password.length} more characters needed`;
}

export function passwordStrengthColor(score: PasswordStrength["score"]): string {
  if (score <= 1) return "bg-red-500";
  if (score === 2) return "bg-amber-500";
  if (score === 3) return "bg-lime-500";
  return "bg-emerald-500";
}

export function passwordStrengthTextColor(score: PasswordStrength["score"]): string {
  if (score <= 1) return "text-red-600 dark:text-red-400";
  if (score === 2) return "text-amber-700 dark:text-amber-400";
  if (score === 3) return "text-lime-700 dark:text-lime-400";
  return "text-emerald-700 dark:text-emerald-400";
}

export function passwordStrengthIndicatorData(password: string): PasswordStrengthIndicatorData {
  const strength = evaluatePasswordStrength(password);
  const checks = passwordStrengthChecks(password);

  return {
    ...strength,
    checks,
    acceptable: isPasswordAcceptable(password),
    requirement: passwordStrengthRequirement(password),
    colorClass: passwordStrengthColor(strength.score),
    textClass: passwordStrengthTextColor(strength.score),
  };
}

export function hashablePasswordPolicy(password: string) {
  return {
    ...passwordStrengthIndicatorData(password),
  };
}

export function passwordStrengthAriaLabel(password: string): string {
  return `Password strength: ${evaluatePasswordStrength(password).label}`;
}

export function passwordStrengthLabel(password: string): PasswordStrength["label"] {
  return evaluatePasswordStrength(password).label;
}

export function passwordStrengthHint(password: string): string {
  return evaluatePasswordStrength(password).hint;
}

export function passwordStrengthPercent(password: string): number {
  return evaluatePasswordStrength(password).percent;
}

export function passwordStrengthScore(password: string): PasswordStrength["score"] {
  return evaluatePasswordStrength(password).score;
}

export function passwordStrengthIsStrong(password: string): boolean {
  return evaluatePasswordStrength(password).score >= 3;
}

export function passwordStrengthSegments(password: string): boolean[] {
  const score = evaluatePasswordStrength(password).score;
  return Array.from({ length: 4 }, (_, index) => index < score);
}

export function passwordStrengthColorClass(password: string): string {
  return passwordStrengthColor(evaluatePasswordStrength(password).score);
}

export function passwordStrengthTextClass(password: string): string {
  return passwordStrengthTextColor(evaluatePasswordStrength(password).score);
}

export function passwordStrengthMeterText(password: string): string {
  const strength = evaluatePasswordStrength(password);
  return `${strength.label} (${strength.percent}%)`;
}

export function passwordStrengthValidationMessage(password: string): string {
  return isPasswordAcceptable(password) ? "" : passwordPolicyMessage();
}

export function passwordStrengthForRegistration(password: string): PasswordStrengthIndicatorData {
  return passwordStrengthIndicatorData(password);
}

export function passwordStrengthForReset(password: string): PasswordStrengthIndicatorData {
  return passwordStrengthIndicatorData(password);
}
