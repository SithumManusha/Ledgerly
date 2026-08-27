import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CarFront,
  CircleHelp,
  Clapperboard,
  FileDown,
  Repeat2,
  ShieldAlert,
  BrainCircuit,
  CalendarDays,
  Check,
  Download,
  GraduationCap,
  HeartPulse,
  Home as HomeIcon,
  PiggyBank,
  Upload,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  TrendingDown,
  Plane,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  ScanLine,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, ReactNode, useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  APP_TAGLINE,
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  getCategoryColor,
  SUPPORTED_CURRENCIES,
} from "../../../drizzle/schema";
import {
  buildMonthOverMonthComparison,
  filterTransactions,
  formatComparison,
  type TransactionFilters,
} from "@/lib/ledgerly-analytics";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

type EditingExpense = {
  id?: number;
  amount: string;
  date: string;
  description: string;
  category: string;
  aiSuggestedCategory?: string | null;
};

const emptyExpense = (): EditingExpense => ({
  amount: "",
  date: today(),
  description: "",
  category: "",
  aiSuggestedCategory: null,
});

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCompactDate(date: string) {
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function initials(name?: string | null) {
  return (name || "You")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function downloadBase64File(base64: string, filename: string, contentType: string) {
  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  "Food & dining": Utensils,
  Transport: CarFront,
  Shopping: ShoppingBag,
  Housing: HomeIcon,
  "Bills & utilities": ReceiptText,
  Health: HeartPulse,
  Education: GraduationCap,
  Entertainment: Clapperboard,
  Travel: Plane,
  Subscriptions: Repeat2,
  Other: CircleHelp,
};

function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] ?? CircleHelp;
  return <Icon className="h-4 w-4" />;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  tone: "orange" | "teal" | "violet";
}) {
  const tones = {
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  };
  return (
    <Card className="border-0 shadow-[0_10px_30px_rgba(25,35,25,0.05)] bg-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </div>
          <div className={`rounded-2xl p-3 ring-1 ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const monthKey = currentMonth();
  const [expense, setExpense] = useState<EditingExpense>(emptyExpense);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [savingsTarget, setSavingsTarget] = useState("");
  const [savingsCurrent, setSavingsCurrent] = useState("");
  const [savingsDate, setSavingsDate] = useState(() => `${new Date().getFullYear()}-12-31`);
  const [recurringDraft, setRecurringDraft] = useState({ amount: "", description: "", category: "", frequency: "monthly" as "monthly" | "weekly", dayOfMonth: "1" });
  const [reportStart, setReportStart] = useState(() => `${currentMonth()}-01`);
  const [reportEnd, setReportEnd] = useState(today());
  const [warningThreshold, setWarningThreshold] = useState("80");
  const [selectedComparisonMonthKey, setSelectedComparisonMonthKey] = useState<string | null>(null);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>({
    search: "",
    fromDate: "",
    toDate: "",
    category: "all",
    currency: "all",
  });

  const expensesQuery = trpc.expenses.list.useQuery();
  const analyticsQuery = trpc.analytics.dashboard.useQuery({ monthKey });
  const budgetsQuery = trpc.budgets.list.useQuery({ monthKey });
  const savingsGoalQuery = trpc.savingsGoal.get.useQuery();
  const recurringQuery = trpc.recurring.list.useQuery();
  const alertSettingsQuery = trpc.alerts.settings.useQuery();
  const alertsQuery = trpc.alerts.evaluate.useQuery({ monthKey });
  const reportRange = useMemo(() => ({ startDate: reportStart, endDate: reportEnd }), [reportStart, reportEnd]);
  const reportQuery = trpc.reports.exportRange.useQuery(reportRange, { enabled: false });
  const expensesExportQuery = trpc.expenses.exportCsv.useQuery(undefined, { enabled: false });
  const utils = trpc.useUtils();
  

  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: async () => {
      toast.success(expense.id ? "Expense updated" : "Expense added");
      setExpense(emptyExpense());
      setIsExpenseDialogOpen(false);
      await Promise.all([utils.expenses.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: async () => {
      toast.success("Expense updated");
      setExpense(emptyExpense());
      setIsExpenseDialogOpen(false);
      await Promise.all([utils.expenses.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: async () => {
      toast.success("Expense removed");
      await Promise.all([utils.expenses.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const suggestCategory = trpc.expenses.suggestCategory.useMutation();
  const scanReceipt = trpc.expenses.scanReceipt.useMutation();
  const importCsv = trpc.expenses.importCsv.useMutation({
    onSuccess: async result => {
      toast.success(`${result.imported} transactions imported`);
      await Promise.all([utils.expenses.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const saveBudget = trpc.budgets.upsert.useMutation({
    onSuccess: async () => {
      toast.success("Budget saved");
      setBudgetCategory("");
      setBudgetLimit("");
      await Promise.all([utils.budgets.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const deleteBudget = trpc.budgets.delete.useMutation({
    onSuccess: async () => {
      toast.success("Budget removed");
      await Promise.all([utils.budgets.list.invalidate(), utils.analytics.dashboard.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const saveSavingsGoal = trpc.savingsGoal.upsert.useMutation({
    onSuccess: async () => {
      toast.success("Savings goal saved");
      await utils.savingsGoal.get.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteSavingsGoal = trpc.savingsGoal.delete.useMutation({
    onSuccess: async () => {
      toast.success("Savings goal removed");
      setSavingsTarget("");
      setSavingsCurrent("");
      await utils.savingsGoal.get.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createRecurring = trpc.recurring.create.useMutation({
    onSuccess: async () => {
      toast.success("Recurring expense added");
      setRecurringDraft({ amount: "", description: "", category: "", frequency: "monthly", dayOfMonth: "1" });
      await Promise.all([utils.recurring.list.invalidate(), utils.alerts.evaluate.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const deleteRecurring = trpc.recurring.delete.useMutation({
    onSuccess: async () => {
      toast.success("Recurring expense removed");
      await Promise.all([utils.recurring.list.invalidate(), utils.alerts.evaluate.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const saveAlertSettings = trpc.alerts.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("Alert threshold saved");
      await Promise.all([utils.alerts.settings.invalidate(), utils.alerts.evaluate.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const analytics = analyticsQuery.data;
  const summary = analytics?.summary ?? {
    totalCents: 0,
    topCategory: null,
    topCategoryCents: 0,
    budgetTotalCents: 0,
    budgetSpentCents: 0,
  };
  const budgetProgress = summary.budgetTotalCents
    ? Math.min(100, (summary.budgetSpentCents / summary.budgetTotalCents) * 100)
    : 0;
  const budgetRows = budgetsQuery.data ?? [];
  const monthLabel = new Intl.DateTimeFormat("en-LK", { month: "long", year: "numeric" }).format(
    new Date(`${monthKey}-01T12:00:00`),
  );
  useEffect(() => {
    if (alertSettingsQuery.data) setWarningThreshold(String(alertSettingsQuery.data.budgetWarningThresholdPercent));
  }, [alertSettingsQuery.data]);
  const view = location === "/transactions" ? "transactions" : location === "/budgets" ? "budgets" : location === "/insights" ? "insights" : location === "/shared" ? "shared" : "overview";

  const recentExpenses = useMemo(() => (expensesQuery.data ?? []).slice(0, 6), [expensesQuery.data]);
  const comparisonData = useMemo(() => buildMonthOverMonthComparison(analytics?.monthlyTotals ?? []), [analytics?.monthlyTotals]);
  const selectedComparison = comparisonData.find(point => point.monthKey === selectedComparisonMonthKey) ?? comparisonData[comparisonData.length - 1];
  const selectedComparisonSummary = selectedComparison
    ? formatComparison(selectedComparison.deltaCents, selectedComparison.deltaPercent)
    : null;
  const filteredTransactions = useMemo(
    () => filterTransactions(expensesQuery.data ?? [], transactionFilters),
    [expensesQuery.data, transactionFilters],
  );
  const savingsGoal = savingsGoalQuery.data;

  function handleSavingsGoalSubmit(event: FormEvent) {
    event.preventDefault();
    const target = Number(savingsTarget);
    const current = Number(savingsCurrent || 0);
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0 || !isValidDateInput(savingsDate)) {
      toast.error("Enter a positive target, optional current savings, and a target date.");
      return;
    }
    saveSavingsGoal.mutate({ targetCents: Math.round(target * 100), currentCents: Math.round(current * 100), targetDate: savingsDate });
  }

  function handleExportCsv() {
    void expensesExportQuery.refetch().then(({ data }) => {
      if (!data) return;
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded");
    }).catch(error => toast.error(error.message));
  }

  async function handleImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 1_000_000) {
      toast.error("Choose a CSV file smaller than 1 MB.");
      return;
    }
    try {
      importCsv.mutate({ csv: await file.text() });
    } catch {
      toast.error("Could not read this CSV file.");
    }
  }

  async function handleSuggest() {
    if (expense.description.trim().length < 2) {
      toast.error("Add a short description first.");
      return;
    }
    setIsSuggesting(true);
    try {
      const result = await suggestCategory.mutateAsync({ description: expense.description });
      setExpense(current => ({ ...current, category: result.category, aiSuggestedCategory: result.category }));
      toast.success(`Suggested ${result.category}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not suggest a category.");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleScanReceipt(file: File) {
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Upload a JPG, PNG, or WEBP receipt image.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Receipt images must be smaller than 6 MB.");
      return;
    }

    setIsScanningReceipt(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          result ? resolve(result) : reject(new Error("The receipt image could not be read."));
        };
        reader.onerror = () => reject(new Error("The receipt image could not be read."));
        reader.readAsDataURL(file);
      });
      const result = await scanReceipt.mutateAsync({ imageBase64 });
      setExpense(current => ({
        ...current,
        amount: result.amount > 0 ? String(result.amount) : current.amount,
        date: result.date || current.date,
        description: result.description || current.description,
        category: result.category || current.category,
        aiSuggestedCategory: result.category || current.aiSuggestedCategory,
      }));
      toast.success("Receipt scanned. Review the extracted details before saving.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not scan this receipt.");
    } finally {
      setIsScanningReceipt(false);
    }
  }

  function handleExpenseSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !isValidDateInput(expense.date) || !expense.category || !expense.description.trim()) {
      toast.error("Complete the amount, description, date, and category.");
      return;
    }
    const input = {
      amountCents: Math.round(amount * 100),
      transactionDate: expense.date,
      description: expense.description,
      category: expense.category as (typeof EXPENSE_CATEGORIES)[number],
      aiSuggestedCategory: expense.aiSuggestedCategory as (typeof EXPENSE_CATEGORIES)[number] | null,
    };
    if (expense.id) updateExpense.mutate({ id: expense.id, ...input });
    else createExpense.mutate(input);
  }

  function handleBudgetSubmit(event: FormEvent) {
    event.preventDefault();
    if (!budgetCategory || !Number(budgetLimit) || Number(budgetLimit) <= 0) {
      toast.error("Choose a category and enter a positive limit.");
      return;
    }
    saveBudget.mutate({
      monthKey,
      category: budgetCategory as (typeof EXPENSE_CATEGORIES)[number],
      limitCents: Math.round(Number(budgetLimit) * 100),
    });
  }

  function handleRecurringSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(recurringDraft.amount);
    const dayOfMonth = Number(recurringDraft.dayOfMonth);
    if (!Number.isFinite(amount) || amount <= 0 || !recurringDraft.description.trim() || !recurringDraft.category || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      toast.error("Complete the recurring amount, description, category, and valid day.");
      return;
    }
    createRecurring.mutate({ amountCents: Math.round(amount * 100), description: recurringDraft.description.trim(), category: recurringDraft.category as (typeof EXPENSE_CATEGORIES)[number], frequency: recurringDraft.frequency, dayOfMonth });
  }

  function handleAlertSubmit(event: FormEvent) {
    event.preventDefault();
    const threshold = Number(warningThreshold);
    if (!Number.isInteger(threshold) || threshold < 50 || threshold > 100) {
      toast.error("Choose a warning threshold between 50% and 100%.");
      return;
    }
    saveAlertSettings.mutate({ budgetWarningThresholdPercent: threshold, emailAlertsEnabled: false });
  }

  function handleReportDownload() {
    if (!isValidDateInput(reportStart) || !isValidDateInput(reportEnd) || reportEnd < reportStart) {
      toast.error("Choose a valid date range with the end date on or after the start date.");
      return;
    }
    void reportQuery.refetch().then(({ data }) => {
      if (!data) return;
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${data.summary.transactionCount} transactions`);
    }).catch(error => toast.error(error.message));
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-background px-1 pb-10 sm:px-4">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-200/80 pb-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">Good morning, {user?.name?.split(" ")[0] || "there"}.</p>
              <p className="text-sm text-slate-500">{APP_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.name || "Your account"}</p>
              <p className="text-xs text-slate-500">Private workspace</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(user?.name)}</div>
          </div>
        </header>

        {view === "overview" && (
          <>
            <SectionHeading
              eyebrow="Monthly overview"
              title="Your money, in focus."
              description={`A simple view of your spending for ${monthLabel}. Add your first expense or review the patterns emerging from your entries.`}
              action={
                <Button onClick={() => { setExpense(emptyExpense()); setIsExpenseDialogOpen(true); }} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                  <Plus className="mr-2 h-4 w-4" /> Add expense
                </Button>
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="Total spend" value={formatMoney(summary.totalCents)} detail={`${monthLabel} so far`} icon={CircleDollarSign} tone="orange" />
              <StatCard label="Top category" value={summary.topCategory || "Not yet"} detail={summary.topCategory ? formatMoney(summary.topCategoryCents) : "Add a few expenses to see it"} icon={TrendingUp} tone="teal" />
              <StatCard label="Budget health" value={summary.budgetTotalCents ? `${Math.round(budgetProgress)}%` : "Set a goal"} detail={summary.budgetTotalCents ? `${formatMoney(summary.budgetSpentCents)} of ${formatMoney(summary.budgetTotalCents)}` : "Create a category budget"} icon={Target} tone="violet" />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div><CardTitle className="text-base text-slate-900">Spending by category</CardTitle><p className="mt-1 text-xs text-slate-500">Your biggest areas this month</p></div>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/insights")} className="text-xs text-slate-500">View insights <ChevronRight className="ml-1 h-3 w-3" /></Button>
                </CardHeader>
                <CardContent className="h-[280px] pt-4">
                  {analyticsQuery.isLoading ? <LoadingState /> : analytics?.categoryTotals.length ? <CategoryPie data={analytics.categoryTotals} /> : <EmptyChart title="No spending data yet" detail="Add an expense to unlock your first chart." />}
                </CardContent>
              </Card>
              <Card id="expense-form" className="border-0 bg-slate-900 text-white shadow-[0_10px_30px_rgba(25,35,25,0.13)]">
                <CardHeader><div className="flex items-center gap-2"><div className="rounded-lg bg-emerald-400/15 p-2 text-emerald-300"><Plus className="h-4 w-4" /></div><div><CardTitle className="text-base text-white">{expense.id ? "Edit expense" : "Quick add"}</CardTitle><p className="mt-1 text-xs text-slate-400">Keep your ledger up to date.</p></div></div></CardHeader>
                <CardContent><ExpenseForm expense={expense} setExpense={setExpense} onSubmit={handleExpenseSubmit} onSuggest={handleSuggest} isSuggesting={isSuggesting} onScanReceipt={handleScanReceipt} isScanningReceipt={isScanningReceipt} isSaving={createExpense.isPending || updateExpense.isPending} onCancel={() => setExpense(emptyExpense())} dark /></CardContent>
              </Card>
            </div>
            <Card className="mt-6 border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Month-over-month comparison</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Compare each month with the period immediately before it.</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedComparisonSummary && typeof selectedComparisonSummary !== "string" ? (
                    <Badge variant="secondary" className={`rounded-full ${selectedComparisonSummary.direction === "up" ? "bg-rose-50 text-rose-700" : selectedComparisonSummary.direction === "down" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {selectedComparisonSummary.direction === "up" ? <ArrowUpRight className="mr-1 h-3 w-3" /> : selectedComparisonSummary.direction === "down" ? <ArrowDownRight className="mr-1 h-3 w-3" /> : null}
                      {selectedComparisonSummary.percent} vs prior month
                    </Badge>
                  ) : <Badge variant="secondary" className="rounded-full">New baseline</Badge>}
                  <Badge variant="secondary" className="rounded-full">6-month view</Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[320px] pt-3">
                {analyticsQuery.isLoading ? <LoadingState /> : comparisonData.length ? <MonthlySpendingChart data={comparisonData} selectedMonthKey={selectedComparison?.monthKey ?? null} onSelectMonth={setSelectedComparisonMonthKey} /> : <EmptyChart title="No monthly trend yet" detail="Add expenses across a few months to see your spending direction." />}
              </CardContent>
            </Card>
            <div className="mt-6"><RecentExpenses rows={recentExpenses} onEdit={row => { setExpense({ id: row.id, amount: String(row.amount), date: row.date, description: row.description, category: row.category, aiSuggestedCategory: row.aiSuggestedCategory }); setIsExpenseDialogOpen(true); }} onDelete={id => deleteExpense.mutate({ id })} isDeleting={deleteExpense.isPending} onViewAll={() => setLocation("/transactions")} onAdd={() => { setExpense(emptyExpense()); setIsExpenseDialogOpen(true); }} /></div>
            <div className="mt-6"><SavingsGoalPanel goal={savingsGoal} target={savingsTarget} current={savingsCurrent} targetDate={savingsDate} setTarget={setSavingsTarget} setCurrent={setSavingsCurrent} setTargetDate={setSavingsDate} onSubmit={handleSavingsGoalSubmit} onDelete={() => deleteSavingsGoal.mutate()} isSaving={saveSavingsGoal.isPending} /></div>
            <AdvancedPlanningPanel recurringRows={recurringQuery.data ?? []} recurringDraft={recurringDraft} setRecurringDraft={setRecurringDraft} onRecurringSubmit={handleRecurringSubmit} onDeleteRecurring={id => deleteRecurring.mutate({ id })} isRecurringSaving={createRecurring.isPending || deleteRecurring.isPending} alerts={alertsQuery.data} warningThreshold={warningThreshold} setWarningThreshold={setWarningThreshold} onAlertSubmit={handleAlertSubmit} isAlertSaving={saveAlertSettings.isPending} reportStart={reportStart} setReportStart={setReportStart} reportEnd={reportEnd} setReportEnd={setReportEnd} onReportDownload={handleReportDownload} isReportLoading={reportQuery.isFetching} />
          </>
        )}

        {view === "transactions" && (
          <>
            <SectionHeading eyebrow="Ledger" title="Transactions" description="Review, edit, or remove every expense in your private ledger." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={handleExportCsv} className="rounded-xl"><Download className="mr-2 h-4 w-4" /> Export CSV</Button><label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"><Upload className="mr-2 h-4 w-4" /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} /></label><Button onClick={() => setLocation("/")} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"><Plus className="mr-2 h-4 w-4" /> Add on overview</Button></div>} />
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="border-0 bg-slate-900 text-white shadow-[0_10px_30px_rgba(25,35,25,0.13)]"><CardHeader><CardTitle className="text-base text-white">{expense.id ? "Edit expense" : "New expense"}</CardTitle></CardHeader><CardContent><ExpenseForm expense={expense} setExpense={setExpense} onSubmit={handleExpenseSubmit} onSuggest={handleSuggest} isSuggesting={isSuggesting} onScanReceipt={handleScanReceipt} isScanningReceipt={isScanningReceipt} isSaving={createExpense.isPending || updateExpense.isPending} onCancel={() => setExpense(emptyExpense())} dark /></CardContent></Card>
              <div className="space-y-4">
                <TransactionFiltersBar filters={transactionFilters} setFilters={setTransactionFilters} resultCount={filteredTransactions.length} />
                <RecentExpenses rows={filteredTransactions} onEdit={row => { setExpense({ id: row.id, amount: String(row.amount), date: row.date, description: row.description, category: row.category, aiSuggestedCategory: row.aiSuggestedCategory }); setIsExpenseDialogOpen(true); }} onDelete={id => deleteExpense.mutate({ id })} isDeleting={deleteExpense.isPending} onAdd={() => { setExpense(emptyExpense()); setIsExpenseDialogOpen(true); }} />
              </div>
            </div>
          </>
        )}

        {view === "budgets" && <BudgetsView monthLabel={monthLabel} budgetRows={budgetRows} categoryTotals={analytics?.categoryTotals ?? []} budgetProgress={budgetProgress} budgetCategory={budgetCategory} setBudgetCategory={setBudgetCategory} budgetLimit={budgetLimit} setBudgetLimit={setBudgetLimit} onSubmit={handleBudgetSubmit} isSaving={saveBudget.isPending} onDelete={id => deleteBudget.mutate({ id })} />}
        {view === "insights" && <InsightsView monthLabel={monthLabel} analytics={analytics} isLoading={analyticsQuery.isLoading} />}
        {view === "shared" && <SharedGroupsView />}
      </div>
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-lg border-0 bg-white p-0 shadow-2xl">
          <div className="rounded-t-lg bg-slate-900 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Edit transaction</DialogTitle>
              <DialogDescription className="text-slate-400">Update the details, then save the change to your private ledger.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6">
            <ExpenseForm
              expense={expense}
              setExpense={setExpense}
              onSubmit={handleExpenseSubmit}
              onSuggest={handleSuggest}
              isSuggesting={isSuggesting}
              onScanReceipt={handleScanReceipt}
              isScanningReceipt={isScanningReceipt}
              isSaving={createExpense.isPending || updateExpense.isPending || deleteExpense.isPending}
              onCancel={() => { setExpense(emptyExpense()); setIsExpenseDialogOpen(false); }}
              onDelete={id => {
                deleteExpense.mutate({ id });
                setIsExpenseDialogOpen(false);
                setExpense(emptyExpense());
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdvancedPlanningPanel({ recurringRows, recurringDraft, setRecurringDraft, onRecurringSubmit, onDeleteRecurring, isRecurringSaving, alerts, warningThreshold, setWarningThreshold, onAlertSubmit, isAlertSaving, reportStart, setReportStart, reportEnd, setReportEnd, onReportDownload, isReportLoading }: { recurringRows: any[]; recurringDraft: { amount: string; description: string; category: string; frequency: "monthly" | "weekly"; dayOfMonth: string }; setRecurringDraft: React.Dispatch<React.SetStateAction<{ amount: string; description: string; category: string; frequency: "monthly" | "weekly"; dayOfMonth: string }>>; onRecurringSubmit: (event: FormEvent) => void; onDeleteRecurring: (id: number) => void; isRecurringSaving: boolean; alerts: any; warningThreshold: string; setWarningThreshold: (value: string) => void; onAlertSubmit: (event: FormEvent) => void; isAlertSaving: boolean; reportStart: string; setReportStart: (value: string) => void; reportEnd: string; setReportEnd: (value: string) => void; onReportDownload: () => void; isReportLoading: boolean }) {
  return <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader><div className="flex items-center gap-2"><div className="rounded-xl bg-violet-50 p-2 text-violet-600"><Repeat2 className="h-4 w-4" /></div><div><CardTitle className="text-base text-slate-900">Recurring expense planner</CardTitle><p className="mt-1 text-xs text-slate-500">Model subscriptions, rent, and predictable commitments before they surprise your budget.</p></div></div></CardHeader><CardContent><form onSubmit={onRecurringSubmit} className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Amount (LKR)</Label><Input type="number" min="1" step="0.01" value={recurringDraft.amount} onChange={event => setRecurringDraft(current => ({ ...current, amount: event.target.value }))} placeholder="2500" /></div><div className="space-y-2"><Label>Day of month</Label><Input type="number" min="1" max="31" value={recurringDraft.dayOfMonth} onChange={event => setRecurringDraft(current => ({ ...current, dayOfMonth: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Description</Label><Input value={recurringDraft.description} onChange={event => setRecurringDraft(current => ({ ...current, description: event.target.value }))} placeholder="Netflix subscription" /></div><div className="space-y-2"><Label>Category</Label><Select value={recurringDraft.category} onValueChange={value => setRecurringDraft(current => ({ ...current, category: value }))}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Frequency</Label><Select value={recurringDraft.frequency} onValueChange={value => setRecurringDraft(current => ({ ...current, frequency: value as "monthly" | "weekly" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div><Button type="submit" disabled={isRecurringSaving} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 sm:col-span-2">{isRecurringSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add recurring expense</Button></form>{recurringRows.length ? <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">{recurringRows.map(row => <div key={row.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{row.description}</p><p className="mt-1 text-xs text-slate-500">{row.category} · {row.frequency} · day {row.dayOfMonth}</p></div><p className="text-sm font-semibold text-slate-900">{formatMoney(row.amountCents)}</p><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDeleteRecurring(row.id)} disabled={isRecurringSaving}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div> : <p className="mt-5 text-xs text-slate-500">No recurring commitments yet. Add one to improve projected-spend planning.</p>}</CardContent></Card>
    <div className="space-y-6">
      <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader><div className="flex items-center gap-2"><div className="rounded-xl bg-amber-50 p-2 text-amber-600"><ShieldAlert className="h-4 w-4" /></div><div><CardTitle className="text-base text-slate-900">Budget guardrails</CardTitle><p className="mt-1 text-xs text-slate-500">Warn me when a category reaches this share of its limit.</p></div></div></CardHeader><CardContent><form onSubmit={onAlertSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label>Warning threshold (%)</Label><Input type="number" min="50" max="100" value={warningThreshold} onChange={event => setWarningThreshold(event.target.value)} /></div><Button type="submit" disabled={isAlertSaving} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">{isAlertSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />} Save</Button></form>{alerts?.budgetWarnings?.length ? <div className="mt-4 space-y-2">{alerts.budgetWarnings.map((warning: any) => <div key={warning.category} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${warning.severity === "over" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}><span>{warning.category} · {warning.percent}% used</span><span>{formatMoney(Math.round(warning.spent * 100))} / {formatMoney(Math.round(warning.limit * 100))}</span></div>)}</div> : <p className="mt-4 text-xs text-emerald-700">No budget overload warnings for {alerts?.monthKey ?? "this month"}.</p>}</CardContent></Card>
      <Card className="border-0 bg-slate-900 text-white shadow-[0_10px_30px_rgba(25,35,25,0.13)]"><CardHeader><div className="flex items-center gap-2"><div className="rounded-xl bg-white/10 p-2 text-emerald-300"><FileDown className="h-4 w-4" /></div><div><CardTitle className="text-base text-white">Download a report</CardTitle><p className="mt-1 text-xs text-slate-400">Export any timeframe, not only the current month.</p></div></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label className="text-slate-300">From</Label><Input type="date" value={reportStart} onChange={event => setReportStart(event.target.value)} className="border-slate-700 bg-slate-800 text-white" /></div><div className="space-y-2"><Label className="text-slate-300">To</Label><Input type="date" value={reportEnd} onChange={event => setReportEnd(event.target.value)} className="border-slate-700 bg-slate-800 text-white" /></div></div><Button type="button" onClick={onReportDownload} disabled={isReportLoading} className="mt-4 w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">{isReportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download CSV report</Button></CardContent></Card>
    </div>
  </div>;
}

function SavingsGoalPanel({ goal, target, current, targetDate, setTarget, setCurrent, setTargetDate, onSubmit, onDelete, isSaving }: { goal: any; target: string; current: string; targetDate: string; setTarget: (value: string) => void; setCurrent: (value: string) => void; setTargetDate: (value: string) => void; onSubmit: (event: FormEvent) => void; onDelete: () => void; isSaving: boolean }) {
  const [editing, setEditing] = useState(false);
  const showingGoal = Boolean(goal) && !editing;
  return <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><div className="flex items-center gap-2"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><PiggyBank className="h-4 w-4" /></div><div><CardTitle className="text-base text-slate-900">Savings runway</CardTitle><p className="mt-1 text-xs text-slate-500">A personal target beyond monthly category limits.</p></div></div></div>{goal && <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}</CardHeader><CardContent>{showingGoal ? <div className="space-y-4"><div className="flex items-end justify-between gap-4"><div><p className="text-3xl font-semibold tracking-tight text-slate-950">{formatMoney(goal.currentCents)} <span className="text-base font-normal text-slate-400">/ {formatMoney(goal.targetCents)}</span></p><p className="mt-1 text-xs text-slate-500">Target date: {formatCompactDate(goal.targetDate)}</p></div><Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{goal.progress}% funded</Badge></div><Progress value={goal.progress} className="h-3" /><p className="text-sm text-slate-600">{goal.progress >= 100 ? "Goal reached. Keep the momentum going." : `${formatMoney(Math.max(0, goal.targetCents - goal.currentCents))} remaining to reach your target.`}</p><Button variant="outline" className="rounded-xl" onClick={() => { setTarget(String(goal.target)); setCurrent(String(goal.current)); setTargetDate(goal.targetDate); setEditing(true); }}>Update goal</Button></div> : <form onSubmit={event => { onSubmit(event); setEditing(false); }} className="grid gap-4 md:grid-cols-4"><div className="space-y-2"><Label>Target (LKR)</Label><Input type="number" min="1" value={target} onChange={event => setTarget(event.target.value)} placeholder="150000" /></div><div className="space-y-2"><Label>Already saved (LKR)</Label><Input type="number" min="0" value={current} onChange={event => setCurrent(event.target.value)} placeholder="25000" /></div><div className="space-y-2"><Label>Target date</Label><Input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></div><div className="flex items-end"><Button disabled={isSaving} type="submit" className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />} {goal ? "Update goal" : "Set savings goal"}</Button></div></form>}</CardContent></Card>;
}

function ExpenseForm({
  expense,
  setExpense,
  onSubmit,
  onSuggest,
  isSuggesting,
  onScanReceipt,
  isScanningReceipt,
  isSaving,
  onCancel,
  onDelete,
  dark = false,
}: {
  expense: EditingExpense;
  setExpense: React.Dispatch<React.SetStateAction<EditingExpense>>;
  onSubmit: (event: FormEvent) => void;
  onSuggest: () => void;
  isSuggesting: boolean;
  onScanReceipt: (file: File) => void;
  isScanningReceipt: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  dark?: boolean;
}) {
  const receiptInputId = useId();
  const label = dark ? "text-slate-300" : "text-slate-600";
  const input = dark ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" : "bg-white";
  return <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label className={label}>Amount (LKR)</Label><Input required type="number" min="1" step="0.01" value={expense.amount} onChange={event => setExpense(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" className={input} /></div>
      <div className="space-y-2"><Label className={label}>Date</Label><Input required type="date" value={expense.date} onChange={event => setExpense(current => ({ ...current, date: event.target.value }))} className={input} /></div>
    </div>
    <div className="space-y-2"><Label className={label}>Description</Label><Input required value={expense.description} onChange={event => setExpense(current => ({ ...current, description: event.target.value }))} placeholder="e.g. Lunch at Java Lounge" className={input} /></div>
    <div className={`flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2.5 ${dark ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-slate-50"}`}>
      <div className="min-w-0"><p className={`text-xs font-medium ${dark ? "text-slate-200" : "text-slate-700"}`}>Have a receipt?</p><p className={`mt-0.5 text-[11px] ${dark ? "text-slate-500" : "text-slate-500"}`}>Smart extraction suggests amount, date, merchant, and category.</p></div>
      <label htmlFor={receiptInputId} className={`inline-flex shrink-0 cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isScanningReceipt ? "pointer-events-none opacity-60" : dark ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25" : "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 hover:bg-emerald-50"}`}>
        {isScanningReceipt ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ScanLine className="mr-1.5 h-3.5 w-3.5" />}
        {isScanningReceipt ? "Scanning…" : "Scan receipt"}
        <input id={receiptInputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) onScanReceipt(file); event.currentTarget.value = ""; }} disabled={isScanningReceipt} />
      </label>
    </div>
    <div className="space-y-2"><div className="flex items-center justify-between"><Label className={label}>Category</Label><Button type="button" variant="ghost" size="sm" onClick={onSuggest} disabled={isSuggesting} className="h-7 px-2 text-xs text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200">{isSuggesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BrainCircuit className="mr-1 h-3 w-3" />} Smart suggestion</Button></div><Select value={expense.category} onValueChange={value => setExpense(current => ({ ...current, category: value }))}><SelectTrigger className={input}><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(category => <SelectItem value={category} key={category}>{category}</SelectItem>)}</SelectContent></Select>{expense.aiSuggestedCategory && <p className="flex items-center gap-1 text-xs text-emerald-300"><Sparkles className="h-3 w-3" /> Smart suggestion applied: {expense.aiSuggestedCategory}</p>}</div>
    <div className="flex gap-2 pt-2">
      <Button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
        {expense.id ? "Save changes" : "Save expense"}
      </Button>
      {expense.id && onDelete && (
        <Button
          type="button"
          variant="destructive"
          onClick={() => onDelete(expense.id!)}
          disabled={isSaving}
          className="rounded-xl"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      {expense.id && (
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  </form>;
}

function TransactionFiltersBar({ filters, setFilters, resultCount }: { filters: TransactionFilters; setFilters: (filters: TransactionFilters) => void; resultCount: number }) {
  const hasActiveFilters = Boolean(filters.search || filters.fromDate || filters.toDate || (filters.category && filters.category !== "all") || (filters.currency && filters.currency !== "all"));

  return (
    <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={filters.search ?? ""}
                onChange={event => setFilters({ ...filters, search: event.target.value })}
                placeholder="Search description, category, or currency"
                aria-label="Search transactions"
                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{resultCount}</span> matching transaction{resultCount === 1 ? "" : "s"}
              {hasActiveFilters && <Button type="button" variant="ghost" size="sm" onClick={() => setFilters({ search: "", fromDate: "", toDate: "", category: "all", currency: "all" })} className="h-8 rounded-lg text-xs text-slate-500 hover:text-slate-900"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="transaction-from-date" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From date</Label><Input id="transaction-from-date" type="date" value={filters.fromDate ?? ""} onChange={event => setFilters({ ...filters, fromDate: event.target.value })} className="h-9 rounded-lg border-slate-200 bg-slate-50 text-xs" /></div>
            <div className="space-y-1.5"><Label htmlFor="transaction-to-date" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To date</Label><Input id="transaction-to-date" type="date" value={filters.toDate ?? ""} onChange={event => setFilters({ ...filters, toDate: event.target.value })} className="h-9 rounded-lg border-slate-200 bg-slate-50 text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</Label><Select value={filters.category ?? "all"} onValueChange={category => setFilters({ ...filters, category })}><SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{EXPENSE_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Currency</Label><Select value={filters.currency ?? "all"} onValueChange={currency => setFilters({ ...filters, currency })}><SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50 text-xs"><SelectValue placeholder="All currencies" /></SelectTrigger><SelectContent><SelectItem value="all">All currencies</SelectItem>{SUPPORTED_CURRENCIES.map(currency => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentExpenses({
  rows,
  onEdit,
  onDelete,
  isDeleting,
  onViewAll,
  onAdd,
  hasFiltersActive,
  onResetFilters,
}: {
  rows: Array<{ id: number; amount: number; date: string; description: string; category: string; currency?: string | null; aiSuggestedCategory?: string | null }>;
  onEdit: (row: any) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  onViewAll?: () => void;
  onAdd?: () => void;
  hasFiltersActive?: boolean;
  onResetFilters?: () => void;
}) {
  return (
    <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-slate-900">Recent expenses</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Your latest activity</p>
        </div>
        {onViewAll && <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-slate-500">View all <ChevronRight className="ml-1 h-3 w-3" /></Button>}
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="group flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CategoryIcon category={row.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{row.description}</p>
                    {row.aiSuggestedCategory && <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{row.category} · {row.currency ?? "LKR"} · {formatCompactDate(row.date)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatMoney(Math.round(row.amount * 100))}</p>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(row.id)} disabled={isDeleting}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : hasFiltersActive ? (
          <EmptyState
            title="No matching transactions"
            detail="No expenses match your search or filter criteria. Try adjusting your search term or clearing filters."
            action={onResetFilters ? <Button onClick={onResetFilters} variant="outline" className="mt-4 rounded-xl"><RotateCcw className="mr-2 h-4 w-4" /> Reset filters</Button> : undefined}
          />
        ) : (
          <EmptyState
            title="Your ledger is waiting"
            detail="Add your first expense to start seeing your spending clearly."
            action={onAdd ? <Button onClick={onAdd} className="mt-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800"><Plus className="mr-2 h-4 w-4" /> Add your first expense</Button> : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CategoryPie({ data }: { data: Array<{ category: string; totalCents: number }> }) {
  return <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center"><div className="h-[210px] min-w-0 flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="totalCents" nameKey="category" innerRadius={58} outerRadius={82} paddingAngle={3}>{data.map(item => <Cell key={item.category} fill={getCategoryColor(item.category)} />)}</Pie><Tooltip formatter={(value: number) => formatMoney(value)} /></PieChart></ResponsiveContainer></div><div className="space-y-2 sm:w-44">{data.slice(0, 4).map(item => <div className="flex items-center justify-between gap-3 text-xs" key={item.category}><span className="flex min-w-0 items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(item.category) }} /> <span className="truncate">{item.category}</span></span><span className="font-semibold text-slate-900">{formatMoney(item.totalCents)}</span></div>)}</div></div>;
}

function MonthlySpendingChart({ data, selectedMonthKey, onSelectMonth }: { data: Array<{ monthKey: string; label: string; totalCents: number; previousTotalCents: number; deltaCents: number; deltaPercent: number | null }>; selectedMonthKey: string | null; onSelectMonth: (monthKey: string) => void }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <ChartContainer config={{ totalCents: { label: "Selected month", theme: { light: "#059669", dark: "#34d399" } }, previousTotalCents: { label: "Prior month", theme: { light: "#cbd5e1", dark: "#64748b" } } }} className="min-h-0 flex-1 w-full aspect-auto">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={value => `${Math.round(Number(value) / 1000)}k`} className="text-muted-foreground" />
          <Tooltip formatter={(value: number, name: string) => [formatMoney(Number(value)), name === "totalCents" ? "Selected month" : "Prior month"]} labelFormatter={label => `Month: ${label}`} />
          <Bar dataKey="previousTotalCents" fill="var(--color-previousTotalCents)" radius={[6, 6, 0, 0]} onClick={(entry: any) => { const monthKey = entry?.payload?.monthKey; if (monthKey) onSelectMonth(monthKey); }}>
            {data.map(point => <Cell key={`previous-${point.monthKey}`} fill={point.monthKey === selectedMonthKey ? "#94a3b8" : "#e2e8f0"} />)}
          </Bar>
          <Bar dataKey="totalCents" fill="var(--color-totalCents)" radius={[6, 6, 0, 0]} onClick={(entry: any) => { const monthKey = entry?.payload?.monthKey; if (monthKey) onSelectMonth(monthKey); }}>
            {data.map(point => <Cell key={`current-${point.monthKey}`} fill={point.monthKey === selectedMonthKey ? "#047857" : "#34d399"} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Click a month to inspect its change.</span>
        <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Selected month</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> Prior month</span></div>
      </div>
    </div>
  );
}

function BudgetsView({ monthLabel, budgetRows, categoryTotals, budgetProgress, budgetCategory, setBudgetCategory, budgetLimit, setBudgetLimit, onSubmit, isSaving, onDelete }: { monthLabel: string; budgetRows: any[]; categoryTotals: Array<{ category: string; totalCents: number }>; budgetProgress: number; budgetCategory: string; setBudgetCategory: (value: string) => void; budgetLimit: string; setBudgetLimit: (value: string) => void; onSubmit: (event: FormEvent) => void; isSaving: boolean; onDelete: (id: number) => void }) {
  return <><SectionHeading eyebrow="Planning" title="Monthly budgets" description={`Set category limits for ${monthLabel}, then use the progress bars to stay intentional.`} /><div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]"><Card className="border-0 bg-slate-900 text-white shadow-[0_10px_30px_rgba(25,35,25,0.13)]"><CardHeader><CardTitle className="text-base text-white">Set a category goal</CardTitle><p className="mt-1 text-xs text-slate-400">One limit per category, per month.</p></CardHeader><CardContent><form onSubmit={onSubmit} className="space-y-4"><div className="space-y-2"><Label className="text-slate-300">Category</Label><Select value={budgetCategory} onValueChange={setBudgetCategory}><SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-slate-300">Monthly limit (LKR)</Label><Input type="number" min="1" step="1" value={budgetLimit} onChange={event => setBudgetLimit(event.target.value)} placeholder="50000" className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" /></div><Button disabled={isSaving} type="submit" className="w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />} Save budget</Button></form></CardContent></Card><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-base text-slate-900">Your limits</CardTitle><p className="mt-1 text-xs text-slate-500">{budgetRows.length ? "Progress is based on your current month spend." : "No category limits set yet."}</p></div><Badge variant="secondary" className="rounded-full">{Math.round(budgetProgress)}% overall</Badge></div></CardHeader><CardContent>{budgetRows.length ? <div className="space-y-5">{budgetRows.map(row => { const spentCents = categoryTotals.find(item => item.category === row.category)?.totalCents ?? 0; const categoryProgress = row.limitCents ? Math.min(100, (spentCents / row.limitCents) * 100) : 0; return <div key={row.id}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-800">{row.category}</span><div className="flex items-center gap-3"><span className="text-xs text-slate-500">{formatMoney(spentCents)} / {formatMoney(row.limitCents)}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => onDelete(row.id)}><Trash2 className="h-3 w-3" /></Button></div></div><Progress value={categoryProgress} className="h-2" /></div>; })}</div> : <EmptyState title="Start with one category" detail="A food, transport, or bills limit is a useful first step." />}</CardContent></Card></div></>;
}

function InsightsView({ monthLabel, analytics, isLoading }: { monthLabel: string; analytics: any; isLoading: boolean }) {
  const summary = analytics?.summary;
  return <><SectionHeading eyebrow="Patterns" title="Insights" description={`Understand how your spending moves through ${monthLabel}. These metrics and charts update from your own entries.`} /><div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Daily burn rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{formatMoney(summary?.dailyBurnRateCents ?? 0)}</div><p className="mt-1 text-xs text-slate-500">Average spent per day over {summary?.daysElapsed ?? 1} days</p></CardContent></Card><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected month-end</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{formatMoney(summary?.projectedMonthEndCents ?? 0)}</div><p className="mt-1 text-xs text-slate-500">Estimated total for all {summary?.daysInMonth ?? 30} days</p></CardContent></Card><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Savings pace</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{summary?.budgetTotalCents ? formatMoney(Math.max(0, summary.budgetTotalCents - (summary?.projectedMonthEndCents ?? 0))) : "No budget set"}</div><p className="mt-1 text-xs text-slate-500">Projected buffer under total monthly limits</p></CardContent></Card><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Budget utilization</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{summary?.budgetTotalCents ? `${Math.round((summary.budgetSpentCents / summary.budgetTotalCents) * 100)}%` : "No limits"}</div><p className="mt-1 text-xs text-slate-500">{summary?.budgetTotalCents ? `${formatMoney(summary.budgetSpentCents)} of ${formatMoney(summary.budgetTotalCents)}` : "Set limits in Budgets tab"}</p></CardContent></Card></div><div className="grid gap-6 lg:grid-cols-2"><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader><CardTitle className="text-base text-slate-900">Category breakdown</CardTitle><p className="mt-1 text-xs text-slate-500">Where your money went this month</p></CardHeader><CardContent className="h-[340px]">{isLoading ? <LoadingState /> : analytics?.categoryTotals?.length ? <CategoryPie data={analytics.categoryTotals} /> : <EmptyChart title="No data to visualize" detail="Add expenses and your category mix will appear here." />}</CardContent></Card><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]"><CardHeader><CardTitle className="text-base text-slate-900">Daily rhythm</CardTitle><p className="mt-1 text-xs text-slate-500">Spending totals across the month</p></CardHeader><CardContent className="h-[340px] pt-5">{isLoading ? <LoadingState /> : analytics?.dailyTotals?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.dailyTotals} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="date" tickFormatter={value => value.slice(8)} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tickFormatter={value => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip formatter={(value: number) => formatMoney(value)} labelFormatter={value => `Date: ${value}`} /><Bar dataKey="totalCents" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart title="No daily rhythm yet" detail="Your daily spending will become visible here." />}</CardContent></Card></div></>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="flex flex-col items-center justify-center py-10 text-center"><div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-400"><CalendarDays className="h-5 w-5" /></div><p className="text-sm font-medium text-slate-700">{title}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{detail}</p>{action}</div>; }
function EmptyChart({ title, detail }: { title: string; detail: string }) { return <div className="flex h-full items-center justify-center"><EmptyState title={title} detail={detail} /></div>; }
function LoadingState() { return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>; }

function SharedGroupsView() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCurrency, setNewGroupCurrency] = useState("LKR");
  const [newMemberName, setNewMemberName] = useState("");
  const [billDesc, setBillDesc] = useState("");
  const [billCategory, setBillCategory] = useState("Housing");
  const [billTotal, setBillTotal] = useState("");
  const [billMethod, setBillMethod] = useState<"equal" | "percentage" | "fixed" | "occupancy">("equal");
  const [billDate, setBillDate] = useState(today());
  const [billPayer, setBillPayer] = useState<string>("none");
  const [memberInputs, setMemberInputs] = useState<Record<number, string>>({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);

  const aiParseMutation = trpc.shared.parseAiBillAllocation.useMutation({
    onSuccess: (data) => {
      if (!data.success || !data.extracted) {
        toast.error((data as any).error || "Could not parse bill allocation prompt.");
        return;
      }
      const ext = data.extracted;
      setBillDesc(ext.description);
      setBillCategory(ext.category);
      setBillTotal((ext.totalCents / 100).toString());
      setBillMethod(ext.allocationMethod as any);
      if (ext.payerMemberId) setBillPayer(String(ext.payerMemberId));
      const newInputs: Record<number, string> = {};
      ext.shares.forEach(s => {
        newInputs[s.memberId] = String(s.inputValue);
      });
      setMemberInputs(newInputs);
      setAiExplanation(ext.explanation);
      setClarification(ext.clarificationNeeded);
      toast.success("The assistant prepared an allocation preview. Review and confirm to save.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAiParse = (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroupId || !aiPrompt.trim()) return;
    aiParseMutation.mutate({ groupId: activeGroupId, prompt: aiPrompt });
  };

  const groupsQuery = trpc.shared.groups.useQuery();
  const activeGroupId = selectedGroupId ?? groupsQuery.data?.[0]?.id ?? null;
  const membersQuery = trpc.shared.members.useQuery({ groupId: activeGroupId! }, { enabled: Boolean(activeGroupId) });
  const billsQuery = trpc.shared.bills.useQuery({ groupId: activeGroupId! }, { enabled: Boolean(activeGroupId) });
  const settlementQuery = trpc.shared.settlement.useQuery({ groupId: activeGroupId! }, { enabled: Boolean(activeGroupId) });
  const settlementsListQuery = trpc.shared.settlements.useQuery({ groupId: activeGroupId! }, { enabled: Boolean(activeGroupId) });
  const upsertSettlementMutation = trpc.shared.upsertSettlement.useMutation({
    onSuccess: () => {
      utils.shared.settlements.invalidate();
      toast.success("Settlement status updated successfully.");
    },
    onError: (err) => toast.error(err.message),
  });
  const exportSettlementPdfMutation = trpc.reports.exportSettlementPdf.useMutation({
    onSuccess: data => {
      downloadBase64File(data.pdfBase64, data.filename, data.contentType);
      toast.success("Settlement report downloaded as PDF.");
    },
    onError: err => toast.error(err.message),
  });
  const settlementData = settlementsListQuery.data ?? [];

  const utils = trpc.useUtils();
  const createInvitationMutation = trpc.shared.createInvitation.useMutation({
    onSuccess: () => {
      utils.shared.listInvitations.invalidate({ groupId: activeGroupId! });
      toast.success("Invitation token generated successfully!");
    },
    onError: (err) => toast.error(err.message),
  });
  const createRecurringBillMutation = trpc.shared.createRecurringBill.useMutation({
    onSuccess: () => {
      utils.shared.listRecurringBills.invalidate({ groupId: activeGroupId! });
      toast.success("Recurring bill scheduled successfully!");
    },
    onError: (err) => toast.error(err.message),
  });
  const createGroupMutation = trpc.shared.createGroup.useMutation({
    onSuccess: (data) => {
      utils.shared.groups.invalidate();
      if (data && "id" in data) setSelectedGroupId(data.id as number);
      setNewGroupName("");
      toast.success("Shared group created successfully.");
    },
    onError: (err) => toast.error(err.message),
  });

  const addMemberMutation = trpc.shared.addMember.useMutation({
    onSuccess: () => {
      utils.shared.members.invalidate();
      utils.shared.settlement.invalidate();
      setNewMemberName("");
      toast.success("Member added.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMemberMutation = trpc.shared.deleteMember.useMutation({
    onSuccess: () => {
      utils.shared.members.invalidate();
      utils.shared.bills.invalidate();
      utils.shared.settlement.invalidate();
      toast.success("Member removed.");
    },
    onError: (err) => toast.error(err.message),
  });

  const addBillMutation = trpc.shared.addBill.useMutation({
    onSuccess: () => {
      utils.shared.bills.invalidate();
      utils.shared.settlement.invalidate();
      setBillDesc("");
      setBillTotal("");
      setMemberInputs({});
      toast.success("Shared bill added and allocated.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBillMutation = trpc.shared.deleteBill.useMutation({
    onSuccess: () => {
      utils.shared.bills.invalidate();
      utils.shared.settlement.invalidate();
      toast.success("Shared bill deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  const groupList = groupsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const settlement = settlementQuery.data;

  useEffect(() => {
    if (members.length && Object.keys(memberInputs).length === 0) {
      const initial: Record<number, string> = {};
      members.forEach(m => {
        initial[m.id] = billMethod === "equal" ? "1" : billMethod === "percentage" ? Math.round(100 / members.length).toString() : "7";
      });
      setMemberInputs(initial);
    }
  }, [members, billMethod]);

  const handleCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({ name: newGroupName, currency: newGroupCurrency });
  };

  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroupId || !newMemberName.trim()) return;
    addMemberMutation.mutate({ groupId: activeGroupId, displayName: newMemberName });
  };

  const handleAddBill = (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroupId) return;
    const total = Number(billTotal);
    if (!Number.isFinite(total) || total <= 0 || !billDesc.trim() || !isValidDateInput(billDate)) {
      toast.error("Please enter a valid bill description, positive total, and date.");
      return;
    }
    const shares = members.map(m => ({
      memberId: m.id,
      inputValue: Number(memberInputs[m.id] ?? (billMethod === "equal" ? 1 : 0)),
    }));
    addBillMutation.mutate({
      groupId: activeGroupId,
      description: billDesc,
      category: billCategory as any,
      totalCents: Math.round(total * 100),
      allocationMethod: billMethod,
      billDate,
      payerMemberId: billPayer === "none" ? null : Number(billPayer),
      shares,
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Collaboration" title="Shared expense allocations" description="Split roommate rent, utility bills, or travel expenses equally, by percentages, fixed amounts, or occupancy days." />
      
      <div className="flex flex-wrap items-center gap-3">
        {groupList.map(g => (
          <Button key={g.id} variant={activeGroupId === g.id ? "default" : "outline"} onClick={() => setSelectedGroupId(g.id)} className={`rounded-xl ${activeGroupId === g.id ? "bg-slate-900 text-white" : ""}`}>
            {g.name} ({g.currency})
          </Button>
        ))}
        <form onSubmit={handleCreateGroup} className="flex items-center gap-2">
          <Input placeholder="New group name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="h-9 w-48 rounded-xl bg-white text-sm" />
          <Button type="submit" size="sm" disabled={createGroupMutation.isPending} className="rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
            <Plus className="mr-1 h-3.5 w-3.5" /> Create group
          </Button>
        </form>
      </div>

      {!activeGroupId ? (
        <EmptyState title="No shared groups yet" detail="Create a group above for your roommates, family, or travel partners to start splitting bills." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-900">Group members & occupancy</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Add members to include them in bill splits.</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{members.length} members</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMember} className="mb-4 flex gap-2">
                  <Input placeholder="Member name (e.g. Nimal)" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="rounded-xl" />
                  <Button type="submit" disabled={addMemberMutation.isPending} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </form>
                {members.length ? (
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{initials(m.displayName)}</div>
                          <span className="font-medium text-slate-800">{m.displayName}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => deleteMemberMutation.mutate({ groupId: activeGroupId, memberId: m.id })} disabled={deleteMemberMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No members in this group yet. Add at least two to split bills.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-slate-900 text-white shadow-[0_10px_30px_rgba(25,35,25,0.13)]">
              <CardHeader>
                <CardTitle className="text-base text-white">Add shared bill (with Smart Assistant)</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Describe the bill in plain language (e.g., "August electricity LKR 18,500 paid by Sunil, split by 30 and 15 occupancy days") to let the assistant calculate the split.</p>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-xl bg-emerald-950/40 p-3 border border-emerald-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                    <Sparkles className="h-4 w-4" /> Bill Allocation Assistant
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder='e.g. "Water bill 30000 LKR paid by Sunil, Sunil 30 days, Nimal 15 days"'
                      className="border-emerald-800/60 bg-slate-950 text-xs text-white placeholder:text-slate-500"
                    />
                    <Button type="button" onClick={handleAiParse} disabled={aiParseMutation.isPending || !aiPrompt.trim()} className="rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 text-xs shrink-0">
                      {aiParseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Smart Split"}
                    </Button>
                  </div>
                  {aiExplanation && (
                    <div className="rounded-lg bg-slate-950/80 p-3 text-xs text-emerald-200 border border-emerald-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-emerald-300">💡 Explanation & Preview</span>
                        <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] uppercase text-emerald-200">{billMethod} split</span>
                      </div>
                      <p>{aiExplanation}</p>
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-emerald-900/60">
                        {members.map(m => {
                          const rawVal = Number(billTotal) || 0;
                          const inputVal = Number(memberInputs[m.id]) || 0;
                          let shareCentsEst = 0;
                          if (billMethod === "equal") {
                            shareCentsEst = Math.round((rawVal * 100) / Math.max(members.length, 1));
                          } else if (billMethod === "percentage") {
                            shareCentsEst = Math.round((rawVal * 100 * inputVal) / 100);
                          } else if (billMethod === "fixed") {
                            shareCentsEst = Math.round(inputVal * 100);
                          } else {
                            const totalDays = members.reduce((sum, mem) => sum + (Number(memberInputs[mem.id]) || 0), 0);
                            shareCentsEst = totalDays > 0 ? Math.round((rawVal * 100 * inputVal) / totalDays) : 0;
                          }
                          return (
                            <div key={m.id} className="flex justify-between text-slate-300 bg-slate-900/80 px-2 py-1 rounded">
                              <span>{m.displayName}:</span>
                              <span className="font-semibold text-emerald-400">LKR {(shareCentsEst / 100).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                      {clarification && <p className="text-amber-300 pt-1">⚠️ Note: {clarification}</p>}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddBill} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Total amount (LKR)</Label>
                      <Input type="number" min="1" step="0.01" value={billTotal} onChange={e => setBillTotal(e.target.value)} placeholder="12500" className="border-slate-700 bg-slate-800 text-white" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Bill date</Label>
                      <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="border-slate-700 bg-slate-800 text-white" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Description</Label>
                    <Input value={billDesc} onChange={e => setBillDesc(e.target.value)} placeholder="e.g. Monthly Electricity Bill" className="border-slate-700 bg-slate-800 text-white" required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Category</Label>
                      <Select value={billCategory} onValueChange={setBillCategory}>
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Split method</Label>
                      <Select value={billMethod} onValueChange={v => setBillMethod(v as any)}>
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal">Equal split</SelectItem>
                          <SelectItem value="occupancy">Occupancy days (e.g. water/light)</SelectItem>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed amount (LKR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Who paid?</Label>
                    <Select value={billPayer} onValueChange={setBillPayer}>
                      <SelectTrigger className="border-slate-700 bg-slate-800 text-white"><SelectValue placeholder="Paid out of pocket..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General shared fund</SelectItem>
                        {members.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.displayName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {members.length >= 2 && (
                    <div className="space-y-2 rounded-xl bg-slate-800/80 p-3">
                      <Label className="text-xs text-slate-300">
                        {billMethod === "equal" ? "Splitting equally across members" : billMethod === "occupancy" ? "Enter days stayed at boarding place (e.g., 30 vs 15 days)" : billMethod === "percentage" ? "Enter percentage share (must total 100)" : "Enter exact share amount (LKR)"}
                      </Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-3 py-1.5 text-xs">
                            <span className="text-slate-200">{m.displayName}</span>
                            {billMethod === "equal" ? (
                              <span className="text-slate-400">1 share</span>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                value={memberInputs[m.id] ?? ""}
                                onChange={e => setMemberInputs(curr => ({ ...curr, [m.id]: e.target.value }))}
                                className="h-7 w-20 border-slate-700 bg-slate-900 text-right text-xs text-white"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button type="submit" disabled={addBillMutation.isPending || members.length < 2} className="w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                    {addBillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Add and split bill
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-900">Settlement summary</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Who owes whom to settle all group bills.</p>
                  </div>
                  <Badge className="rounded-full bg-emerald-50 text-emerald-700">{formatMoney(settlement?.totalCents ?? 0)} total</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {settlement?.transfers?.length ? (
                  <div className="space-y-2">
                    {settlement.transfers.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl bg-emerald-50/60 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{t.fromName}</span>
                          <span className="text-xs text-slate-500">pays</span>
                          <span className="font-semibold text-slate-900">{t.toName}</span>
                        </div>
                        <span className="font-bold text-emerald-700">{formatMoney(t.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">All settled up. No transfers required right now.</p>
                )}

                {settlement?.members?.length ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net member balances</p>
                    <div className="mt-3 space-y-2">
                      {settlement.members.map(m => (
                        <div key={m.memberId} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{m.displayName}</span>
                          <span className={m.netCents > 0 ? "font-semibold text-red-600" : m.netCents < 0 ? "font-semibold text-emerald-600" : "text-slate-500"}>
                            {m.netCents > 0 ? `Owes ${formatMoney(m.netCents)}` : m.netCents < 0 ? `Gets back ${formatMoney(Math.abs(m.netCents))}` : "Settled"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader>
                <CardTitle className="text-base text-slate-900">Recorded shared bills</CardTitle>
                <p className="mt-1 text-xs text-slate-500">History of all bills split in this group.</p>
              </CardHeader>
              <CardContent>
                {settlement?.bills?.length ? (
                  <div className="space-y-3">
                    {settlement.bills.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{b.description}</p>
                          <p className="text-xs text-slate-500">{b.category} · {formatCompactDate(typeof b.billDate === "string" ? b.billDate : b.billDate.toISOString().slice(0, 10))} · {b.allocationMethod} split</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">{formatMoney(b.totalCents)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => deleteBillMutation.mutate({ groupId: activeGroupId!, billId: b.id })} disabled={deleteBillMutation.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No shared bills recorded yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Group Invitations & Access</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Generate secure invite tokens for roommates and group members.</p>
                </div>
                <Button size="sm" className="h-8 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => {
                  createInvitationMutation.mutate({ groupId: activeGroupId!, role: "member" });
                }}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate Invite Link
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">Active invite tokens for this group:</p>
                  {/* We can list invitations or show status */}
                  <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-medium text-slate-800">ledgerly.app/invite/{activeGroupId}</span>
                      <p className="text-slate-400 mt-0.5">Role: Member · Status: Active</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 rounded-lg text-xs" onClick={() => {
                      navigator.clipboard.writeText(`https://ledgerly.app/invite/group-${activeGroupId}`);
                      toast.success("Invite link copied to clipboard!");
                    }}>
                      Copy Link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Recurring Shared Bills & Automations</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Set up automatic recurring utility bills, rent, and subscription splits.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50 space-y-3">
                    <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Schedule New Recurring Bill</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input placeholder="Bill Title (e.g. Monthly Electricity)" id="rec-title" className="h-8 text-xs bg-white" />
                      <Input placeholder="Amount (LKR)" type="number" id="rec-amount" className="h-8 text-xs bg-white" />
                      <Input placeholder="Next Due Date (YYYY-MM-DD)" defaultValue={today()} id="rec-date" className="h-8 text-xs bg-white" />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500">Runs monthly with equal split among group members.</span>
                      <Button size="sm" className="h-8 text-xs rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => {
                        const title = (document.getElementById("rec-title") as HTMLInputElement)?.value;
                        const amountStr = (document.getElementById("rec-amount") as HTMLInputElement)?.value;
                        const date = (document.getElementById("rec-date") as HTMLInputElement)?.value;
                        if (!title || !amountStr) {
                          toast.error("Please enter bill title and amount.");
                          return;
                        }
                        const amountCents = Math.round(parseFloat(amountStr) * 100);
                        createRecurringBillMutation.mutate({
                          groupId: activeGroupId!,
                          title,
                          amountCents,
                          currency: DEFAULT_CURRENCY,
                          splitMode: "equal",
                          frequency: "monthly",
                          nextDueDate: date || today(),
                        });
                      }}>
                        Schedule Bill
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(25,35,25,0.05)]">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base text-slate-900">Settlement Management & Transfer History</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Track repayment status, attach payment evidence, and settle group debts safely.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-xl text-xs"
                  disabled={exportSettlementPdfMutation.isPending}
                  onClick={() => exportSettlementPdfMutation.mutate({ groupId: activeGroupId! })}
                >
                  {exportSettlementPdfMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
                  Export PDF
                </Button>
              </CardHeader>
              <CardContent>
                {settlementData?.length ? (
                  <div className="space-y-3">
                    {settlementData.map(st => {
                      const fromMember = members.find(m => m.id === st.fromMemberId)?.displayName ?? `Member #${st.fromMemberId}`;
                      const toMember = members.find(m => m.id === st.toMemberId)?.displayName ?? `Member #${st.toMemberId}`;
                      return (
                        <div key={st.id} className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3.5 text-sm border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{fromMember} pays {toMember}</span>
                            <span className="font-bold text-slate-900">{(st.amountCents / 100).toLocaleString()}</span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Badge variant={st.status === "verified" || st.status === "paid" ? "default" : "secondary"} className="rounded-full capitalize">
                                {st.status}
                              </Badge>
                              {st.paymentMethod && <span className="text-slate-500">via {st.paymentMethod}</span>}
                              {st.referenceNote && <span className="text-slate-500">"{st.referenceNote}"</span>}
                            </div>
                            <div className="flex flex-col gap-2 w-full pt-2 border-t border-slate-100">
                              <div className="flex flex-wrap items-center gap-2">
                                <Input placeholder="Payment method (e.g. Bank Transfer, Cash)" defaultValue={st.paymentMethod ?? ""} id={`method-${st.id}`} className="h-7 text-xs w-36 rounded-lg bg-white" />
                                <Input placeholder="Reference note" defaultValue={st.referenceNote ?? ""} id={`note-${st.id}`} className="h-7 text-xs flex-1 min-w-[120px] rounded-lg bg-white" />
                                <Input placeholder="Evidence URL (receipt/screenshot)" defaultValue={st.evidenceUrl ?? ""} id={`evidence-${st.id}`} className="h-7 text-xs flex-1 min-w-[140px] rounded-lg bg-white" />
                              </div>
                              <div className="flex items-center justify-between gap-1 pt-1">
                                {upsertSettlementMutation.isPending ? (
                                  <span className="text-xs text-amber-600 animate-pulse font-medium">Saving transfer status...</span>
                                ) : (
                                  <span className="text-xs text-slate-400">Update status & attach evidence</span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="outline" disabled={upsertSettlementMutation.isPending} className="h-7 text-xs rounded-lg" onClick={() => {
                                    const method = (document.getElementById(`method-${st.id}`) as HTMLInputElement)?.value || "Bank Transfer";
                                    const note = (document.getElementById(`note-${st.id}`) as HTMLInputElement)?.value || "Paid";
                                    const evidence = (document.getElementById(`evidence-${st.id}`) as HTMLInputElement)?.value || "";
                                    upsertSettlementMutation.mutate({ groupId: activeGroupId!, fromMemberId: st.fromMemberId, toMemberId: st.toMemberId, amountCents: st.amountCents, status: "paid", paymentMethod: method, referenceNote: note, evidenceUrl: evidence });
                                  }}>
                                    Mark Paid
                                  </Button>
                                  <Button size="sm" variant="outline" disabled={upsertSettlementMutation.isPending} className="h-7 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" onClick={() => {
                                    const method = (document.getElementById(`method-${st.id}`) as HTMLInputElement)?.value || "Verified";
                                    const note = (document.getElementById(`note-${st.id}`) as HTMLInputElement)?.value || "Verified by recipient";
                                    const evidence = (document.getElementById(`evidence-${st.id}`) as HTMLInputElement)?.value || "";
                                    upsertSettlementMutation.mutate({ groupId: activeGroupId!, fromMemberId: st.fromMemberId, toMemberId: st.toMemberId, amountCents: st.amountCents, status: "verified", paymentMethod: method, referenceNote: note, evidenceUrl: evidence });
                                  }}>
                                    Verify & Close
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No settlement transfers recorded yet. Add bills above to calculate suggested settlements.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
