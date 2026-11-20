import type {
  Analysis,
  AnalyzedRow,
  DayPoint,
  LeakFlag,
  LeakKind,
  PayoutRow,
  Totals,
  WeekBucket,
} from './types';

/**
 * The leak rules — the whole point of Payout Lens.
 *
 * These thresholds come from how Indian food-aggregator payouts actually
 * work, and from a real case: a Salem cafe found Swiggy charging ad spend
 * above 10% of GMV plus CPC ads and ad offers it had never agreed to —
 * a verified ₹16,582.51 overcharge claim. The 10% rule is the one
 * restaurant owners are told ("Unlimited Ads within 10% of GMV") and the
 * one platforms quietly exceed.
 *
 *   ADS_OVER_10     ad spend > 10% of the order's value (or the week's GMV)
 *   HIGH_DISCOUNT   restaurant's discount share > 20% of the order's value
 *   FEE_HEAVY       all fees together > 35% of the order's value — the
 *                   restaurant keeps under 65% before food cost
 *   PAYOUT_MISMATCH order value − fees ≠ payout by more than ₹0.50 —
 *                   the platform's own numbers don't reconcile
 */

export const LEAK_RULES = {
  ADS_OVER_10: {
    threshold: 0.1,
    label: 'Ads over 10% of GMV',
    explain:
      'Ad spend should stay within 10% of GMV. Above that, ads are eating the margin they were meant to grow.',
  },
  HIGH_DISCOUNT: {
    threshold: 0.2,
    label: 'Discount share over 20%',
    explain:
      'The restaurant is funding more than a fifth of the order value in discounts — check whether the offer is still worth it.',
  },
  FEE_HEAVY: {
    threshold: 0.35,
    label: 'Fees eat over 35%',
    explain:
      'Commission + GST + ads + discounts take more than 35% of the order. The restaurant keeps under 65% before food and labour costs.',
  },
  PAYOUT_MISMATCH: {
    thresholdPaise: 50,
    label: 'Payout does not reconcile',
    explain:
      'Order value minus all fees does not equal the payout the platform reports. The difference is money to chase.',
  },
} as const satisfies Record<
  LeakKind,
  { label: string; explain: string } & Record<string, number | string>
>;

function flag(
  kind: LeakKind,
  detail: string,
  severity: LeakFlag['severity'],
): LeakFlag {
  return { kind, label: LEAK_RULES[kind].label, detail, severity };
}

const rs = (paise: number): string => `₹${(paise / 100).toFixed(2)}`;
/** Two decimals: a 10.03% ad share must not display as "10.0%" next to a 10% limit. */
const pc = (ratio: number): string => `${(ratio * 100).toFixed(2)}%`;

function analyzeRow(row: PayoutRow): AnalyzedRow {
  const totalFeesPaise =
    row.commissionPaise +
    row.gstPaise +
    row.adSpendPaise +
    row.discountSharePaise;
  const ov = row.orderValuePaise;
  const feeShare = ov > 0 ? totalFeesPaise / ov : 0;
  const adShare = ov > 0 ? row.adSpendPaise / ov : 0;
  const discountShare = ov > 0 ? row.discountSharePaise / ov : 0;
  const mismatchPaise = ov - totalFeesPaise - row.payoutPaise;

  const flags: LeakFlag[] = [];
  if (row.adSpendPaise > ov * LEAK_RULES.ADS_OVER_10.threshold) {
    flags.push(
      flag(
        'ADS_OVER_10',
        `Ads ${rs(row.adSpendPaise)} on a ${rs(ov)} order (${pc(adShare)} of GMV, limit 10%)`,
        'high',
      ),
    );
  }
  if (row.discountSharePaise > ov * LEAK_RULES.HIGH_DISCOUNT.threshold) {
    flags.push(
      flag(
        'HIGH_DISCOUNT',
        `Discount share ${rs(row.discountSharePaise)} is ${pc(discountShare)} of a ${rs(ov)} order (limit 20%)`,
        'high',
      ),
    );
  }
  if (totalFeesPaise > ov * LEAK_RULES.FEE_HEAVY.threshold) {
    flags.push(
      flag(
        'FEE_HEAVY',
        `Fees ${rs(totalFeesPaise)} take ${pc(feeShare)} of a ${rs(ov)} order — you keep ${pc(1 - feeShare)} before food cost`,
        'warn',
      ),
    );
  }
  if (Math.abs(mismatchPaise) > LEAK_RULES.PAYOUT_MISMATCH.thresholdPaise) {
    flags.push(
      flag(
        'PAYOUT_MISMATCH',
        `${rs(ov)} − fees ${rs(totalFeesPaise)} = ${rs(ov - totalFeesPaise)}, but payout is ${rs(row.payoutPaise)} (diff ${rs(Math.abs(mismatchPaise))})`,
        'high',
      ),
    );
  }

  return {
    ...row,
    totalFeesPaise,
    feeShare,
    adShare,
    discountShare,
    mismatchPaise,
    flags,
  };
}

function sumTotals(rows: AnalyzedRow[]): Totals {
  const t: Totals = {
    orders: rows.length,
    orderValuePaise: 0,
    commissionPaise: 0,
    gstPaise: 0,
    adSpendPaise: 0,
    discountSharePaise: 0,
    totalFeesPaise: 0,
    payoutPaise: 0,
    keepRate: 0,
    adShareOfGmv: 0,
    avgOrderValuePaise: 0,
    avgPayoutPaise: 0,
    flaggedOrders: 0,
    totalFlags: 0,
  };
  for (const r of rows) {
    t.orderValuePaise += r.orderValuePaise;
    t.commissionPaise += r.commissionPaise;
    t.gstPaise += r.gstPaise;
    t.adSpendPaise += r.adSpendPaise;
    t.discountSharePaise += r.discountSharePaise;
    t.totalFeesPaise += r.totalFeesPaise;
    t.payoutPaise += r.payoutPaise;
    if (r.flags.length > 0) t.flaggedOrders++;
    t.totalFlags += r.flags.length;
  }
  if (t.orderValuePaise > 0) {
    t.keepRate = t.payoutPaise / t.orderValuePaise;
    t.adShareOfGmv = t.adSpendPaise / t.orderValuePaise;
  }
  if (t.orders > 0) {
    t.avgOrderValuePaise = Math.round(t.orderValuePaise / t.orders);
    t.avgPayoutPaise = Math.round(t.payoutPaise / t.orders);
  }
  return t;
}

/** ISO week key "2026-W46" + Monday/Sunday bounds for a YYYY-MM-DD date. */
export function isoWeekOf(isoDate: string): {
  key: string;
  weekStart: string;
  weekEnd: string;
} {
  const d = new Date(`${isoDate}T12:00:00Z`); // noon UTC avoids TZ edge cases
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  // ISO week number: week containing the year's first Thursday.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstMonday = new Date(firstThursday);
  firstMonday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7),
  );
  const weekNo =
    Math.round(
      (monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    ) + 1;
  const iso = (dt: Date): string => dt.toISOString().slice(0, 10);
  return {
    key: `${year}-W${String(weekNo).padStart(2, '0')}`,
    weekStart: iso(monday),
    weekEnd: iso(sunday),
  };
}

function weekFlags(totals: Totals): LeakFlag[] {
  const flags: LeakFlag[] = [];
  const gmv = totals.orderValuePaise;
  if (gmv <= 0) return flags;
  if (totals.adSpendPaise > gmv * LEAK_RULES.ADS_OVER_10.threshold) {
    flags.push(
      flag(
        'ADS_OVER_10',
        `Week ads ${rs(totals.adSpendPaise)} are ${pc(totals.adShareOfGmv)} of ${rs(gmv)} GMV (limit 10%)`,
        'high',
      ),
    );
  }
  if (totals.discountSharePaise > gmv * LEAK_RULES.HIGH_DISCOUNT.threshold) {
    flags.push(
      flag(
        'HIGH_DISCOUNT',
        `Week discount share ${rs(totals.discountSharePaise)} is ${pc(totals.discountSharePaise / gmv)} of GMV (limit 20%)`,
        'high',
      ),
    );
  }
  if (totals.totalFeesPaise > gmv * LEAK_RULES.FEE_HEAVY.threshold) {
    flags.push(
      flag(
        'FEE_HEAVY',
        `Week fees ${rs(totals.totalFeesPaise)} take ${pc(totals.totalFeesPaise / gmv)} of GMV`,
        'warn',
      ),
    );
  }
  return flags;
}

export function analyzePayouts(input: PayoutRow[]): Analysis {
  const rows = [...input]
    .sort((a, b) =>
      a.date === b.date
        ? a.orderId.localeCompare(b.orderId)
        : a.date.localeCompare(b.date),
    )
    .map(analyzeRow);

  const totals = sumTotals(rows);

  const byWeek = new Map<string, AnalyzedRow[]>();
  const weekMeta = new Map<string, { weekStart: string; weekEnd: string }>();
  for (const r of rows) {
    const { key, weekStart, weekEnd } = isoWeekOf(r.date);
    if (!byWeek.has(key)) {
      byWeek.set(key, []);
      weekMeta.set(key, { weekStart, weekEnd });
    }
    byWeek.get(key)!.push(r);
  }
  const weeks: WeekBucket[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, weekRows]) => {
      const wt = sumTotals(weekRows);
      return {
        key,
        ...weekMeta.get(key)!,
        totals: wt,
        flags: weekFlags(wt),
      };
    });

  const byDay = new Map<string, DayPoint>();
  for (const r of rows) {
    const d = byDay.get(r.date) ?? {
      date: r.date,
      payoutPaise: 0,
      orderValuePaise: 0,
      orders: 0,
    };
    d.payoutPaise += r.payoutPaise;
    d.orderValuePaise += r.orderValuePaise;
    d.orders++;
    byDay.set(r.date, d);
  }
  const daily: DayPoint[] = [...byDay.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const allFlags = rows
    .flatMap((r) =>
      r.flags.map((f) => ({ orderId: r.orderId, date: r.date, flag: f })),
    )
    .sort((a, b) =>
      a.flag.severity === b.flag.severity
        ? a.date.localeCompare(b.date)
        : a.flag.severity === 'high'
          ? -1
          : 1,
    );

  return { rows, totals, weeks, daily, allFlags };
}
