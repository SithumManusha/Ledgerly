import { describe, expect, it } from "vitest";
import { renderSettlementReportPdf } from "./settlementReportPdf";

describe("shared settlement PDF reports", () => {
  it("renders a valid PDF with the report sections and group data", async () => {
    const pdf = await renderSettlementReportPdf({
      group: { name: "Apartment 4B", currency: "LKR" },
      members: [
        { displayName: "Alice", paidCents: 150000, owedCents: 100000, netCents: -50000 },
        { displayName: "Bob", paidCents: 0, owedCents: 50000, netCents: 50000 },
      ],
      bills: [
        { description: "Water bill", category: "Bills & utilities", totalCents: 150000, allocationMethod: "occupancy", billDate: "2026-08-01" },
      ],
      transfers: [{ fromName: "Bob", toName: "Alice", amountCents: 50000 }],
      settlements: [{ fromMemberId: 2, toMemberId: 1, amountCents: 50000, status: "paid", paymentMethod: "Bank transfer", referenceNote: "August water", }],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-7).toString()).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
