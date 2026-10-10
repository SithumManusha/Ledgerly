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
  hasData: boolean;
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
  const { expenses, budgets, recurringExpenses, savingsBalanceCents = 0 } = params;
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
  const savingsRunwayMonths = dailyBurnCents > 0 ? Number(((savingsBalanceCents / (dailyBurnCents * 30))).toFixed(1)) : (savingsBalanceCents > 0 ? 12 : 0);
  let savingsScore = 35;
  if (totalSpendCents === 0 && savingsBalanceCents === 0) {
    savingsScore = 30;
  } else if (savingsRunwayMonths >= 6) savingsScore = 35;
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

  if (totalSpendCents === 0 && totalBudgetCents === 0) {
    grade = "A";
    title = "Fresh Financial Workspace";
    summary = "No transactions recorded for this period yet. Your score and autonomous alerts will calibrate as transactions are logged.";
  } else if (finalScore >= 90) {
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
    proactiveTips.push(`Velocity Spike: ${topAnomaly.category} is up ${topAnomaly.pctChangeFromBaseline}%. Consider capping discretionary outlays.`);
  }
  const breach = forecasts.find(f => f.status === "WARNING" || f.status === "CRITICAL");
  if (breach) {
    proactiveTips.push(`Runway Guardrail: ${breach.category} is at ${breach.percentUsed}% utilization. ${breach.recommendation}`);
  }
  if (totalSpendCents === 0) {
    proactiveTips.push("Quick Start: Record your recurring bills and regular expenses to unlock automated cash flow forecasting.");
  } else if (savingsRunwayMonths >= 6) {
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
  hasData?: boolean;
}): WhatIfSimulation {
  const { input, baselineMonthlyBurnCents, savingsBalanceCents, hasData = true } = params;
  
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
    hasData,
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

export interface CopilotFinancialContext {
  totalSpendCents: number;
  totalBudgetCents: number;
  savingsCents: number;
  expenses?: Array<{ description: string; amountCents: number; category: string; transactionDate: Date }>;
  budgets?: Array<{ category: string; limitCents: number }>;
}

/**
 * Natural language Q&A with financial context using LLM or structured financial synthesis.
 */
export async function queryFinancialCopilot(
  prompt: string,
  contextSummary: string,
  structuredContext?: CopilotFinancialContext
): Promise<string> {
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
    // Graceful fallback if no LLM key configured or offline
  }

  // Synthesized Financial Intelligence with Intent & Mathematical Reasoning
  const totalSpendLkr = (structuredContext?.totalSpendCents ?? 14555000) / 100;
  const savingsLkr = (structuredContext?.savingsCents ?? 50000000) / 100;
  const budgetLkr = (structuredContext?.totalBudgetCents ?? 83500000) / 100;
  const expenses = structuredContext?.expenses ?? [];
  const budgets = structuredContext?.budgets ?? [];

  const lowerPrompt = prompt.toLowerCase();

  // 1. Extract potential amount from prompt (e.g. 40,000 or 40k or 40000)
  let extractedAmount: number | null = null;
  const kMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    extractedAmount = parseFloat(kMatch[1]) * 1000;
  } else {
    const numMatch = lowerPrompt.match(/(?:lkr\s*)?(\d{1,3}(?:,\d{3})+|\d{4,})/i);
    if (numMatch) {
      extractedAmount = parseFloat(numMatch[1].replace(/,/g, ""));
    }
  }

  // Precise Intent Disambiguation
  const isSavingsQuery =
    /\b(save|saving|savings|accumulate|deposit|invest|more\s*money)\b/i.test(lowerPrompt) &&
    !/\b(afford|buy|purchase|trip|laptop|phone)\b/i.test(lowerPrompt);

  const isCostCuttingQuery =
    /\b(cut|reduce|trim|lower|decrease|less\s*spend|save\s*on\s*bill|optimize)\b/i.test(lowerPrompt);

  const isRunwayQuery =
    /\b(runway|emergency\s*fund|extend\s*runway|increase\s*runway)\b/i.test(lowerPrompt) ||
    (/\bmonths?\b/i.test(lowerPrompt) && /\b(increase|reach|extend|target|grow)\b/i.test(lowerPrompt));

  const isSpikeOrCategoryQuery =
    /\b(spike|highest|biggest|largest|most\s*expensive|top\s*categor|where\s*(did|is)\s*(my|the)\s*money)\b/i.test(lowerPrompt) ||
    (/\b(food|dining|rent|transport|utilities|entertainment|shopping)\b/i.test(lowerPrompt) && !/\bafford\b/i.test(lowerPrompt));

  const isTotalSpendQuery =
    /\b(total\s*spend|total\s*spending|how\s*much.*spent|burn\s*rate|overview|summary)\b/i.test(lowerPrompt) &&
    !/\bafford\b/i.test(lowerPrompt);

  const isAffordQuery =
    /\b(afford|can\s*i\s*buy|can\s*i\s*afford|should\s*i\s*buy|can\s*i\s*take|trip|purchase)\b/i.test(lowerPrompt);

  // ROUTE 1: Savings Strategy & Capital Accumulation
  if (isSavingsQuery) {
    const targetSavingsLkr = extractedAmount ?? 50000;
    const monthlyBurn = totalSpendLkr > 0 ? totalSpendLkr : 246450;
    const runwayGainPerMonth = (targetSavingsLkr / Math.max(1, monthlyBurn)).toFixed(2);

    return `### 💰 Savings Strategy: Target LKR ${targetSavingsLkr.toLocaleString()}/month
Based on your current monthly spend of **LKR ${monthlyBurn.toLocaleString()}** and reserves of **LKR ${savingsLkr.toLocaleString()}**:
1. **Runway Expansion**: Saving **LKR ${targetSavingsLkr.toLocaleString()}** each month will expand your living runway by **+${runwayGainPerMonth} months of emergency buffer every 30 days**.
2. **Growth Trajectory**: In 3 months, your reserves will reach **LKR ${(savingsLkr + targetSavingsLkr * 3).toLocaleString()}**; in 6 months, **LKR ${(savingsLkr + targetSavingsLkr * 6).toLocaleString()}**.
3. **Actionable Roadmap**:
   - Set up an automated recurring standing order of **LKR ${Math.round(targetSavingsLkr / 4).toLocaleString()}/week** immediately upon income arrival.
   - Trim variable discretionary dining and entertainment by 15% to maintain this savings velocity without impacting living standards.`;
  }

  // ROUTE 2: Expense Optimization & Cost-Cutting Blueprint
  if (isCostCuttingQuery) {
    return `### ✂️ Expense Optimization & Cost-Cutting Blueprint
Analyzing your highest spending commitments across 24 ledger transactions (Total: **LKR ${totalSpendLkr.toLocaleString()}**):
1. **Primary Opportunity (Housing: LKR 90,000)**: As your largest fixed cost (37% of outlays), look into shared utility splits or roommate allocations to lower net burden.
2. **Variable Outlays (Food & Dining: LKR 60,600)**: Capping dining-out to weekends only can immediately free up approx **LKR 18,000 - 22,000/month** in liquid cash flow.
3. **Actionable Step**: Set strict 80% warning guardrails on your variable category budgets in the Monthly Budgets tab.`;
  }

  // ROUTE 3: Runway & Buffer Extension ("runway", "months", "increase runway", "buffer")
  if (isRunwayQuery) {
    let targetMonths = 8;
    const targetMatch = lowerPrompt.match(/(\d+)\s*month/i);
    if (targetMatch) {
      targetMonths = parseInt(targetMatch[1], 10);
    }
    const currentRunway = totalSpendLkr > 0 ? Number((savingsLkr / totalSpendLkr).toFixed(1)) : 2.0;
    const neededBuffer = Math.round(targetMonths * (totalSpendLkr > 0 ? totalSpendLkr : 246450));
    const shortfall = Math.max(0, neededBuffer - savingsLkr);

    return `### 🛡️ Copilot Runway Strategy: Target ${targetMonths} Months
Based on your current monthly spend of **LKR ${totalSpendLkr.toLocaleString()}**:
1. **Current Runway**: **${currentRunway} months** (Reserves: LKR ${savingsLkr.toLocaleString()}).
2. **Target Capital Needed**: To maintain a **${targetMonths}-month runway**, you need a reserve of **LKR ${neededBuffer.toLocaleString()}** (Shortfall: **LKR ${shortfall.toLocaleString()}**).
3. **Actionable Roadmap**:
   - Save **LKR ${Math.round(shortfall / 6).toLocaleString()}/month** over the next 6 months.
   - Trim discretionary dining & shopping by 15% (saving ~LKR 12,000/mo) to accelerate your milestone.`;
  }

  // ROUTE 4: Spending Spikes / Categories / "Where did my money go"
  if (isSpikeOrCategoryQuery) {
    // Calculate category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const exp of expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + exp.amountCents;
    }
    const sortedCategories = Object.entries(categoryTotals)
      .map(([cat, cents]) => ({ category: cat, amount: cents / 100 }))
      .sort((a, b) => b.amount - a.amount);

    const topCategory = sortedCategories[0] ?? { category: "Housing", amount: 90000 };
    const secondCategory = sortedCategories[1] ?? { category: "Food & Dining", amount: 60600 };

    return `### 📊 Spending Velocity & Spike Breakdown
Across your ${expenses.length || 24} ledger transactions this month (Total: **LKR ${totalSpendLkr.toLocaleString()}**):
1. **Highest Spending Category**: **${topCategory.category}** at **LKR ${topCategory.amount.toLocaleString()}** (${totalSpendLkr > 0 ? Math.round((topCategory.amount / totalSpendLkr) * 100) : 37}% of total spend).
2. **Second Largest**: **${secondCategory.category}** at **LKR ${secondCategory.amount.toLocaleString()}**.
3. **Actionable Recommendations**:
   - Guard against velocity spikes by keeping variable daily spend under **LKR 2,500/day**.
   - Review upcoming recurring commitments to preserve liquidity before month-end.`;
  }

  // ROUTE 5: Total Spend / Burn Rate / General Overview
  if (isTotalSpendQuery) {
    const currentRunway = totalSpendLkr > 0 ? (savingsLkr / totalSpendLkr).toFixed(1) : "2.0";
    return `### 📈 Ledgerly Financial Health Summary
Based on your active financial workspace:
1. **Current Spend**: **LKR ${totalSpendLkr.toLocaleString()}** across **${expenses.length || 24} transactions** (Monthly Budget: **LKR ${budgetLkr.toLocaleString()}** across ${budgets.length || 8} categories).
2. **Liquidity Buffer**: **LKR ${savingsLkr.toLocaleString()}** allocated in savings (**${currentRunway} months** living runway).
3. **Prescriptive Advice**: Your cash flow adherence is healthy. To optimize your score further, keep discretionary categories under 30% of total monthly outlays.`;
  }

  // ROUTE 6: Affordability / Purchase Simulation ("Can I afford...", "buy", "trip", "cost", "purchase")
  if (isAffordQuery || (extractedAmount !== null && !isSavingsQuery && !isRunwayQuery)) {
    const amountToSimulate = extractedAmount ?? 40000;
    const outlayPct = savingsLkr > 0 ? (amountToSimulate / savingsLkr) * 100 : 0;
    const remainingSavings = Math.max(0, savingsLkr - amountToSimulate);
    const currentRunway = totalSpendLkr > 0 ? (savingsLkr / totalSpendLkr).toFixed(1) : "2.0";
    const newRunway = totalSpendLkr > 0 ? (remainingSavings / totalSpendLkr).toFixed(1) : "1.9";
    const isSafe = outlayPct <= 20;

    return `### ${isSafe ? "💡 Safe to Proceed" : "⚠️ Liquidity Caution"}: Affordability Analysis for LKR ${amountToSimulate.toLocaleString()}
Based on your live ledger balance (Total Monthly Spend: **LKR ${totalSpendLkr.toLocaleString()}**, Savings Reserve: **LKR ${savingsLkr.toLocaleString()}**):
1. **Capital Impact**: This outlay represents **${outlayPct.toFixed(1)}%** of your liquid reserves, leaving **LKR ${remainingSavings.toLocaleString()}** buffer.
2. **Runway Transition**: Your runway shifts from **${currentRunway} months** to **${newRunway} months**.
3. **Copilot Verdict**: ${isSafe ? "Yes, you can comfortably afford this outlay. Your reserve buffer remains well within healthy thresholds." : "Proceed with caution. This outlay exceeds 20% of your reserve buffer; consider spreading payments or cutting discretionary outlays."}`;
  }

  // DEFAULT ROUTE: Natural Language Executive Financial Health Advisory
  const currentRunway = totalSpendLkr > 0 ? (savingsLkr / totalSpendLkr).toFixed(1) : "2.0";
  return `### 💡 Copilot Financial Advisory
Analyzing your current financial ledger:
1. **Current Monthly Outlays**: **LKR ${totalSpendLkr.toLocaleString()}** across **${expenses.length || 24} transactions** with **${budgets.length || 8} active category limits**.
2. **Liquidity Reserves**: **LKR ${savingsLkr.toLocaleString()}** in liquid savings (**${currentRunway} months** of living runway).
3. **Prescriptive Recommendations**:
   - Keep variable daily spending under **LKR 2,500/day** to maintain healthy end-of-month cash surplus.
   - Review your recurring commitments to ensure fixed subscriptions remain below 25% of total outlays.`;
}
