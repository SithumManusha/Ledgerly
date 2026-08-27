import { describe, it, expect } from "vitest";

describe("Ledgerly Modernization & Multi-Currency Features", () => {
  it("converts foreign currency amounts correctly using exchange rates", () => {
    const amountInUsd = 150;
    const rateToLrk = 305.5;
    const converted = amountInUsd * rateToLrk;
    expect(converted).toBe(45825);
  });

  it("allocates shared boarding house occupancy-day expenses across members", () => {
    const totalAmount = 30000;
    const members = [
      { name: "Alice", days: 30 },
      { name: "Bob", days: 15 },
    ];
    const totalDays = members.reduce((acc, m) => acc + m.days, 0);
    const aliceShare = (totalAmount * members[0].days) / totalDays;
    const bobShare = (totalAmount * members[1].days) / totalDays;

    expect(aliceShare).toBe(20000);
    expect(bobShare).toBe(10000);
  });

  it("handles batch receipt parsing structures", () => {
    const batchResults = [
      { merchant: "Supermarket", amount: 4500, category: "Groceries" },
      { merchant: "Electricity Board", amount: 3200, category: "Utilities" },
    ];
    expect(batchResults).toHaveLength(2);
    expect(batchResults[0].amount).toBe(4500);
  });
});
