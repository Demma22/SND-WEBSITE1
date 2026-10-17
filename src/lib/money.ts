/**
 * Money — one source of truth for prices across the site.
 *
 * Every price in the content is authored in USD. Everything a visitor sees in
 * another currency is derived from that one number, using rates fetched once
 * per build. Nothing here runs in the browser: `getRates()` is called during
 * `astro build`, the resulting table is serialised into the page, and the
 * client-side switcher just does arithmetic on it.
 *
 * Non-USD prices are shown with a "≈" because they are indicative conversions,
 * not the amount that will be charged — the sale is settled in conversation.
 */

export interface Currency {
  code: string;
  symbol: string;
  label: string;
  /** Emoji flag shown in the selector. */
  flag: string;
  /** Round converted prices to this increment, so they read as authored. */
  step: number;
}

/**
 * The selector. USD leads because the collector base is international and
 * "UGX 700,000" is unreadable to most of it; UGX is kept high in the list for
 * local buyers. Change DEFAULT_CURRENCY to go local-first.
 */
export const CURRENCIES: Currency[] = [
  { code: 'USD', flag: '🇺🇸', symbol: '$',   label: 'US Dollar',          step: 5 },
  { code: 'EUR', flag: '🇪🇺', symbol: '€',   label: 'Euro',               step: 5 },
  { code: 'GBP', flag: '🇬🇧', symbol: '£',   label: 'British Pound',      step: 5 },
  { code: 'UGX', flag: '🇺🇬', symbol: 'USh', label: 'Ugandan Shilling',   step: 10000 },
  { code: 'AUD', flag: '🇦🇺', symbol: 'A$',  label: 'Australian Dollar',  step: 5 },
  { code: 'CAD', flag: '🇨🇦', symbol: 'C$',  label: 'Canadian Dollar',    step: 5 },
  { code: 'CHF', flag: '🇨🇭', symbol: 'CHF', label: 'Swiss Franc',        step: 5 },
  { code: 'SEK', flag: '🇸🇪', symbol: 'kr',  label: 'Swedish Krona',      step: 50 },
  { code: 'AED', flag: '🇦🇪', symbol: 'AED', label: 'UAE Dirham',         step: 5 },
  { code: 'JPY', flag: '🇯🇵', symbol: '¥',   label: 'Japanese Yen',       step: 100 },
  { code: 'KES', flag: '🇰🇪', symbol: 'KSh', label: 'Kenyan Shilling',    step: 100 },
  { code: 'ZAR', flag: '🇿🇦', symbol: 'R',   label: 'South African Rand', step: 100 },
  { code: 'NGN', flag: '🇳🇬', symbol: '₦',   label: 'Nigerian Naira',     step: 1000 },
  { code: 'INR', flag: '🇮🇳', symbol: '₹',   label: 'Indian Rupee',       step: 100 },
];

export const DEFAULT_CURRENCY = 'USD';
export const BASE_CURRENCY = 'USD';

/** Where a visitor's choice is remembered. */
export const STORAGE_KEY = 'sndCurrency';

export type Rates = Record<string, number>;

/**
 * Committed snapshot (11 Oct 2026), used when the rate API is unreachable so a
 * build never fails and prices are never wildly wrong. Refreshed on every
 * successful build, so this only matters offline.
 */
export const FALLBACK_RATES: Rates = {
  USD: 1,
  EUR: 0.8924,
  GBP: 0.7559,
  UGX: 3994,
  AUD: 1.4331,
  CAD: 1.425,
  CHF: 0.7967,
  SEK: 9.42,
  AED: 3.6725,
  JPY: 151.2,
  KES: 129.71,
  ZAR: 17.26,
  NGN: 1452,
  INR: 88.5,
};

const RATES_URL = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

let cached: Rates | null = null;

/**
 * Live rates, fetched once per build. Free, no API key, and — unlike the ECB
 * feeds — it actually carries UGX. Falls back to the snapshot above on any
 * failure, and only overwrites currencies we actually offer.
 */
export async function getRates(): Promise<Rates> {
  if (cached) return cached;

  const rates: Rates = { ...FALLBACK_RATES };

  try {
    const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as { result?: string; rates?: Rates };
    if (json.result !== 'success' || !json.rates) throw new Error('unexpected payload');

    for (const { code } of CURRENCIES) {
      const rate = json.rates[code];
      if (typeof rate === 'number' && rate > 0) rates[code] = rate;
    }
  } catch (err) {
    // A build on a flaky connection should still ship, just on yesterday's rates.
    console.warn(
      `[money] live rates unavailable (${err instanceof Error ? err.message : err}) — using committed fallback`
    );
  }

  cached = rates;
  return rates;
}

export const getCurrency = (code: string): Currency =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

/**
 * A resolved price: one USD pivot that every currency converts from, plus any
 * currencies that were authored directly and must be shown verbatim.
 *
 * Authoring in UGX matters because the studio is paid in UGX: a piece priced at
 * 500,000 UGX should keep saying 500,000 UGX, not drift to 502,000 because the
 * rate moved overnight. The USD pivot is what floats instead, which is the
 * right way round — the local price is the real one.
 */
export interface ResolvedPrice {
  /** Pivot for every derived currency. */
  usd: number;
  /** Currencies written by hand, displayed exactly as authored. */
  authored: Record<string, number>;
}

export function resolvePrice(
  data: { priceUSD?: number; priceUGX?: number },
  rates: Rates
): ResolvedPrice | null {
  if (typeof data.priceUGX === 'number') {
    const rate = rates.UGX ?? FALLBACK_RATES.UGX;
    /* Tidy the pivot, but through roundTo so the step scales with the amount.
       A flat round-to-5 priced a 30,000 UGX study at $10 instead of $7.50 —
       33% out in every currency but the one it was written in. */
    const usd = roundTo(data.priceUGX / rate, 5);
    return { usd, authored: { UGX: data.priceUGX } };
  }
  if (typeof data.priceUSD === 'number') {
    return { usd: data.priceUSD, authored: { USD: data.priceUSD } };
  }
  return null;
}

/**
 * Round so converted prices read as authored rather than computed — but only
 * where the step is small relative to the amount.
 *
 * The steps are sized for artwork in the hundreds. Applied bluntly they would
 * wreck a cheap item: a 30,000 UGX notebook is about $7.43, and a flat
 * round-to-5 would price it at $5. So the coarse step only kicks in once the
 * amount is comfortably above it, and small amounts keep their real precision.
 */
export function roundTo(value: number, step: number): number {
  if (step > 0 && value >= step * 10) return Math.round(value / step) * step;
  if (value >= 10) return Math.round(value);
  return Math.round(value * 100) / 100;
}

/** Pennies only matter on small amounts; a £450 print doesn't want ".00". */
export const fractionDigits = (amount: number): number => (amount < 10 ? 2 : 0);

/**
 * Format a price in `code`, converting from the USD pivot unless that currency
 * was authored by hand — an authored figure is exact, so it loses the "≈".
 * Mirrored by the same logic in the client script — keep the two in step.
 */
export function formatMoney(
  usd: number,
  code: string,
  rates: Rates,
  authored: Record<string, number> = {}
): string {
  const currency = getCurrency(code);
  const exact = authored[code];
  const amount =
    exact ?? roundTo(usd * (rates[code] ?? FALLBACK_RATES[code] ?? 1), currency.step);

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits(amount),
    maximumFractionDigits: fractionDigits(amount),
  }).format(amount);

  /* Exact only in the currency the price was actually written in. Everything
     else — the USD pivot of a UGX-authored piece included — is a conversion
     that moves with the rate, and is marked as such. */
  const prefix = exact !== undefined ? '' : '≈ ';
  return `${prefix}${currency.symbol}${formatted}`;
}
