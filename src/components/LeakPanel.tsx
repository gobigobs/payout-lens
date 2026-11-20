import { LEAK_RULES } from '../lib/analyze';
import { formatDate } from '../lib/format';
import type { Analysis } from '../lib/types';

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-rose-400/10 text-rose-200 border-rose-300/30',
  warn: 'bg-amber-300/10 text-amber-200 border-amber-300/30',
};

export default function LeakPanel({ analysis }: { analysis: Analysis }) {
  const { allFlags, totals } = analysis;

  const byKind = new Map<string, number>();
  for (const { flag } of allFlags) {
    byKind.set(flag.kind, (byKind.get(flag.kind) ?? 0) + 1);
  }

  return (
    <section id="leaks" className="lux-card scroll-mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-[-0.01em] text-cream">Leak detector</h2>
        <p className="font-mono text-xs tracking-wide text-fog">
          {totals.totalFlags === 0
            ? 'No leaks in this data — every order reconciles and stays inside the limits.'
            : `${totals.totalFlags} flag${totals.totalFlags > 1 ? 's' : ''} on ${totals.flaggedOrders} of ${totals.orders} orders`}
        </p>
      </div>

      {/* Rule legend — the exact thresholds, always visible */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(LEAK_RULES) as (keyof typeof LEAK_RULES)[]).map((kind) => (
          <div
            key={kind}
            className="lux-hover rounded-xl border border-line bg-white/[0.03] p-3.5"
          >
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-paper">
              {LEAK_RULES[kind].label}
              <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[11px] text-gold-soft ring-1 ring-gold/25">
                {byKind.get(kind) ?? 0} hit{(byKind.get(kind) ?? 0) === 1 ? '' : 's'}
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-mist">
              {LEAK_RULES[kind].explain}
            </p>
          </div>
        ))}
      </div>

      {allFlags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {allFlags.map(({ orderId, date, flag }, i) => (
            <li
              key={`${orderId}-${flag.kind}-${i}`}
              className="lux-hover flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
            >
              <span
                className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[flag.severity]}`}
              >
                {flag.severity === 'high' ? '● Leak' : '● Watch'}
              </span>
              <span className="font-mono text-sm font-medium text-cream">{orderId}</span>
              <span className="text-sm text-fog">{formatDate(date)}</span>
              <span className="text-sm font-medium text-paper">{flag.label}</span>
              <span className="block w-full text-sm text-mist sm:w-auto sm:flex-1">
                {flag.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
