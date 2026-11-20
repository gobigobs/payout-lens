import type { PayoutRow } from './types';

/**
 * Minimal, dependency-free CSV parser.
 *
 * Handles the real-world mess in platform payout exports: quoted fields
 * containing commas, doubled quotes (""), CRLF line endings, stray blank
 * lines, and a UTF-8 BOM. It does NOT try to be a spreadsheet — one
 * header row, then data rows.
 */

export interface ParseResult {
  rows: PayoutRow[];
  /** Non-fatal problems, one per rejected row. Empty when everything parsed. */
  errors: string[];
}

const REQUIRED = [
  'order_id',
  'date',
  'order_value',
  'commission',
  'gst',
  'ad_spend',
  'discount_share',
  'payout',
] as const;

/** Header aliases seen in real Swiggy/Zomato exports. */
const ALIASES: Record<string, string> = {
  orderid: 'order_id',
  order: 'order_id',
  orderno: 'order_id',
  order_number: 'order_id',
  orderdate: 'date',
  order_date: 'date',
  ordervalue: 'order_value',
  billvalue: 'order_value',
  gmv: 'order_value',
  order_amount: 'order_value',
  commissionamount: 'commission',
  gstamount: 'gst',
  gst_on_commission: 'gst',
  adspend: 'ad_spend',
  ads: 'ad_spend',
  ad_spend_amount: 'ad_spend',
  discountshare: 'discount_share',
  discount: 'discount_share',
  restaurant_discount_share: 'discount_share',
  payoutamount: 'payout',
  netpayout: 'payout',
  settlement: 'payout',
};

function normalizeHeader(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ALIASES[key] ?? key;
}

/** Split CSV text into rows of fields, honouring quotes. */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0].trim() !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0].trim() !== '') rows.push(row);
  }
  return rows;
}

/** "1,234.56" / "₹450" / "450.00" -> paise (integer). NaN when unparseable. */
export function parseMoneyToPaise(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/[₹$,\s]/g, '')
    .replace(/^\((.*)\)$/, '-$1'); // (123.45) accounting negatives
  if (cleaned === '') return Number.NaN;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parsePayoutCsv(text: string): ParseResult {
  const errors: string[] = [];
  const rows: PayoutRow[] = [];

  if (!text.trim()) return { rows, errors: ['The CSV is empty.'] };

  const grid = splitCsv(text);
  if (grid.length < 2) {
    return {
      rows,
      errors: ['Need a header row plus at least one data row.'],
    };
  }

  const header = grid[0].map(normalizeHeader);
  const missing = REQUIRED.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return {
      rows,
      errors: [
        `Missing required column(s): ${missing.join(', ')}. Expected: ${REQUIRED.join(', ')}.`,
      ],
    };
  }

  const idx = (col: string): number => header.indexOf(col);

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const lineNo = r + 1;
    const get = (col: string): string => (line[idx(col)] ?? '').trim();

    const orderId = get('order_id');
    const date = get('date');
    if (!orderId) {
      errors.push(`Row ${lineNo}: missing order_id — row skipped.`);
      continue;
    }
    if (!isValidDate(date)) {
      errors.push(
        `Row ${lineNo} (${orderId}): date "${date}" is not a valid YYYY-MM-DD date — row skipped.`,
      );
      continue;
    }

    const money: Record<string, number> = {};
    let bad: string | null = null;
    for (const col of [
      'order_value',
      'commission',
      'gst',
      'ad_spend',
      'discount_share',
      'payout',
    ] as const) {
      const value = parseMoneyToPaise(get(col));
      if (Number.isNaN(value)) {
        bad = `${col} ("${get(col)}")`;
        break;
      }
      money[col] = value;
    }
    if (bad) {
      errors.push(`Row ${lineNo} (${orderId}): ${bad} is not a number — row skipped.`);
      continue;
    }

    rows.push({
      orderId,
      date,
      orderValuePaise: money.order_value,
      commissionPaise: money.commission,
      gstPaise: money.gst,
      adSpendPaise: money.ad_spend,
      discountSharePaise: money.discount_share,
      payoutPaise: money.payout,
    });
  }

  return { rows, errors };
}
