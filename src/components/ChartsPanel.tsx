import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate, formatINR, formatPct } from '../lib/format';
import type { Analysis } from '../lib/types';

const rs = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/* Dark glass tooltip — gold border, cream text, contrast ≥ 4.5:1 */
const tooltipStyle = {
  backgroundColor: 'rgba(18,19,23,0.96)',
  border: '1px solid rgba(201,168,76,0.4)',
  borderRadius: '0.75rem',
  fontSize: '0.8rem',
  color: '#f5f2eb',
  boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
} as const;

const axisTick = { fontSize: 11, fill: '#8a857c' } as const;

function ChartCard({
  title,
  sub,
  children,
  wide,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`lux-card lux-hover p-5 sm:p-6 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="text-lg font-bold tracking-[-0.01em] text-cream">{title}</h2>
      <p className="mt-0.5 text-sm text-mist">{sub}</p>
      {children}
    </div>
  );
}

export default function ChartsPanel({ analysis }: { analysis: Analysis }) {
  const { rows, totals, daily } = analysis;

  const feeStack = rows.map((r) => ({
    order: r.orderId.replace(/^(SWG|ZMT)-/, ''),
    Commission: r.commissionPaise / 100,
    GST: r.gstPaise / 100,
    Ads: r.adSpendPaise / 100,
    Discount: r.discountSharePaise / 100,
    payout: r.payoutPaise / 100,
  }));

  const trend = daily.map((d) => ({
    date: formatDate(d.date).replace(' 2026', ''),
    Payout: d.payoutPaise / 100,
    GMV: d.orderValuePaise / 100,
    orders: d.orders,
  }));

  /* Gold + neutrals only — no rainbow. Keep = gold, the rest shade down. */
  const whereGmvGoes = [
    { name: 'You keep (payout)', value: totals.payoutPaise / 100, fill: '#c9a84c' },
    { name: 'Commission', value: totals.commissionPaise / 100, fill: '#4a4b50' },
    { name: 'GST', value: totals.gstPaise / 100, fill: '#76736c' },
    { name: 'Ads', value: totals.adSpendPaise / 100, fill: '#a8893a' },
    { name: 'Discount share', value: totals.discountSharePaise / 100, fill: '#b9b2a6' },
  ].filter((s) => s.value > 0);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Fee stack — per order"
        sub="Every rupee of fees on every order, stacked. Taller bar = more leakage."
      >
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feeStack} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232428" vertical={false} />
              <XAxis dataKey="order" tick={axisTick} axisLine={{ stroke: '#2a2b30' }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => rs(v * 100)} tick={axisTick} width={64} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`₹${Number(v).toFixed(2)}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <Bar dataKey="Commission" stackId="fees" fill="#4a4b50" />
              <Bar dataKey="GST" stackId="fees" fill="#76736c" />
              <Bar dataKey="Ads" stackId="fees" fill="#c9a84c" />
              <Bar dataKey="Discount" stackId="fees" fill="#b9b2a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Payout trend — daily"
        sub="What actually landed in your account each day, against GMV."
      >
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232428" vertical={false} />
              <XAxis dataKey="date" tick={axisTick} axisLine={{ stroke: '#2a2b30' }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => rs(v * 100)} tick={axisTick} width={64} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [`₹${Number(v).toFixed(2)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <Area type="monotone" dataKey="GMV" stroke="#76736c" fill="#76736c" fillOpacity={0.14} strokeWidth={2} />
              <Area type="monotone" dataKey="Payout" stroke="#c9a84c" fill="#c9a84c" fillOpacity={0.22} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Where each ₹100 of GMV went"
        sub={`Total GMV ${formatINR(totals.orderValuePaise)} split across payout, commission, GST, ads and discount share.`}
        wide
      >
        <div className="relative mx-auto mt-2 h-80 max-w-xl">
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
            <span className="tabular font-mono text-3xl font-semibold text-gold">
              {formatPct(totals.keepRate)}
            </span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-fog">
              kept
            </span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={whereGmvGoes}
                dataKey="value"
                nameKey="name"
                innerRadius="50%"
                outerRadius="70%"
                paddingAngle={2}
                stroke="#0a0b0c"
                strokeWidth={2}
                label={false}
              >
                {whereGmvGoes.map((s) => (
                  <Cell key={s.name} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [`₹${Number(v).toFixed(2)}`, name]}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.85rem' }}
                formatter={(value: string) => {
                  const slice = whereGmvGoes.find((s) => s.name === value);
                  const pct = slice ? (slice.value / (totals.orderValuePaise / 100)) * 100 : 0;
                  return `${value} · ${pct.toFixed(1)}%`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </section>
  );
}
