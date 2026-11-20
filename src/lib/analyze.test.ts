import { describe, expect, it } from 'vitest';
import { analyzePayouts, isoWeekOf } from './analyze';
import { buildReportCsv } from './exportCsv';
import { parsePayoutCsv } from './parse';
import { SAMPLE_DATASETS } from './samples';

/**
 * Hand-checked expected values.
 *
 * Computed independently (Python, Decimal arithmetic) from the two sample
 * CSVs in src/data/ and pasted here as constants — so if the analysis
 * code drifts, these tests fail. Recompute with:
 *   python3 -c "import csv; ..."  (see README, "Verifying the math")
 *
 * Swiggy sample (10 orders, 9–13 Nov 2026):
 *   GMV ₹5,548.00 · commission ₹1,109.60 · GST ₹199.72 · ads ₹200.00
 *   discount ₹619.00 · payout ₹3,419.68 · total fees ₹2,128.32
 *   keep rate 61.64% · ads 3.60% of GMV · avg order ₹554.80
 *   6 flagged orders, 9 flags total
 * Zomato sample (8 orders, 9–13 Nov 2026):
 *   GMV ₹4,980.00 · commission ₹1,095.60 · GST ₹197.21 · ads ₹215.00
 *   discount ₹495.00 · payout ₹2,977.19 · total fees ₹2,002.81
 *   keep rate 59.78% · ads 4.32% of GMV · avg order ₹622.50
 *   6 flagged orders, 9 flags total
 */

const swiggy = SAMPLE_DATASETS.find((s) => s.id === 'swiggy-sample')!;
const zomato = SAMPLE_DATASETS.find((s) => s.id === 'zomato-sample')!;

describe('sample CSVs parse cleanly', () => {
  it('swiggy sample: 10 rows, no errors', () => {
    const { rows, errors } = parsePayoutCsv(swiggy.csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(10);
  });

  it('zomato sample: 8 rows, no errors', () => {
    const { rows, errors } = parsePayoutCsv(zomato.csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(8);
  });

  it('every sample row reconciles exactly (value − fees = payout)', () => {
    for (const sample of [swiggy, zomato]) {
      const { rows } = parsePayoutCsv(sample.csv);
      for (const r of rows) {
        const fees =
          r.commissionPaise +
          r.gstPaise +
          r.adSpendPaise +
          r.discountSharePaise;
        expect(r.orderValuePaise - fees).toBe(r.payoutPaise);
      }
    }
  });
});

describe('swiggy sample totals', () => {
  const { totals } = analyzePayouts(parsePayoutCsv(swiggy.csv).rows);

  it('sums match hand-checked values (paise)', () => {
    expect(totals.orders).toBe(10);
    expect(totals.orderValuePaise).toBe(554800);
    expect(totals.commissionPaise).toBe(110960);
    expect(totals.gstPaise).toBe(19972);
    expect(totals.adSpendPaise).toBe(20000);
    expect(totals.discountSharePaise).toBe(61900);
    expect(totals.totalFeesPaise).toBe(212832);
    expect(totals.payoutPaise).toBe(341968);
  });

  it('rates match', () => {
    expect(totals.keepRate).toBeCloseTo(0.6164, 4);
    expect(totals.adShareOfGmv).toBeCloseTo(0.036, 3);
    expect(totals.avgOrderValuePaise).toBe(55480);
    expect(totals.avgPayoutPaise).toBe(34197);
  });

  it('leak counts match: 6 flagged orders, 9 flags', () => {
    expect(totals.flaggedOrders).toBe(6);
    expect(totals.totalFlags).toBe(9);
  });

  it('flags land on the right orders', () => {
    const { rows } = analyzePayouts(parsePayoutCsv(swiggy.csv).rows);
    const flagged = new Map(
      rows.filter((r) => r.flags.length > 0).map((r) => [
        r.orderId,
        r.flags.map((f) => f.kind).sort(),
      ]),
    );
    expect(flagged.get('SWG-1001')).toEqual(['FEE_HEAVY']);
    expect(flagged.get('SWG-1003')).toEqual(['ADS_OVER_10', 'FEE_HEAVY']);
    expect(flagged.get('SWG-1004')).toEqual(['FEE_HEAVY', 'HIGH_DISCOUNT']);
    expect(flagged.get('SWG-1005')).toEqual(['ADS_OVER_10']);
    expect(flagged.get('SWG-1007')).toEqual(['ADS_OVER_10', 'FEE_HEAVY']);
    expect(flagged.get('SWG-1009')).toEqual(['FEE_HEAVY']);
    expect(flagged.has('SWG-1002')).toBe(false);
    expect(flagged.has('SWG-1006')).toBe(false);
    expect(flagged.has('SWG-1008')).toBe(false);
    expect(flagged.has('SWG-1010')).toBe(false);
  });

  it('daily payout trend matches hand-checked values', () => {
    const { daily } = analyzePayouts(parsePayoutCsv(swiggy.csv).rows);
    expect(daily.map((d) => [d.date, d.payoutPaise])).toEqual([
      ['2026-11-09', 69048],
      ['2026-11-10', 66916],
      ['2026-11-11', 55700],
      ['2026-11-12', 72124],
      ['2026-11-13', 78180],
    ]);
  });

  it('all rows sit in one ISO week, 2026-W46 (Mon 9 – Sun 15 Nov)', () => {
    const { weeks } = analyzePayouts(parsePayoutCsv(swiggy.csv).rows);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].key).toBe('2026-W46');
    expect(weeks[0].weekStart).toBe('2026-11-09');
    expect(weeks[0].weekEnd).toBe('2026-11-15');
    expect(weeks[0].totals.payoutPaise).toBe(341968);
    // Week-level: ads 3.6% of GMV, so no week-level ADS_OVER_10 flag.
    expect(weeks[0].flags.map((f) => f.kind)).toEqual(['FEE_HEAVY']);
  });
});

describe('zomato sample totals', () => {
  const { totals } = analyzePayouts(parsePayoutCsv(zomato.csv).rows);

  it('sums match hand-checked values (paise)', () => {
    expect(totals.orders).toBe(8);
    expect(totals.orderValuePaise).toBe(498000);
    expect(totals.commissionPaise).toBe(109560);
    expect(totals.gstPaise).toBe(19721);
    expect(totals.adSpendPaise).toBe(21500);
    expect(totals.discountSharePaise).toBe(49500);
    expect(totals.totalFeesPaise).toBe(200281);
    expect(totals.payoutPaise).toBe(297719);
  });

  it('rates match', () => {
    expect(totals.keepRate).toBeCloseTo(0.5978, 4);
    expect(totals.adShareOfGmv).toBeCloseTo(0.0432, 3);
    expect(totals.avgOrderValuePaise).toBe(62250);
    expect(totals.avgPayoutPaise).toBe(37215);
  });

  it('leak counts match: 6 flagged orders, 9 flags', () => {
    expect(totals.flaggedOrders).toBe(6);
    expect(totals.totalFlags).toBe(9);
  });

  it('flags land on the right orders', () => {
    const { rows } = analyzePayouts(parsePayoutCsv(zomato.csv).rows);
    const flagged = new Map(
      rows.filter((r) => r.flags.length > 0).map((r) => [
        r.orderId,
        r.flags.map((f) => f.kind).sort(),
      ]),
    );
    expect(flagged.get('ZMT-2001')).toEqual(['FEE_HEAVY']);
    expect(flagged.get('ZMT-2003')).toEqual(['ADS_OVER_10', 'FEE_HEAVY']);
    expect(flagged.get('ZMT-2004')).toEqual(['FEE_HEAVY', 'HIGH_DISCOUNT']);
    expect(flagged.get('ZMT-2005')).toEqual(['FEE_HEAVY']);
    expect(flagged.get('ZMT-2006')).toEqual(['ADS_OVER_10', 'FEE_HEAVY']);
    expect(flagged.get('ZMT-2008')).toEqual(['FEE_HEAVY']);
  });
});

describe('leak rules', () => {
  it('flags a payout that does not reconcile (₹5 short)', () => {
    const { rows } = analyzePayouts(
      parsePayoutCsv(
        `order_id,date,order_value,commission,gst,ad_spend,discount_share,payout
T-1,2026-11-09,500.00,100.00,18.00,0.00,50.00,327.00`,
      ).rows,
    );
    // 500 − 168 = 332, but payout says 327 → ₹5.00 mismatch.
    expect(rows[0].mismatchPaise).toBe(500);
    expect(rows[0].flags.map((f) => f.kind)).toContain('PAYOUT_MISMATCH');
  });

  it('does not flag a payout that reconciles within ₹0.50', () => {
    const { rows } = analyzePayouts(
      parsePayoutCsv(
        `order_id,date,order_value,commission,gst,ad_spend,discount_share,payout
T-2,2026-11-09,500.00,100.00,18.00,0.00,50.00,332.40`,
      ).rows,
    );
    expect(rows[0].flags.map((f) => f.kind)).not.toContain('PAYOUT_MISMATCH');
  });

  it('ads at exactly 10% of GMV do not flag (rule is strictly over)', () => {
    const { rows } = analyzePayouts(
      parsePayoutCsv(
        `order_id,date,order_value,commission,gst,ad_spend,discount_share,payout
T-3,2026-11-09,500.00,100.00,18.00,50.00,0.00,332.00`,
      ).rows,
    );
    expect(rows[0].flags.map((f) => f.kind)).not.toContain('ADS_OVER_10');
  });
});

describe('parser robustness', () => {
  it('handles quoted fields, ₹ symbols, commas and CRLF', () => {
    const { rows, errors } = parsePayoutCsv(
      'order_id,date,order_value,commission,gst,ad_spend,discount_share,payout\r\n"Q-1, special",2026-11-09,"₹1,000.00",200.00,36.00,0.00,100.00,664.00\r\n',
    );
    expect(errors).toEqual([]);
    expect(rows[0].orderId).toBe('Q-1, special');
    expect(rows[0].orderValuePaise).toBe(100000);
    expect(rows[0].payoutPaise).toBe(66400);
  });

  it('skips bad rows but keeps the good ones, reporting each problem', () => {
    const { rows, errors } = parsePayoutCsv(
      `order_id,date,order_value,commission,gst,ad_spend,discount_share,payout
GOOD-1,2026-11-09,400.00,80.00,14.40,0.00,40.00,265.60
BAD-1,2026-11-09,not-a-number,80.00,14.40,0.00,40.00,265.60
BAD-2,09/11/2026,400.00,80.00,14.40,0.00,40.00,265.60`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBe('GOOD-1');
    expect(errors).toHaveLength(2);
  });

  it('rejects a CSV missing a required column', () => {
    const { rows, errors } = parsePayoutCsv(
      'order_id,date,order_value\nX-1,2026-11-09,100.00',
    );
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/Missing required column/);
  });
});

describe('ISO weeks', () => {
  it('2026-11-09 (Mon) and 2026-11-13 (Fri) share week 2026-W46', () => {
    expect(isoWeekOf('2026-11-09').key).toBe('2026-W46');
    expect(isoWeekOf('2026-11-13').key).toBe('2026-W46');
    expect(isoWeekOf('2026-11-13').weekEnd).toBe('2026-11-15');
  });

  it('2026-01-01 (Thu) is ISO week 1, starting Mon 2025-12-29', () => {
    const w = isoWeekOf('2026-01-01');
    expect(w.key).toBe('2026-W01');
    expect(w.weekStart).toBe('2025-12-29');
    expect(w.weekEnd).toBe('2026-01-04');
  });
});

describe('report export', () => {
  it('running total ends at the payout sum and TOTAL row matches', () => {
    const { rows, totals } = analyzePayouts(parsePayoutCsv(swiggy.csv).rows);
    const csv = buildReportCsv(rows, totals, 'Swiggy');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(12); // header + 10 orders + TOTAL
    expect(lines[10]).toContain('3419.68'); // running total on last order
    expect(lines[11]).toContain('TOTAL');
    expect(lines[11]).toContain('5548.00');
    expect(lines[11]).toContain('3419.68');
  });
});
