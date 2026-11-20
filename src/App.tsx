import { lazy, Suspense, useMemo, useState } from 'react';
import ImportPanel, { type LoadedDataset } from './components/ImportPanel';
import LeakPanel from './components/LeakPanel';
import OrderTable from './components/OrderTable';
import Scorecard from './components/Scorecard';
import { analyzePayouts } from './lib/analyze';
import { buildReportCsv, downloadTextFile } from './lib/exportCsv';
import { formatDate, formatPct } from './lib/format';
import { parsePayoutCsv } from './lib/parse';
import { SAMPLE_DATASETS } from './lib/samples';

// Charts (Recharts) are the heaviest dependency — load them on demand so
// the first paint stays light. The fallback keeps layout stable.
const ChartsPanel = lazy(() => import('./components/ChartsPanel'));

function loadDefaultDataset(): LoadedDataset {
  const sample = SAMPLE_DATASETS[0];
  const { rows } = parsePayoutCsv(sample.csv);
  return {
    platform: sample.platform,
    label: sample.label,
    source: 'sample',
    rows,
  };
}

export default function App() {
  const [dataset, setDataset] = useState<LoadedDataset | null>(loadDefaultDataset);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const analysis = useMemo(
    () => (dataset ? analyzePayouts(dataset.rows) : null),
    [dataset],
  );

  function handleLoad(next: LoadedDataset, errors: string[]) {
    setDataset(next);
    setParseErrors(errors);
  }

  function handleExport() {
    if (!dataset || !analysis) return;
    const csv = buildReportCsv(analysis.rows, analysis.totals, dataset.platform);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `payout-lens-report-${dataset.platform.toLowerCase()}-${stamp}.csv`,
      csv,
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink text-paper">
      {/* One ambient glow — gold, soft, behind the hero. Nothing else decorates. */}
      <div
        aria-hidden
        className="glow-ambient pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{
          background:
            'radial-gradient(640px 320px at 50% -8%, rgba(201,168,76,0.16), transparent 70%), radial-gradient(480px 260px at 85% 0%, rgba(201,168,76,0.07), transparent 70%)',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Wordmark bar */}
        <header className="flex items-center justify-between gap-4 border-b border-line py-5">
          <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.28em] text-paper">
            Payout<span className="text-gold"> Lens</span>
          </p>
          <p className="hidden font-mono text-xs tracking-wide text-fog sm:block">
            Swiggy · Zomato · Private by design
          </p>
        </header>

        {/* Outcome-first hero — the live dashboard IS the hero */}
        <section className="reveal pt-12 pb-8 sm:pt-16">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            For restaurant owners on Swiggy &amp; Zomato
          </p>
          <h1 className="mt-4 max-w-4xl text-[48px] leading-[1.02] font-extrabold tracking-[-0.03em] text-cream sm:text-[64px]">
            {analysis ? (
              <>
                You keep{' '}
                <span className="text-gold">{formatPct(analysis.totals.keepRate)}</span>
                <br />
                of every ₹100.
              </>
            ) : (
              <>
                Every rupee,
                <br />
                accounted for.
              </>
            )}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
            Paste your payout CSV and see exactly where the money leaks — commission,
            GST, ad spend, discounts — order by order. Born from a real{' '}
            <strong className="font-semibold text-paper">₹16,582.51 Swiggy overcharge</strong>{' '}
            found at a small cafe in Salem: ads billed above 10% of GMV, plus CPC ads
            and ad offers the owner never agreed to.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {analysis && (
              <button
                type="button"
                onClick={handleExport}
                className="lux-hover lux-press rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink hover:bg-gold-soft"
              >
                ↓ Export reconciled report (CSV)
              </button>
            )}
            <a
              href="#import"
              className="lux-hover lux-press rounded-full border border-line-strong px-6 py-3 text-sm font-semibold text-paper hover:border-gold/50"
            >
              Check your own payout →
            </a>
            {dataset && (
              <span className="font-mono text-xs tracking-wide text-fog">
                Showing: {dataset.label}
                {dataset.source === 'sample' ? ' · SAMPLE' : ''}
              </span>
            )}
          </div>
        </section>
      </div>

      <main className="relative mx-auto max-w-7xl space-y-4 px-4 pb-10 sm:px-6">
        {parseErrors.length > 0 && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            <p className="font-semibold">Some rows were skipped:</p>
            <ul className="mt-1 list-disc pl-5">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {!analysis && (
          <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center">
            <p className="text-lg font-semibold text-paper">No data yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-mist">
              Upload a payout CSV, paste CSV text, or load one of the labelled samples
              below to see the fee breakdown, leak flags, weekly scorecard and charts.
            </p>
          </div>
        )}

        {analysis && (
          <>
            <div className="reveal" style={{ animationDelay: '80ms' }}>
              <Scorecard analysis={analysis} />
            </div>
            <div id="import" className="reveal scroll-mt-6" style={{ animationDelay: '140ms' }}>
              <ImportPanel
                onLoad={handleLoad}
                onClear={() => {
                  setDataset(null);
                  setParseErrors([]);
                }}
                hasData={dataset !== null}
                currentLabel={dataset?.label ?? null}
              />
            </div>
            <div className="reveal" style={{ animationDelay: '200ms' }}>
              <LeakPanel analysis={analysis} />
            </div>
            <Suspense
              fallback={
                <div className="lux-card p-5 text-sm text-mist">Loading charts…</div>
              }
            >
              <ChartsPanel analysis={analysis} />
            </Suspense>
            <OrderTable analysis={analysis} />
          </>
        )}

        {/* Warm off-white band — the rules, in the light, at the end */}
        <footer className="reveal rounded-3xl bg-cream p-6 text-[#17150f] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)] sm:p-8">
          <h2 className="text-xl font-extrabold tracking-[-0.02em]">How the leak rules work</h2>
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-[15px] leading-relaxed text-[#4a463d] sm:grid-cols-2">
            <li>
              <strong className="font-semibold text-[#17150f]">Ads over 10% of GMV</strong> — the
              cap restaurants are promised for Unlimited Ads. Anything above it is flagged, per
              order and per week.
            </li>
            <li>
              <strong className="font-semibold text-[#17150f]">Discount share over 20%</strong> — the
              restaurant funding more than a fifth of an order in discounts.
            </li>
            <li>
              <strong className="font-semibold text-[#17150f]">Fees eat over 35%</strong> — commission
              + GST + ads + discounts take more than 35% of the order value.
            </li>
            <li>
              <strong className="font-semibold text-[#17150f]">Payout does not reconcile</strong> — order
              value minus all fees differs from the reported payout by more than ₹0.50.
            </li>
          </ul>
          <p className="mt-5 border-t border-[#17150f]/10 pt-4 text-[13px] leading-relaxed text-[#6b675c]">
            Privacy: all parsing and math runs in your browser — your payout data is
            never uploaded. Sample datasets are fictional demo data, not real payouts;
            the ₹16,582.51 Swiggy overcharge in the story above is a real, verified
            claim from the cafe this tool was built for. Money is summed in integer
            paise, so totals are exact. Data shown:{' '}
            {analysis
              ? `${analysis.rows.length} orders, ${analysis.daily.length > 0 ? `${formatDate(analysis.daily[0].date)} – ${formatDate(analysis.daily[analysis.daily.length - 1].date)}` : ''}`
              : 'none'}
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
