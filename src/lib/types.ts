/** Core domain types for Payout Lens.
 *
 * Money is handled as integer paise everywhere in the analysis layer.
 * CSV values arrive as decimals (rupees, 2dp); they are converted once at
 * the parse boundary so every sum below is exact — no float drift.
 */

export type Platform = 'Swiggy' | 'Zomato' | 'Other';

/** One order-level payout row, exactly as it appears in the CSV. */
export interface PayoutRow {
  orderId: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  orderValuePaise: number;
  commissionPaise: number;
  gstPaise: number;
  adSpendPaise: number;
  discountSharePaise: number;
  payoutPaise: number;
}

/** Leak rule identifiers. See LEAK_RULES in analyze.ts for the thresholds. */
export type LeakKind =
  | 'ADS_OVER_10'
  | 'HIGH_DISCOUNT'
  | 'FEE_HEAVY'
  | 'PAYOUT_MISMATCH';

export interface LeakFlag {
  kind: LeakKind;
  /** Short human label, e.g. "Ads over 10% of GMV". */
  label: string;
  /** The exact numbers behind the flag, e.g. "Ads ₹45.00 on a ₹380.00 order (11.8%)". */
  detail: string;
  /** 'high' = money is actively leaking; 'warn' = worth a look. */
  severity: 'high' | 'warn';
}

/** A parsed row plus everything derived from it. */
export interface AnalyzedRow extends PayoutRow {
  totalFeesPaise: number;
  /** Fees as a share of order value, 0..1 (0 when order value is 0). */
  feeShare: number;
  adShare: number;
  discountShare: number;
  /** orderValue - totalFees - payout. 0 means the platform's payout reconciles. */
  mismatchPaise: number;
  flags: LeakFlag[];
}

export interface Totals {
  orders: number;
  orderValuePaise: number;
  commissionPaise: number;
  gstPaise: number;
  adSpendPaise: number;
  discountSharePaise: number;
  totalFeesPaise: number;
  payoutPaise: number;
  /** payout / orderValue, 0..1. */
  keepRate: number;
  /** adSpend / orderValue, 0..1. */
  adShareOfGmv: number;
  avgOrderValuePaise: number;
  avgPayoutPaise: number;
  flaggedOrders: number;
  totalFlags: number;
}

/** One ISO week (Monday–Sunday) of orders. */
export interface WeekBucket {
  /** e.g. "2026-W46". */
  key: string;
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  /** Sunday of the week, YYYY-MM-DD. */
  weekEnd: string;
  totals: Totals;
  /** Week-level leak flags (same rules, applied to week totals). */
  flags: LeakFlag[];
}

export interface DayPoint {
  date: string;
  payoutPaise: number;
  orderValuePaise: number;
  orders: number;
}

export interface Analysis {
  rows: AnalyzedRow[];
  totals: Totals;
  weeks: WeekBucket[];
  daily: DayPoint[];
  /** All flags across all orders, most severe first. */
  allFlags: { orderId: string; date: string; flag: LeakFlag }[];
}
