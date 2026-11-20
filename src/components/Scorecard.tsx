import { formatDate, formatINR, formatPct } from '../lib/format';
import type { Analysis } from '../lib/types';

function Kpi({
  label,
  value,
  sub,
  span,
  gold,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  span?: string;
  gold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`lux-card lux-hover p-5 ${span ?? ''} ${gold ? 'border-gold/30 bg-gradient-to-b from-gold/[0.12] to-transparent' : ''}`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fog">
        {label}
      </p>
      <p
        className={`tabular mt-2 font-mono text-[28px] leading-none font-semibold tracking-tight sm:text-[32px] ${
          gold ? 'text-gold' : muted ? 'text-mist' : 'text-cream'
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-mist">{sub}</p>
    </div>
  );
}

export default function Scorecard({ analysis }: { analysis: Analysis }) {
  const t = analysis.totals;
  return (
    <section>
      {/* Bento: payout is the hero tile, keep-rate the gold tile */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi
          label="Payout received"
          value={formatINR(t.payoutPaise)}
          sub={`avg ${formatINR(t.avgPayoutPaise)} / order · ${t.orders} orders`}
          span="col-span-2"
        />
        <Kpi
          label="You keep"
          value={formatPct(t.keepRate)}
          sub="of every ₹100 of GMV"
          gold
        />
        <Kpi
          label="GMV · order value"
          value={formatINR(t.orderValuePaise)}
          sub={`${t.orders} orders`}
          muted
        />
        <Kpi
          label="Total fees"
          value={formatINR(t.totalFeesPaise)}
          sub={`${formatPct(1 - t.keepRate)} of GMV`}
        />
        <Kpi
          label="Ad spend"
          value={formatINR(t.adSpendPaise)}
          sub={`${formatPct(t.adShareOfGmv)} of GMV`}
        />
      </div>

      {/* Leak strip — one line, points at the detector below */}
      <a
        href="#leaks"
        className="lux-hover lux-press mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-5 py-3.5"
      >
        <span className="font-mono text-sm font-semibold text-amber-200">
          {t.totalFlags} flags
        </span>
        <span className="text-sm text-mist">
          on {t.flaggedOrders} of {t.orders} orders — see the Leak detector below ↓
        </span>
      </a>

      <div className="lux-card mt-4 p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-[-0.01em] text-cream">Weekly scorecard</h2>
        <p className="mt-0.5 text-sm text-mist">
          Totals, averages and leaks per ISO week (Monday–Sunday).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
                <th className="py-2 pr-3 font-semibold">Week</th>
                <th className="py-2 pr-3 font-semibold">Orders</th>
                <th className="py-2 pr-3 font-semibold">GMV</th>
                <th className="py-2 pr-3 font-semibold">Commission</th>
                <th className="py-2 pr-3 font-semibold">GST</th>
                <th className="py-2 pr-3 font-semibold">Ads</th>
                <th className="py-2 pr-3 font-semibold">Discounts</th>
                <th className="py-2 pr-3 font-semibold">Payout</th>
                <th className="py-2 pr-3 font-semibold">Keep rate</th>
                <th className="py-2 font-semibold">Leaks</th>
              </tr>
            </thead>
            <tbody>
              {analysis.weeks.map((w) => (
                <tr
                  key={w.key}
                  className="border-b border-line last:border-0 transition-colors duration-200 hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pr-3 font-medium text-cream">
                    <span className="font-mono text-[13px]">{w.key}</span>
                    <span className="block text-xs font-normal text-fog">
                      {formatDate(w.weekStart)} – {formatDate(w.weekEnd)}
                    </span>
                  </td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px]">{w.totals.orders}</td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px]">{formatINR(w.totals.orderValuePaise)}</td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px] text-mist">{formatINR(w.totals.commissionPaise)}</td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px] text-mist">{formatINR(w.totals.gstPaise)}</td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px]">
                    {formatINR(w.totals.adSpendPaise)}
                    <span className="block text-xs text-fog">
                      {formatPct(w.totals.adShareOfGmv)} of GMV
                    </span>
                  </td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px] text-mist">{formatINR(w.totals.discountSharePaise)}</td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px] font-semibold text-gold">
                    {formatINR(w.totals.payoutPaise)}
                  </td>
                  <td className="tabular py-2.5 pr-3 font-mono text-[13px]">{formatPct(w.totals.keepRate)}</td>
                  <td className="py-2.5">
                    {w.flags.length === 0 ? (
                      <span className="text-gold-soft">Clean ✓</span>
                    ) : (
                      <span className="font-medium text-amber-200">
                        {w.flags.length} flag{w.flags.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {w.flags.map((f) => (
                      <span key={f.kind} className="block text-xs text-fog">
                        {f.label}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
