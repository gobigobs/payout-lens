import type { AnalyzedRow, Totals } from './types';

/**
 * Build the reconciled report CSV: every order with its full fee
 * breakdown, running payout total, and leak flags — plus a totals row.
 * Everything is computed from the same analysis the UI shows, so the
 * export and the screen can never disagree.
 */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const money = (paise: number): string => (paise / 100).toFixed(2);

export function buildReportCsv(
  rows: AnalyzedRow[],
  totals: Totals,
  platform: string,
): string {
  const header = [
    'order_id',
    'date',
    'platform',
    'order_value',
    'commission',
    'gst',
    'ad_spend',
    'discount_share',
    'total_fees',
    'payout',
    'running_payout_total',
    'fees_pct_of_order',
    'leak_flags',
  ];

  const lines: string[] = [header.join(',')];
  let running = 0;
  for (const r of rows) {
    running += r.payoutPaise;
    lines.push(
      [
        r.orderId,
        r.date,
        platform,
        money(r.orderValuePaise),
        money(r.commissionPaise),
        money(r.gstPaise),
        money(r.adSpendPaise),
        money(r.discountSharePaise),
        money(r.totalFeesPaise),
        money(r.payoutPaise),
        money(running),
        `${(r.feeShare * 100).toFixed(1)}%`,
        r.flags.map((f) => f.kind).join('; '),
      ]
        .map(csvCell)
        .join(','),
    );
  }

  lines.push(
    [
      'TOTAL',
      '',
      platform,
      money(totals.orderValuePaise),
      money(totals.commissionPaise),
      money(totals.gstPaise),
      money(totals.adSpendPaise),
      money(totals.discountSharePaise),
      money(totals.totalFeesPaise),
      money(totals.payoutPaise),
      money(totals.payoutPaise),
      `${((totals.totalFeesPaise / Math.max(totals.orderValuePaise, 1)) * 100).toFixed(1)}%`,
      `${totals.totalFlags} flag(s) on ${totals.flaggedOrders} order(s)`,
    ]
      .map(csvCell)
      .join(','),
  );

  return lines.join('\n');
}

export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'text/csv',
): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
