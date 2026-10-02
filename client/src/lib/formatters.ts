import { DEFAULT_CURRENCY } from "../../../drizzle/schema";

export function formatMoney(cents: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: currency || "LKR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCompactDate(date: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
