import { useMemo, useState } from 'react';
import { formatDate, formatINR, formatPct } from '../lib/format';
import type { Analysis } from '../lib/types';

export default function OrderTable({ analysis }: { analysis: Analysis }) {
  const [query, setQuery] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysis.rows.filter((r) => {
      if (onlyFlagged && r.flags.length === 0) return false;
      if (q && !r.orderId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [analysis.rows, query, onlyFlagged]);

  // Running total is over the full ordered list, not the filtered view.
  const runningById = useMemo(() => {
    const map = new Map<string, number>();
    let running = 0;
    for (const r of analysis.rows) {
      running += r.payoutPaise;
      map.set(r.orderId, running);
    }
    return map;
  }, [analysis.rows]);

  return (
    <section className="lux-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.01em] text-cream">Per-order breakdown</h2>
          <p className="mt-0.5 text-sm text-mist">
            Order value → commission → GST → ads → discount share → net payout, with a
            running total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by order id…"
            className="rounded-full border border-line-strong bg-white/[0.04] px-3 py-1.5 text-sm text-paper placeholder:text-fog transition-colors duration-200 focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-paper">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
              className="h-4 w-4 accent-[#c9a84c]"
            />
            Flagged only
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-mist">
          No orders match that filter.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
                <th className="py-2 pr-3 font-semibold">Order</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 text-right font-semibold">Order value</th>
                <th className="py-2 pr-3 text-right font-semibold">Commission</th>
                <th className="py-2 pr-3 text-right font-semibold">GST</th>
                <th className="py-2 pr-3 text-right font-semibold">Ads</th>
                <th className="py-2 pr-3 text-right font-semibold">Discount</th>
                <th className="py-2 pr-3 text-right font-semibold">Fees</th>
                <th className="py-2 pr-3 text-right font-semibold">Net payout</th>
                <th className="py-2 pr-3 text-right font-semibold">Running total</th>
                <th className="py-2 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.orderId}
                  className={`border-b border-line last:border-0 transition-colors duration-200 hover:bg-white/[0.03] ${r.flags.length > 0 ? 'bg-rose-400/[0.05]' : ''}`}
                >
                  <td className="py-2.5 pr-3 font-mono text-[13px] font-medium text-cream">{r.orderId}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-mist">{formatDate(r.date)}</td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px]">{formatINR(r.orderValuePaise)}</td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] text-mist">{formatINR(r.commissionPaise)}</td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] text-mist">{formatINR(r.gstPaise)}</td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px]">
                    {formatINR(r.adSpendPaise)}
                    {r.adSpendPaise > 0 && (
                      <span className="block text-xs text-fog">
                        {formatPct(r.adShare)} of order
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] text-mist">{formatINR(r.discountSharePaise)}</td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] font-medium text-rose-200">
                    {formatINR(r.totalFeesPaise)}
                    <span className="block text-xs font-normal text-fog">
                      {formatPct(r.feeShare)}
                    </span>
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] font-semibold text-gold">
                    {formatINR(r.payoutPaise)}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono text-[13px] text-mist">
                    {formatINR(runningById.get(r.orderId) ?? 0)}
                  </td>
                  <td className="py-2.5">
                    {r.flags.length === 0 ? (
                      <span className="text-xs text-fog">—</span>
                    ) : (
                      r.flags.map((f) => (
                        <span
                          key={f.kind}
                          title={f.detail}
                          className={`mr-1 inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                            f.severity === 'high'
                              ? 'bg-rose-400/10 text-rose-200 ring-1 ring-rose-300/25'
                              : 'bg-amber-300/10 text-amber-200 ring-1 ring-amber-300/25'
                          }`}
                        >
                          {f.kind}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-fog">
        Hover a flag chip to see the exact numbers behind it. Full details are in the
        Leak detector above.
      </p>
    </section>
  );
}
