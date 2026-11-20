import { useRef, useState } from 'react';
import { parsePayoutCsv } from '../lib/parse';
import { SAMPLE_DATASETS } from '../lib/samples';
import type { PayoutRow, Platform } from '../lib/types';

export interface LoadedDataset {
  platform: Platform;
  label: string;
  source: 'sample' | 'upload' | 'paste';
  rows: PayoutRow[];
}

interface Props {
  onLoad: (dataset: LoadedDataset, errors: string[]) => void;
  onClear: () => void;
  hasData: boolean;
  currentLabel: string | null;
}

const PLATFORMS: Platform[] = ['Swiggy', 'Zomato', 'Other'];

const darkInput =
  'mt-1.5 block w-full rounded-lg border border-line-strong bg-white/[0.04] px-3 py-2 text-sm text-paper placeholder:text-fog transition-colors duration-200 focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/40';

export default function ImportPanel({ onLoad, onClear, hasData, currentLabel }: Props) {
  const [paste, setPaste] = useState('');
  const [platform, setPlatform] = useState<Platform>('Swiggy');
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleText(text: string, source: 'upload' | 'paste', label: string) {
    const { rows, errors } = parsePayoutCsv(text);
    if (rows.length === 0) {
      setNotice(
        errors.length > 0
          ? `Could not import: ${errors[0]}`
          : 'Could not import: no valid rows found.',
      );
      return;
    }
    setNotice(
      errors.length > 0
        ? `Imported ${rows.length} order(s). ${errors.length} row(s) skipped — see details below the table.`
        : `Imported ${rows.length} order(s).`,
    );
    onLoad({ platform, label, source, rows }, errors);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result ?? ''), 'upload', file.name);
    reader.onerror = () => setNotice('Could not read that file.');
    reader.readAsText(file);
  }

  function loadSample(id: string) {
    const sample = SAMPLE_DATASETS.find((s) => s.id === id)!;
    const { rows, errors } = parsePayoutCsv(sample.csv);
    if (rows.length === 0) {
      setNotice(`Sample failed to load: ${errors[0] ?? 'unknown error'}`);
      return;
    }
    setNotice(`Loaded ${sample.label}. Sample data — fictional, for demo only.`);
    onLoad(
      {
        platform: sample.platform,
        label: sample.label,
        source: 'sample',
        rows,
      },
      errors,
    );
  }

  return (
    <section className="lux-glass lux-card rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.01em] text-cream">Import payout data</h2>
          <p className="mt-0.5 text-sm text-mist">
            Upload a CSV from Swiggy / Zomato, or paste it. Columns needed:{' '}
            <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-gold-soft">
              order_id, date, order_value, commission, gst, ad_spend, discount_share, payout
            </code>
          </p>
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setPaste('');
              onClear();
            }}
            className="lux-hover lux-press rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-paper hover:border-gold/50"
          >
            Clear data
          </button>
        )}
      </div>

      {currentLabel && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold-soft ring-1 ring-gold/25">
          <span className="h-2 w-2 rounded-full bg-gold" />
          Showing: {currentLabel}
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-line-strong bg-white/[0.02] p-4">
          <label className="text-sm font-medium text-paper" htmlFor="platform">
            Platform
          </label>
          <select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={darkInput}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p} className="bg-coal text-paper">
                {p}
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="lux-hover lux-press rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
            >
              Upload CSV file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            {SAMPLE_DATASETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id)}
                className="lux-hover lux-press rounded-full border border-line-strong px-3 py-2 text-sm font-medium text-paper hover:border-gold/50"
              >
                Load {s.platform} sample
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fog">
            Your file never leaves this browser — parsing happens locally, nothing is
            uploaded anywhere.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <label className="text-sm font-medium text-paper" htmlFor="paste">
            Or paste CSV text
          </label>
          <textarea
            id="paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder={'order_id,date,order_value,commission,gst,ad_spend,discount_share,payout\nORD-1,2026-11-09,450.00,90.00,16.20,20.00,45.00,278.80'}
            className={`${darkInput} font-mono text-xs`}
          />
          <button
            type="button"
            disabled={!paste.trim()}
            onClick={() => handleText(paste, 'paste', 'Pasted CSV')}
            className="lux-hover lux-press mt-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze pasted CSV
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold-soft ring-1 ring-gold/20">
          {notice}
        </p>
      )}
    </section>
  );
}
