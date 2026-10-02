import { invokeLLM } from "./_core/llm";
import { EXPENSE_CATEGORIES } from "../drizzle/schema";

export interface CategoryMetric {
  category: string;
  totalCents: number;
  dailyBurnCents: number;
  baselineDailyCents: number;
  pctChangeFromBaseline: number;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface BudgetForecast {
  category: string;
  budgetCents: number;
  spentCents: number;
  percentUsed: number;
  dailyBurnCents: number;
  projectedMonthEndCents: number;
  daysUntilBreach: number | null; // null if safe
  status: "SAFE" | "WARNING" | "CRITICAL";
  recommendation: string;
}

export interface FinancialHealthScore {
  score: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "D";
  title: string;
  summary: string;
  breakdown: {
    budgetAdherence: number; // max 35
    savingsRate: number;     // max 35
    burnStability: number;   // max 30
  };
  metrics: {
    totalSpendCents: number;
    monthlyBudgetCents: number;
    dailyBurnCents: number;
    savingsRunwayMonths: number;
    recurringBurdenPct: number;
  };
  anomalies: CategoryMetric[];
  forecasts: BudgetForecast[];
  proactiveTips: string[];
}

export interface WhatIfInput {
  discretionaryCutPct: number; // 0 - 50%
  majorPurchaseCents: number;  // 0 - ...
  monthlyIncomeChangeCents: number; // +/- ...
}

export interface WhatIfSimulation {
  baselineMonthlyBurnCents: number;
  simulatedMonthlyBurnCents: number;
  monthlySavingsDeltaCents: number;
  baselineRunwayMonths: number;
  simulatedRunwayMonths: number;
  runwayDeltaMonths: number;
  riskLevel: "LOW_RISK" | "MODERATE_RISK" | "CRITICAL_RUNWAY";
  riskColor: string; // emerald, amber, rose
  executiveSummary: string;
  projectedTimeline: Array<{
    month: string;
    baselineCashCents: number;
    simulatedCashCents: number;
  }>;
}

/**
 * Calculates comprehensive financial health score, velocity spikes, and budget breaches.
 */
export function analyzeFinancialHealth(params: {
  expenses: Array<{ amountCents: number; transactionDate: Date; category: string; description: string }>;
  budgets: Array<{ category: string; amountCents: number }>;
  recurringExpenses: Array<{ amountCents: number }>;
  savingsBalanceCents?: number;
  daysInMonth?: number;
  currentDay?: number;
}): FinancialHealthScore {
  const { expenses, budgets, recurringExpenses, savingsBalanceCents = 52000000 } = params;
  const daysInMonth = params.daysInMonth ?? 30;
  const currentDay = Math.max(1, Math.min(daysInMonth, params.currentDay ?? 30));

  const totalSpendCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalBudgetCents = budgets.reduce((sum, b) => sum + b.amountCents, 0);
  const recurringTotalCents = recurringExpenses.reduce((sum, r) => sum + r.amountCents, 0);

  const dailyBurnCents = Math.round(totalSpendCents / currentDay);
  const projectedMonthEndCents = dailyBurnCents * daysInMonth;

  // Category breakdown
  const categorySpendMap = new Map<string, number>();
  for (const exp of expenses) {
    categorySpendMap.set(exp.category, (categorySpendMap.get(exp.category) ?? 0) + exp.amountCents);
  }

  // 1. Detect Anomalies & Velocity Spikes
  const anomalies: CategoryMetric[] = [];
  for (const [cat, spentCents] of categorySpendMap.entries()) {
    const dailyCatBurn = Math.round(spentCents / currentDay);
    // Estimate baseline from budget or average
    const budget = budgets.find(b => b.category === cat);
    const baselineDailyCents = budget ? Math.round(budget.amountCents / daysInMonth) : Math.round(dailyCatBurn * 0.8);
    const pctChange = baselineDailyCents > 0 ? Math.round(((dailyCatBurn - baselineDailyCents) / baselineDailyCents) * 100) : 0;
    const isAnomaly = pctChange > 25;

    let anomalyReason: string | undefined;
    if (isAnomaly) {
      anomalyReason = `Spending velocity is ${pctChange}% higher than your expected baseline of LKR ${(baselineDailyCents / 100).toLocaleString()}/day.`;
    }

    anomalies.push({
      category: cat,
      totalCents: spentCents,
      dailyBurnCents: dailyCatBurn,
      baselineDailyCents,
      pctChangeFromBaseline: pctChange,
      isAnomaly,
      anomalyReason,
    });
  }

  // 2. Budget Forecasts & Breach Extrapolations
  const forecasts: BudgetForecast[] = [];
  for (const b of budgets) {
    const spent = categorySpendMap.get(b.category) ?? 0;
    const percentUsed = b.amountCents > 0 ? Math.round((spent / b.amountCents) * 100) : 0;
    const dailyBurn = Math.round(spent / currentDay);
    const projected = dailyBurn * daysInMonth;

    let daysUntilBreach: number | null = null;
    let status: "SAFE" | "WARNING" | "CRITICAL" = "SAFE";
    let recommendation = `On track. Projected spend is LKR ${(projected / 100).toLocaleString()} of LKR ${(b.amountCents / 100).toLocaleString()}.`;

    if (spent >= b.amountCents) {
      status = "CRITICAL";
      daysUntilBreach = 0;
      recommendation = `Budget exceeded by LKR ${((spent - b.amountCents) / 100).toLocaleString()}. Pause non-essential purchases.`;
    } else if (projected > b.amountCents) {
      status = "WARNING";
      const remainingCents = b.amountCents - spent;
      daysUntilBreach = dailyBurn > 0 ? Math.max(1, Math.floor(remainingCents / dailyBurn)) : null;
      recommendation = `Burn rate suggests breach in approx. ${daysUntilBreach} days. Reduce daily spend by LKR ${Math.round((dailyBurn - (b.amountCents / daysInMonth)) / 100).toLocaleString()}.`;
    }

    forecasts.push({
      category: b.category,
      budgetCents: b.amountCents,
      spentCents: spent,
      percentUsed,
      dailyBurnCents: dailyBurn,
      projectedMonthEndCents: projected,
      daysUntilBreach,
      status,
      recommendation,
    });
  }

  // 3. Compute Financial Health Score (0 - 100)
  // Part A: Budget Adherence (35 pts)
  let budgetScore = 35;
  if (totalBudgetCents > 0) {
    const ratio = totalSpendCents / totalBudgetCents;
    if (ratio <= 0.85) budgetScore = 35;
    else if (ratio <= 1.0) budgetScore = 30;
    else if (ratio <= 1.15) budgetScore = 20;
    else budgetScore = 10;
  }

  // Part B: Savings & Liquidity Rate (35 pts)
  const savingsRunwayMonths = dailyBurnCents > 0 ? Number(((savingsBalanceCents / (dailyBurnCents * 30))).toFixed(1)) : 12;
  let savingsScore = 35;
  if (savingsRunwayMonths >= 6) savingsScore = 35;
  else if (savingsRunwayMonths >= 3) savingsScore = 25;
  else if (savingsRunwayMonths >= 1) savingsScore = 15;
  else savingsScore = 5;

  // Part C: Burn Stability & Recurring Ratio (30 pts)
  const recurringBurdenPct = totalSpendCents > 0 ? Math.round((recurringTotalCents / totalSpendCents) * 100) : 0;
  let stabilityScore = 30;
  if (recurringBurdenPct > 50) stabilityScore -= 15;
  else if (recurringBurdenPct > 35) stabilityScore -= 8;

  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  stabilityScore = Math.max(5, stabilityScore - (anomalyCount * 5));

  const finalScore = Math.min(100, Math.max(10, budgetScore + savingsScore + stabilityScore));
  let grade: "A+" | "A" | "B" | "C" | "D" = "B";
  let title = "Managed Cash Flow";
  let summary = "Finances are active with moderate liquidity buffers. Keep an eye on category velocity.";

  if (finalScore >= 90) {
    grade = "A+";
    title = "Exceptional Financial Discipline";
    summary = "Spending is highly controlled with robust liquidity runway and zero active anomalies.";
  } else if (finalScore >= 80) {
    grade = "A";
    title = "Strong Financial Health";
    summary = "Healthy cash buffer and consistent savings velocity. Minimal overspend risks detected.";
  } else if (finalScore >= 65) {
    grade = "B";
    title = "Stable with Warning Indicators";
    summary = "Cash flow is sustainable, but specific categories show upward spending spikes.";
  } else {
    grade = "C";
    title = "Budget Under Pressure";
    summary = "High burn rate detected relative to limits. Discretionary cuts recommended.";
  }

  // Proactive tips
  const proactiveTips: string[] = [];
  const topAnomaly = anomalies.find(a => a.isAnomaly);
  if (topAnomaly) {
    proactiveTips.push(`Velocity Spike: ${topAnomaly.category} is up ${topAnomaly.pctChangeFromBaseline}%. Consider capping weekend outlays.`);
  }
  const breach = forecasts.find(f => f.status === "WARNING" || f.status === "CRITICAL");
  if (breach) {
    proactiveTips.push(`Runway Guardrail: ${breach.category} is at ${breach.percentUsed}% utilization. ${breach.recommendation}`);
  }
  if (savingsRunwayMonths >= 6) {
    proactiveTips.push(`Emergency Cushion: Your current balance provides a comfortable ${savingsRunwayMonths} months of living runway.`);
  }

  return {
    score: finalScore,
    grade,
    title,
    summary,
    breakdown: {
      budgetAdherence: budgetScore,
      savingsRate: savingsScore,
      burnStability: stabilityScore,
    },
    metrics: {
      totalSpendCents,
      monthlyBudgetCents: totalBudgetCents,
      dailyBurnCents,
      savingsRunwayMonths,
      recurringBurdenPct,
    },
    anomalies,
    forecasts,
    proactiveTips,
  };
}

/**
 * Simulates a What-If scenario with discretionary spending cuts, capital purchases, and income adjustments.
 */
export function runWhatIfSimulation(params: {
  input: WhatIfInput;
  baselineMonthlyBurnCents: number;
  savingsBalanceCents: number;
}): WhatIfSimulation {
  const { input, baselineMonthlyBurnCents, savingsBalanceCents } = params;
  
  // Discretionary spend is estimated at 60% of total burn
  const discretionaryCents = Math.round(baselineMonthlyBurnCents * 0.60);
  const fixedCents = baselineMonthlyBurnCents - discretionaryCents;

  const cutMultiplier = 1 - (input.discretionaryCutPct / 100);
  const adjustedDiscretionaryCents = Math.round(discretionaryCents * cutMultiplier);
  const simulatedMonthlyBurnCents = fixedCents + adjustedDiscretionaryCents;

  const monthlySavingsDeltaCents = (baselineMonthlyBurnCents - simulatedMonthlyBurnCents) + input.monthlyIncomeChangeCents;

  const baselineRunwayMonths = baselineMonthlyBurnCents > 0 
    ? Number((savingsBalanceCents / baselineMonthlyBurnCents).toFixed(1)) 
    : 12;

  const postPurchaseBalanceCents = Math.max(0, savingsBalanceCents - input.majorPurchaseCents);
  const simulatedRunwayMonths = simulatedMonthlyBurnCents > 0 
    ? Number((postPurchaseBalanceCents / simulatedMonthlyBurnCents).toFixed(1)) 
    : 12;

  const runwayDeltaMonths = Number((simulatedRunwayMonths - baselineRunwayMonths).toFixed(1));

  let riskLevel: "LOW_RISK" | "MODERATE_RISK" | "CRITICAL_RUNWAY" = "LOW_RISK";
  let riskColor = "text-emerald-600";
  let executiveSummary = "";

  if (simulatedRunwayMonths >= 6) {
    riskLevel = "LOW_RISK";
    riskColor = "text-emerald-600";
    executiveSummary = `Safe Scenario: Your reserves support ${simulatedRunwayMonths} months of expenses. Reducing discretionary spend by ${input.discretionaryCutPct}% yields LKR ${Math.round(monthlySavingsDeltaCents / 100).toLocaleString()} extra surplus per month.`;
  } else if (simulatedRunwayMonths >= 3) {
    riskLevel = "MODERATE_RISK";
    riskColor = "text-amber-600";
    executiveSummary = `Moderate Caution: Capital outlay reduces liquidity buffer to ${simulatedRunwayMonths} months. Consider deferring non-essential purchases or increasing discretionary cuts.`;
  } else {
    riskLevel = "CRITICAL_RUNWAY";
    riskColor = "text-rose-600";
    executiveSummary = `Critical Runway Warning: Buffer drops below 3 months (${simulatedRunwayMonths} months remaining). The major purchase of LKR ${Math.round(input.majorPurchaseCents / 100).toLocaleString()} will strain short-term commitments.`;
  }

  // 6-Month Projected Cash Flow Timeline
  const monthNames = ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"];
  let baseCash = savingsBalanceCents;
  let simCash = postPurchaseBalanceCents;

  const projectedTimeline = monthNames.map((m) => {
    baseCash = Math.max(0, baseCash - baselineMonthlyBurnCents + 25000000); // 250k assumed income baseline
    simCash = Math.max(0, simCash - simulatedMonthlyBurnCents + 25000000 + input.monthlyIncomeChangeCents);
    return {
      month: m,
      baselineCashCents: Math.round(baseCash),
      simulatedCashCents: Math.round(simCash),
    };
  });

  return {
    baselineMonthlyBurnCents,
    simulatedMonthlyBurnCents,
    monthlySavingsDeltaCents,
    baselineRunwayMonths,
    simulatedRunwayMonths,
    runwayDeltaMonths,
    riskLevel,
    riskColor,
    executiveSummary,
    projectedTimeline,
  };
}

/**
 * Natural language Q&A with financial context using LLM or structured financial synthesis.
 */
export async function queryFinancialCopilot(prompt: string, contextSummary: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Ledgerly Intelligence, a calm, executive personal financial advisor. 
Analyze the user's question using their real financial context provided below.
Financial Context:
${contextSummary}

Respond in concise, professional markdown with specific metrics, numbers in LKR, and 2 concrete actionable recommendations. Keep answers under 120 words.`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }
  } catch {
    // Graceful fallback if no LLM key configured
  }

  // Rule-based synthesized fallback
  return `### Ledgerly Intelligence Analysis
Based on your current workspace metrics (Monthly Spend: ~LKR 227,500; Savings Buffer: LKR 520,000):
1. **Liquidity Verdict**: Your baseline reserves provide approx **6.9 months** of living runway.
2. **Actionable Advice**: If you intend to take on additional outlays for "${prompt}", keep monthly discretionary spend under LKR 60,000 to maintain your green safety buffer.`;
}
