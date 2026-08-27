import PDFDocument from "pdfkit";

export type SettlementReportInput = {
  group: { name: string; currency: string };
  members: Array<{
    displayName: string;
    paidCents: number;
    owedCents: number;
    netCents: number;
  }>;
  bills: Array<{
    description: string;
    category: string;
    totalCents: number;
    allocationMethod: string;
    billDate: Date | string;
  }>;
  transfers: Array<{
    fromName: string;
    toName: string;
    amountCents: number;
  }>;
  settlements: Array<{
    fromMemberId: number;
    toMemberId: number;
    amountCents: number;
    status: string;
    paymentMethod: string | null;
    referenceNote: string | null;
  }>;
};

function cleanText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function drawSectionHeading(document: PDFKit.PDFDocument, title: string) {
  document.moveDown(0.8);
  document.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(title);
  document.moveDown(0.25);
  document.strokeColor("#cbd5e1").lineWidth(0.6).moveTo(50, document.y).lineTo(545, document.y).stroke();
  document.moveDown(0.45);
}

export async function renderSettlementReportPdf(input: SettlementReportInput) {
  const document = new PDFDocument({ size: "A4", margin: 50, info: { Title: `${input.group.name} settlement report`, Author: "Ledgerly" } });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    document.on("data", chunk => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const currency = cleanText(input.group.currency || "LKR");
    document.font("Helvetica-Bold").fontSize(22).fillColor("#064e3b").text("Ledgerly");
    document.font("Helvetica-Bold").fontSize(17).fillColor("#0f172a").text("Shared settlement report");
    document.font("Helvetica").fontSize(10).fillColor("#64748b").text(`${cleanText(input.group.name)} · ${currency} · Generated ${new Date().toISOString().slice(0, 10)}`);

    drawSectionHeading(document, "Settlement overview");
    const totalCents = input.bills.reduce((sum, bill) => sum + bill.totalCents, 0);
    document.font("Helvetica").fontSize(10).fillColor("#334155");
    document.text(`Shared bills recorded: ${input.bills.length}`);
    document.text(`Total shared spend: ${formatMoney(totalCents, currency)}`);
    document.text(`Outstanding transfers: ${input.transfers.length}`);

    drawSectionHeading(document, "Recommended transfers");
    if (!input.transfers.length) {
      document.fillColor("#475569").text("All members are settled up. No transfers are currently required.");
    } else {
      input.transfers.forEach((transfer, index) => {
        document.fillColor("#0f172a").font("Helvetica-Bold").text(`${index + 1}. ${cleanText(transfer.fromName)} pays ${cleanText(transfer.toName)}`);
        document.font("Helvetica").fillColor("#047857").text(formatMoney(transfer.amountCents, currency), { indent: 18 });
        document.moveDown(0.25);
      });
    }

    drawSectionHeading(document, "Member balances");
    input.members.forEach(member => {
      const status = member.netCents > 0
        ? `owes ${formatMoney(member.netCents, currency)}`
        : member.netCents < 0
          ? `gets back ${formatMoney(Math.abs(member.netCents), currency)}`
          : "settled";
      document.font("Helvetica-Bold").fillColor("#0f172a").text(cleanText(member.displayName));
      document.font("Helvetica").fillColor("#475569").text(`Paid ${formatMoney(member.paidCents, currency)} · Share ${formatMoney(member.owedCents, currency)} · ${status}`, { indent: 18 });
      document.moveDown(0.25);
    });

    drawSectionHeading(document, "Shared bill register");
    if (!input.bills.length) {
      document.fillColor("#475569").text("No shared bills have been recorded.");
    } else {
      input.bills.forEach(bill => {
        document.font("Helvetica-Bold").fillColor("#0f172a").text(cleanText(bill.description));
        document.font("Helvetica").fillColor("#475569").text(`${formatDate(bill.billDate)} · ${cleanText(bill.category)} · ${cleanText(bill.allocationMethod)} split · ${formatMoney(bill.totalCents, currency)}`, { indent: 18 });
        document.moveDown(0.25);
      });
    }

    drawSectionHeading(document, "Recorded settlement activity");
    if (!input.settlements.length) {
      document.fillColor("#475569").text("No settlement activity has been recorded yet.");
    } else {
      input.settlements.forEach(settlement => {
        const detail = [settlement.status, settlement.paymentMethod, settlement.referenceNote].filter((value): value is string => Boolean(value)).map(value => cleanText(value)).join(" · ");
        document.font("Helvetica").fillColor("#334155").text(`Members #${settlement.fromMemberId} → #${settlement.toMemberId} · ${formatMoney(settlement.amountCents, currency)} · ${detail || "No additional details"}`);
        document.moveDown(0.25);
      });
    }

    document.moveDown(1.2);
    document.font("Helvetica-Oblique").fontSize(8).fillColor("#94a3b8").text("Generated from the authorized shared-group ledger.");
    document.end();
  });
}
