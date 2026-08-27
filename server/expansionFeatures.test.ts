import { describe, expect, it, vi } from "vitest";
import { convertCurrency, fetchLiveExchangeRates } from "./currencyService";
import { parseBankStatementText } from "./bankStatementParser";
import { buildBudgetAlertEmail, buildGroupBillAddedEmail } from "./emailService";
import { broadcastGroupEvent } from "./realtimeEvents";
import * as llmModule from "./_core/llm";

describe("Live Currency Service", () => {
  it("fetches supported exchange rates and converts currencies", async () => {
    const rates = await fetchLiveExchangeRates();
    expect(rates.USD).toBe(1.0);
    expect(rates.LKR).toBeGreaterThan(0);

    const conversion = await convertCurrency(10000, "USD", "USD"); // 100 USD
    expect(conversion.convertedAmountCents).toBe(10000);
    expect(conversion.rate).toBe(1.0);
  }, 15000);
});

describe("Bank Statement Parser", () => {
  it("extracts structured transactions from statement text", async () => {
    const spy = vi.spyOn(llmModule, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bankName: "Commercial Bank",
              statementPeriod: "2026-08",
              transactions: [
                {
                  date: "2026-08-10",
                  description: "Keells Super",
                  amountCents: 450000,
                  category: "Food & dining",
                  type: "debit",
                },
                {
                  date: "2026-08-11",
                  description: "Salary Deposit",
                  amountCents: 25000000,
                  category: "Other",
                  type: "credit",
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const result = await parseBankStatementText("Sample statement transcript");
    expect(result.bankName).toBe("Commercial Bank");
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe("Keells Super");
    expect(result.totalDebitCents).toBe(450000);
    expect(result.totalCreditCents).toBe(25000000);

    spy.mockRestore();
  });
});

describe("Email Notification Templates", () => {
  it("builds correct HTML and text for budget alert emails", () => {
    const email = buildBudgetAlertEmail("John", "Food & dining", "Rs. 18,000", "Rs. 20,000", 90);
    expect(email.subject).toContain("90% of Food & dining budget reached");
    expect(email.html).toContain("John");
    expect(email.html).toContain("Rs. 18,000");
  });

  it("builds correct group bill notification email", () => {
    const email = buildGroupBillAddedEmail("Alice", "Apartment 3B", "Internet Bill", "Bob", "Rs. 2,500");
    expect(email.subject).toContain("Internet Bill");
    expect(email.html).toContain("Apartment 3B");
  });
});

describe("Real-time Events", () => {
  it("broadcasts group events safely without throwing", () => {
    expect(() => {
      broadcastGroupEvent(1, "TEST_EVENT", { test: true });
    }).not.toThrow();
  });
});
