# Payout Lens — every rupee, accounted for

> **Paste a Zomato or Swiggy payout CSV. In seconds, see exactly where the money leaks — commission, GST, ad spend, discounts — order by order, week by week. Free, private, runs entirely in your browser.**

![Payout Lens — dark dashboard, live Swiggy sample: you keep 61.6% of every ₹100](docs/screenshot-top.png)
![Payout Lens — leak detector, charts and per-order breakdown](docs/screenshot-full.png)

[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![Vite 8](https://img.shields.io/badge/Vite-8-a855f7?logo=vite)](https://vite.dev)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Vitest 22/22](https://img.shields.io/badge/tests-22%2F22_passing-16a34a)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-c9a84c)](LICENSE)

## The story

A small cafe in Salem reconciled one week of Swiggy payouts by hand and found a **verified ₹16,582.51 overcharge**: ad spend billed above 10% of GMV, plus CPC ads and ad offers the restaurant had never agreed to. The claim was raised with Swiggy and is documented in the reconciliation work behind this app.

No restaurant owner should need a spreadsheet and a free evening to catch that. Payout Lens does the reconciliation in seconds — and flags every order where ads cross 10% of GMV, discounts eat too much, fees take an outsized share, or the platform's own numbers don't add up.

## Quick start — 30 seconds

```bash
npm install
npm run dev        # http://localhost:5173
```

That's it. The app opens with the **Swiggy sample already loaded**, so the full dashboard — scorecard, leak flags, charts, per-order table — works with zero setup. To check your own payouts, upload your CSV or paste it in the import panel. Production build: `npm run build && npm run preview` (http://localhost:4173).

## What you get

| Feature | What it shows |
| --- | --- |
| **Outcome headline** | Your keep rate up front — "You keep 61.6% of every ₹100" on the Swiggy sample |
| **Per-order breakdown** | Order value → commission → GST → ads → discount share → net payout, with running total and flag chips (hover a chip for the exact numbers) |
| **Leak detector** | Every flag with its numbers, most severe first, plus a live hit count per rule |
| **Weekly scorecard** | Totals, averages and leak summary per ISO week (Monday–Sunday), including keep rate and ads as % of GMV |
| **Charts** | Stacked fee bar per order, daily payout trend vs GMV, and a "where each ₹100 of GMV went" donut |
| **Export** | Download the reconciled report as CSV: every order with its full breakdown, running total and flags, plus a totals row |
| **Privacy** | All parsing and math runs in your browser. No account, no server, no upload — your payout data never leaves your machine |

## Leak rules

Every flag shows the exact numbers behind it — never just a red badge.

| Flag | Rule | Why |
| ---- | ---- | --- |
| `ADS_OVER_10` | Ad spend > **10%** of the order's value (or the week's GMV) | The cap restaurants are promised for Unlimited Ads. Above it, ads eat the margin they were meant to grow. |
| `HIGH_DISCOUNT` | Discount share > **20%** of the order's value | The restaurant is funding more than a fifth of the order in discounts. |
| `FEE_HEAVY` | All fees > **35%** of the order's value | The restaurant keeps under 65% before food and labour costs. |
| `PAYOUT_MISMATCH` | `order value − fees ≠ payout` by more than **₹0.50** | The platform's own numbers don't reconcile — money to chase. |

Rules are evaluated per order and (for the first three) per ISO week, in `src/lib/analyze.ts` — `LEAK_RULES` holds the thresholds in one place.

## Import format

One header row, then one row per order. Columns (exact names, order doesn't matter):

| Column | Meaning |
| ------ | ------- |
| `order_id` | Order number from the platform |
| `date` | `YYYY-MM-DD` |
| `order_value` | GMV of the order (₹) |
| `commission` | Platform commission (₹) |
| `gst` | GST on commission (₹) |
| `ad_spend` | Ad spend charged on the order (₹) |
| `discount_share` | Restaurant's share of discounts (₹) |
| `payout` | Amount the platform says it paid you (₹) |

Upload a `.csv` file, paste CSV text, or load a bundled sample. The parser tolerates quoted fields, commas inside values, `₹` symbols, CRLF endings and a UTF-8 BOM, and accepts common header aliases (`gmv` for `order_value`, `net_payout` for `payout`, …). Bad rows are skipped individually and reported — one bad row never kills the whole import.

### Sample data

Two realistic samples ship in `src/data/` (also loadable in one click):

- `sample-swiggy-payouts.csv` — 10 orders, 9–13 Nov 2026
- `sample-zomato-payouts.csv` — 8 orders, 9–13 Nov 2026

**The sample data is fictional demo data** — invented order IDs and amounts in the shape of real exports, so the app can be tried without real payouts. Only the ₹16,582.51 overcharge story above is real.

## How the math works

Money is converted once at the parse boundary into **integer paise** and summed as integers, so totals are exact — no floating-point drift (`0.1 + 0.2` can never corrupt a payout total). The one identity the app checks on every row:

```
payout = order_value − commission − GST − ad_spend − discount_share
```

If that doesn't hold within ₹0.50, the row gets a `PAYOUT_MISMATCH` flag.

## Verifying the math

Expected values were computed independently in Python (`Decimal` arithmetic) from the two sample CSVs and pasted as constants into the tests — if the analysis code drifts, the tests fail.

```bash
npm test      # 22 vitest tests: sample totals, leak flags, parser, ISO weeks, export
npm run build # tsc (strict) + vite production build
npm run verify # serves the production build and checks HTTP 200 + key content
```

Hand-checked sample totals:

| | Swiggy sample | Zomato sample |
| --- | --- | --- |
| Orders | 10 | 8 |
| GMV | ₹5,548.00 | ₹4,980.00 |
| Commission | ₹1,109.60 | ₹1,095.60 |
| GST | ₹199.72 | ₹197.21 |
| Ads | ₹200.00 (3.6% of GMV) | ₹215.00 (4.3% of GMV) |
| Discount share | ₹619.00 | ₹495.00 |
| Payout | ₹3,419.68 | ₹2,977.19 |
| You keep | 61.6% | 59.8% |
| Flagged orders | 6 of 10 (9 flags) | 6 of 8 (9 flags) |

## Tech

React 19 + Vite 8 + TypeScript (strict) + Tailwind CSS v4 + Recharts 3. Vitest for tests. No backend, no database, no tracking. Dark-first design: near-black canvas, one muted-gold accent, Inter at three weights with a mono face for numbers, glass import panel, CSS-only motion (200 ms hover, staggered rise-in, `prefers-reduced-motion` respected).

- `src/lib/parse.ts` — dependency-free CSV parser (quoted fields, BOM, CRLF, header aliases)
- `src/lib/analyze.ts` — leak rules, per-order derivation, ISO-week buckets, daily series
- `src/lib/exportCsv.ts` — reconciled report CSV builder
- `src/lib/format.ts` — INR formatting (`en-IN` locale)
- `src/components/` — ImportPanel, Scorecard, LeakPanel, ChartsPanel, OrderTable
- `src/data/` — the two labelled sample CSVs
- `scripts/verify.mjs` — production smoke test (serves `dist/`, checks HTTP 200 + content)

Charts are code-split with `React.lazy`, so the first paint loads only the table/scorecard code (~250 KB JS) and Recharts loads on demand.

## Profit path

Honest answer: this is a free tool, not a money promise. The realistic paths, in order of likelihood:

1. **Freelance / client work** — a working, deployed reconciliation tool is a portfolio piece that proves real product sense to restaurant-tech and fintech clients: it solves a painful, specific problem (payout leakage) with real domain numbers, not a tutorial clone.
2. **Paid product for restaurants** — the free single-file version earns trust; a paid tier could add saved multi-outlet history, weekly email scorecards, and one-click dispute letters generated from the flagged orders. Restaurants that find even one ₹5,000 overcharge would pay for that. Nothing here is built or priced yet — this section names the path, not a revenue forecast.
3. **Jobs** — the same story (found a real overcharge, built the tool that catches it) is a strong interview narrative for product-engineer roles in food-tech / fintech.

No income is promised or implied. The tool is free and local-first by design.

## License

MIT — use it, fork it, point it at your own payouts.
