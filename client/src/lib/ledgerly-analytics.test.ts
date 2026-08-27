import { describe, expect, it } from "vitest";
import { buildMonthOverMonthComparison, filterTransactions, formatComparison } from "./ledgerly-analytics";

describe("Ledgerly month-over-month analytics", () => {
  it("calculates the prior month, delta, and percentage change for each point", () => {
    const result = buildMonthOverMonthComparison([
      { monthKey: "2026-06", label: "Jun", totalCents: 10000 },
      { monthKey: "2026-07", label: "Jul", totalCents: 12500 },
      { monthKey: "2026-08", label: "Aug", totalCents: 10000 },
    ]);

    expect(result[0]).toMatchObject({ previousTotalCents: 0, deltaCents: 10000, deltaPercent: null });
    expect(result[1]).toMatchObject({ previousTotalCents: 10000, deltaCents: 2500, deltaPercent: 25 });
    expect(result[2]).toMatchObject({ previousTotalCents: 12500, deltaCents: -2500, deltaPercent: -20 });
  });

  it("formats comparison direction without losing the baseline state", () => {
    expect(formatComparison(2500, 25)).toEqual({ direction: "up", percent: "25.0%" });
    expect(formatComparison(-2500, -20)).toEqual({ direction: "down", percent: "20.0%" });
    expect(formatComparison(5000, null)).toBe("New baseline");
  });
});

describe("Ledgerly transaction filters", () => {
  const rows = [
    { id: 1, amount: 1200, date: "2026-08-03", description: "Colombo groceries", category: "Food & dining", currency: "LKR" },
    { id: 2, amount: 40, date: "2026-08-10", description: "Airport taxi", category: "Transport", currency: "USD" },
    { id: 3, amount: 180, date: "2026-08-19", description: "Course subscription", category: "Education", currency: "EUR" },
  ];

  it("searches across description, category, and currency", () => {
    expect(filterTransactions(rows, { search: "airport" }).map(row => row.id)).toEqual([2]);
    expect(filterTransactions(rows, { search: "education" }).map(row => row.id)).toEqual([3]);
    expect(filterTransactions(rows, { search: "eur" }).map(row => row.id)).toEqual([3]);
  });

  it("combines inclusive date, category, and currency filters", () => {
    expect(filterTransactions(rows, { fromDate: "2026-08-05", toDate: "2026-08-20", category: "Transport", currency: "USD" }).map(row => row.id)).toEqual([2]);
    expect(filterTransactions(rows, { fromDate: "2026-08-05", toDate: "2026-08-20", category: "Food & dining" })).toEqual([]);
  });

  it("treats all as an unfiltered select value and defaults missing currency to LKR", () => {
    expect(filterTransactions([{ ...rows[0], currency: undefined }], { category: "all", currency: "LKR" }).map(row => row.id)).toEqual([1]);
    expect(filterTransactions(rows, { category: "all", currency: "all" })).toHaveLength(3);
  });
});
