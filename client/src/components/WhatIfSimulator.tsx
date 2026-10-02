import { useState, useEffect } from "react";
import { Sliders, Sparkles, TrendingUp, AlertTriangle, ShieldCheck, DollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/formatters";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export function WhatIfSimulator() {
  const [discretionaryCutPct, setDiscretionaryCutPct] = useState(15);
  const [majorPurchaseLkr, setMajorPurchaseLkr] = useState(50000);
  const [incomeShiftLkr, setIncomeShiftLkr] = useState(0);

  const simulateMutation = trpc.intelligence.simulateWhatIf.useMutation();

  // Trigger simulation whenever inputs change
  useEffect(() => {
    simulateMutation.mutate({
      discretionaryCutPct,
      majorPurchaseCents: majorPurchaseLkr * 100,
      monthlyIncomeChangeCents: incomeShiftLkr * 100,
    });
  }, [discretionaryCutPct, majorPurchaseLkr, incomeShiftLkr]);

  const result = simulateMutation.data;

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case "LOW_RISK":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 flex items-center gap-1 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Low Risk • Safe Runway
          </Badge>
        );
      case "MODERATE_RISK":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-0 flex items-center gap-1 font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
            Moderate Risk • Buffer Consumed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-0 flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Critical • Runway Tight
          </Badge>
        );
    }
  };

  const chartData = (result?.projectedTimeline ?? []).map((t) => ({
    month: t.month,
    "Current Baseline": Math.round(t.baselineCashCents / 100),
    "Simulated Scenario": Math.round(t.simulatedCashCents / 100),
  }));

  return (
    <Card className="border-0 bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(25,35,25,0.06)] overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-850 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                What-If Financial Runway Simulator
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Model discretionary cuts, major capital purchases, and income shifts on your liquidity buffer.
              </CardDescription>
            </div>
          </div>
          <div>{getRiskBadge(result?.riskLevel)}</div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          {/* Slider 1: Discretionary Spend Cut */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Cut Discretionary Spend</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                -{discretionaryCutPct}%
              </span>
            </div>
            <Slider
              value={[discretionaryCutPct]}
              onValueChange={([val]) => setDiscretionaryCutPct(val)}
              min={0}
              max={50}
              step={5}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">Reduce dining out, entertainment & luxury purchases</p>
          </div>

          {/* Slider 2: Major Capital Purchase */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Major One-off Purchase</span>
              <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                LKR {majorPurchaseLkr.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[majorPurchaseLkr]}
              onValueChange={([val]) => setMajorPurchaseLkr(val)}
              min={0}
              max={300000}
              step={10000}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">Simulate laptop, home appliance, or holiday travel</p>
          </div>

          {/* Slider 3: Monthly Income Adjustment */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Monthly Income Delta</span>
              <span className={`font-bold px-2 py-0.5 rounded ${incomeShiftLkr >= 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "text-rose-600 bg-rose-50 dark:bg-rose-950"}`}>
                {incomeShiftLkr >= 0 ? `+LKR ${incomeShiftLkr.toLocaleString()}` : `-LKR ${Math.abs(incomeShiftLkr).toLocaleString()}`}
              </span>
            </div>
            <Slider
              value={[incomeShiftLkr]}
              onValueChange={([val]) => setIncomeShiftLkr(val)}
              min={-50000}
              max={100000}
              step={10000}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">Model salary changes, freelance contracts, or bonuses</p>
          </div>
        </div>

        {/* Dynamic Metric Results */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Simulated Monthly Burn</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatMoney(result?.simulatedMonthlyBurnCents ?? 0)}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Saves {formatMoney(result?.monthlySavingsDeltaCents ?? 0)}/mo
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Simulated Living Runway</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {result?.simulatedRunwayMonths ?? 0} months
            </div>
            <p className={`text-xs mt-0.5 ${(result?.runwayDeltaMonths ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {(result?.runwayDeltaMonths ?? 0) >= 0 ? `+${result?.runwayDeltaMonths} months buffer` : `${result?.runwayDeltaMonths} months reduction`}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Capital Impact</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              LKR {majorPurchaseLkr.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              One-time immediate liquidity outlay
            </p>
          </div>
        </div>

        {/* Executive Summary */}
        {result?.executiveSummary && (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Autonomous Copilot Verdict: </span>
              {result.executiveSummary}
            </div>
          </div>
        )}

        {/* 6-Month Projected Timeline Visualization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
            <span>6-Month Projected Liquidity Trajectory</span>
            <span className="text-[11px] font-normal text-slate-400">Baseline Cash Flow vs Simulated Scenario</span>
          </div>
          <div className="h-[240px] w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tickFormatter={(val) => `${Math.round(val / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number) => `LKR ${val.toLocaleString()}`}
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="Current Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Simulated Scenario" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
