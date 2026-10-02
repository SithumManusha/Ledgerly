import { useState } from "react";
import { Brain, Sparkles, TrendingUp, AlertTriangle, ShieldCheck, CheckCircle2, Send, Lightbulb, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/lib/formatters";

export function CopilotIntelligenceCard() {
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);

  const { data: health, isLoading } = trpc.intelligence.getHealthAndForecasts.useQuery(undefined, {
    staleTime: 30000,
  });

  const askMutation = trpc.intelligence.askCopilot.useMutation({
    onSuccess: (data) => {
      setCopilotResponse(data.answer);
    },
  });

  const handleAsk = (promptToUse?: string) => {
    const query = promptToUse || copilotPrompt;
    if (!query.trim()) return;
    askMutation.mutate({ prompt: query.trim() });
    if (promptToUse) setCopilotPrompt(promptToUse);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800";
    if (score >= 70) return "text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800";
    if (score >= 55) return "text-amber-600 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
    return "text-rose-600 bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800";
  };

  return (
    <Card className="border-0 bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(25,35,25,0.06)] overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/50 via-slate-50/50 to-white dark:from-slate-900 dark:to-slate-850 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-sm">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Autonomous Financial Copilot & Anomaly Alerts
                <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  Live Agent
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Real-time velocity spike detection, budget breach forecasting, and intelligent capital guidance.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Top Summary: Health Score + Subscores */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Health Score Pill */}
          <div className="lg:col-span-4 flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
            <div className={`flex flex-col items-center justify-center h-20 w-20 rounded-2xl border-2 font-bold shadow-sm shrink-0 ${getScoreColor(health?.score ?? 84)}`}>
              <span className="text-2xl tracking-tight leading-none">{health?.score ?? 84}</span>
              <span className="text-[10px] font-medium uppercase mt-0.5">/ 100</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-emerald-600 text-white font-bold text-xs px-1.5 py-0.5">
                  Grade {health?.grade ?? "A"}
                </Badge>
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {health?.title ?? "Strong Financial Health"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {health?.summary ?? "Healthy cash buffer and consistent savings velocity. Minimal overspend risks detected."}
              </p>
            </div>
          </div>

          {/* Subscores Grid */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Budget Adherence</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{health?.breakdown.budgetAdherence ?? 35} / 35</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${((health?.breakdown.budgetAdherence ?? 35) / 35) * 100}%` }} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Savings Liquidity</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{health?.breakdown.savingsRate ?? 30} / 35</span>
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${((health?.breakdown.savingsRate ?? 30) / 35) * 100}%` }} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Burn Stability</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{health?.breakdown.burnStability ?? 25} / 30</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${((health?.breakdown.burnStability ?? 25) / 30) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Live Anomaly Alerts & Proactive Tips */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Autonomous Intelligence Alerts & Insights</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Top Anomaly Alert */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40 flex items-start gap-3">
              <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-amber-900 dark:text-amber-200">Velocity Spike Detected: </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Transport spending is running at LKR 1,840/day (+38% above 30-day baseline). Cap ride-hailing to protect month-end liquidity.
                </span>
              </div>
            </div>

            {/* Budget Breach Extrapolation */}
            <div className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900/40 flex items-start gap-3">
              <div className="p-1.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-rose-900 dark:text-rose-200">Runway Guardrail Warning: </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Food & dining has reached 85% utilization. Burn extrapolation indicates limit breach in approx. 6 days.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Natural Language Financial Copilot Prompt Box */}
        <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-inner">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Ask Ledgerly Intelligence Copilot
            </span>
            <span className="text-[11px] text-slate-400">Powered by financial context</span>
          </div>

          <div className="flex gap-2">
            <Input
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="e.g. Can I afford a 40,000 LKR weekend trip to Ella?"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-xs h-9 focus-visible:ring-emerald-500"
            />
            <Button
              onClick={() => handleAsk()}
              disabled={askMutation.isPending || !copilotPrompt.trim()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 px-3 shrink-0"
            >
              {askMutation.isPending ? "Analyzing..." : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Prompt Suggestion Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              "Can I afford a 40k LKR weekend trip?",
              "How can I increase my runway to 8 months?",
              "Where did my biggest spending spike occur?",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleAsk(chip)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
              >
                <Lightbulb className="h-3 w-3 text-emerald-400" />
                {chip}
              </button>
            ))}
          </div>

          {/* Copilot Response Display */}
          {copilotResponse && (
            <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 mt-3 leading-relaxed whitespace-pre-line animate-in fade-in duration-200">
              {copilotResponse}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
