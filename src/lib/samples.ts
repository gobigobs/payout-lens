import swiggyCsv from '../data/sample-swiggy-payouts.csv?raw';
import zomatoCsv from '../data/sample-zomato-payouts.csv?raw';
import type { Platform } from './types';

/**
 * Bundled demo datasets. Fictional numbers in the shape of real
 * Swiggy/Zomato payout exports — labelled SAMPLE everywhere they appear.
 * The app loads the Swiggy sample on first open so the demo works with
 * zero setup; "Clear" removes it and the user imports their own CSV.
 */
export interface SampleDataset {
  id: 'swiggy-sample' | 'zomato-sample';
  label: string;
  platform: Platform;
  csv: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'swiggy-sample',
    label: 'Sample — Swiggy (10 orders, 9–13 Nov 2026)',
    platform: 'Swiggy',
    csv: swiggyCsv,
  },
  {
    id: 'zomato-sample',
    label: 'Sample — Zomato (8 orders, 9–13 Nov 2026)',
    platform: 'Zomato',
    csv: zomatoCsv,
  },
];
