export type MonthTotal = {
  monthKey: string;
  label: string;
  totalCents: number;
};

export type MonthOverMonthPoint = MonthTotal & {
  previousTotalCents: number;
  deltaCents: number;
  deltaPercent: number | null;
};

export type TransactionRecord = {
  id: number;
  amount: number;
  date: string;
  description: string;
  category: string;
  currency?: string | null;
  aiSuggestedCategory?: string | null;
};

export type TransactionFilters = {
  search?: string;
  fromDate?: string;
  toDate?: string;
  category?: string;
  currency?: string;
};

export function buildMonthOverMonthComparison(months: MonthTotal[]): MonthOverMonthPoint[] {
  return months.map((month, index) => {
    const previousTotalCents = months[index - 1]?.totalCents ?? 0;
    const deltaCents = month.totalCents - previousTotalCents;
    const deltaPercent = previousTotalCents > 0 ? (deltaCents / previousTotalCents) * 100 : null;

    return {
      ...month,
      previousTotalCents,
      deltaCents,
      deltaPercent,
    };
  });
}

export function filterTransactions<T extends TransactionRecord>(rows: T[], filters: TransactionFilters): T[] {
  const search = filters.search?.trim().toLowerCase() ?? "";

  return rows.filter(row => {
    const matchesSearch = !search || [row.description, row.category, row.currency ?? ""].some(value => value.toLowerCase().includes(search));
    const matchesFromDate = !filters.fromDate || row.date >= filters.fromDate;
    const matchesToDate = !filters.toDate || row.date <= filters.toDate;
    const matchesCategory = !filters.category || filters.category === "all" || row.category === filters.category;
    const matchesCurrency = !filters.currency || filters.currency === "all" || (row.currency ?? "LKR") === filters.currency;

    return matchesSearch && matchesFromDate && matchesToDate && matchesCategory && matchesCurrency;
  });
}

export function formatComparison(deltaCents: number, deltaPercent: number | null) {
  if (deltaPercent === null) return "New baseline";
  const direction = deltaCents > 0 ? "up" : deltaCents < 0 ? "down" : "flat";
  return {
    direction,
    percent: `${Math.abs(deltaPercent).toFixed(1)}%`,
  } as const;
}
