import { SupportedCurrency, SUPPORTED_CURRENCIES } from "../drizzle/schema";

interface ExchangeRateCache {
  base: string;
  rates: Record<string, number>;
  lastUpdated: number;
}

// Fallback baseline exchange rates against USD
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1.0,
  LKR: 305.5,
  EUR: 0.92,
  GBP: 0.78,
  INR: 83.5,
  AUD: 1.52,
  CAD: 1.36,
  SGD: 1.35,
  AED: 3.67,
};

let cache: ExchangeRateCache = {
  base: "USD",
  rates: FALLBACK_RATES,
  lastUpdated: 0,
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

export async function fetchLiveExchangeRates(): Promise<Record<SupportedCurrency, number>> {
  const now = Date.now();
  if (now - cache.lastUpdated < CACHE_TTL_MS && Object.keys(cache.rates).length > 0) {
    return cache.rates as Record<SupportedCurrency, number>;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (response.ok) {
      const data = (await response.json()) as { rates: Record<string, number> };
      const updatedRates = { ...FALLBACK_RATES };

      for (const curr of SUPPORTED_CURRENCIES) {
        if (data.rates && typeof data.rates[curr] === "number") {
          updatedRates[curr] = data.rates[curr];
        }
      }

      cache = {
        base: "USD",
        rates: updatedRates,
        lastUpdated: now,
      };
      return updatedRates;
    }
  } catch (err) {
    console.warn("[Currency] Failed to fetch live exchange rates, using fallback rates:", err);
  }

  return FALLBACK_RATES;
}

export async function convertCurrency(
  amountCents: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
): Promise<{ convertedAmountCents: number; rate: number }> {
  if (fromCurrency === toCurrency) {
    return { convertedAmountCents: amountCents, rate: 1.0 };
  }

  const rates = await fetchLiveExchangeRates();
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;

  // Convert from currency -> USD -> to currency
  const amountInUsd = (amountCents / 100) / fromRate;
  const convertedAmount = amountInUsd * toRate;
  const rate = toRate / fromRate;

  return {
    convertedAmountCents: Math.round(convertedAmount * 100),
    rate,
  };
}
