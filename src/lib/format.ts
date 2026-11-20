/** Money formatting: integer paise -> "₹1,234.56", with IST-friendly grouping. */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inr0 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

export function formatINR0(paise: number): string {
  return inr0.format(paise / 100);
}

const pct = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPct(ratio: number): string {
  return pct.format(ratio);
}

/** "2026-11-09" -> "9 Nov 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
