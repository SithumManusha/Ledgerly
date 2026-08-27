import { invokeLLM } from "./_core/llm";
import { aliasCategory, EXPENSE_CATEGORIES, isValidDateString } from "../drizzle/schema";

export interface ParsedBankTransaction {
  date: string;
  description: string;
  amountCents: number;
  category: string;
  type: "debit" | "credit";
}

export interface BankStatementParseResult {
  bankName?: string;
  statementPeriod?: string;
  transactions: ParsedBankTransaction[];
  totalDebitCents: number;
  totalCreditCents: number;
}

/**
 * Parses raw text or PDF transcript extracted from bank/credit card statements.
 * Uses structured AI parsing with strict schema validation.
 */
export async function parseBankStatementText(rawText: string): Promise<BankStatementParseResult> {
  const truncatedText = rawText.slice(0, 15000); // Limit context size

  const systemPrompt = `You are a professional financial document parser. Extract all transactions from the following bank or credit card statement text into a structured JSON format.
Format requirements:
- "bankName": String or null
- "statementPeriod": String or null (e.g. "2026-08")
- "transactions": Array of objects:
  - "date": "YYYY-MM-DD" formatted date string
  - "description": clean merchant or transaction description
  - "amountCents": positive integer in cents (e.g. $15.50 = 1550, Rs. 1500 = 150000)
  - "category": choose closest from: [${EXPENSE_CATEGORIES.join(", ")}]
  - "type": "debit" (expense/money out) or "credit" (deposit/income/money in)
Return ONLY valid JSON matching this schema.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Statement text to parse:\n${truncatedText}` },
      ],
      responseFormat: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from statement parsing engine");
    }

    const parsed = JSON.parse(content) as {
      bankName?: string;
      statementPeriod?: string;
      transactions?: Array<{
        date?: string;
        description?: string;
        amountCents?: number;
        category?: string;
        type?: "debit" | "credit";
      }>;
    };

    const sanitizedTransactions: ParsedBankTransaction[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const tx of parsed.transactions || []) {
      if (!tx.description || !tx.amountCents || tx.amountCents <= 0) continue;
      
      const date = tx.date && isValidDateString(tx.date) ? tx.date : new Date().toISOString().slice(0, 10);
      const category = aliasCategory(tx.category || "Other");
      const type = tx.type === "credit" ? "credit" : "debit";
      const amountCents = Math.round(tx.amountCents);

      if (type === "debit") {
        totalDebit += amountCents;
      } else {
        totalCredit += amountCents;
      }

      sanitizedTransactions.push({
        date,
        description: tx.description.slice(0, 200).trim(),
        amountCents,
        category,
        type,
      });
    }

    return {
      bankName: parsed.bankName || "Unknown Bank",
      statementPeriod: parsed.statementPeriod || undefined,
      transactions: sanitizedTransactions,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
    };
  } catch (err) {
    console.error("[BankStatementParser] Error parsing statement:", err);
    throw new Error("Failed to parse bank statement. Please verify the file content format.");
  }
}
