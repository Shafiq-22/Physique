import { useMemo } from 'react';
import { computeEMA, computeTrendDelta, weightSeries } from '../lib/analytics';
import type { DailyLog } from '../lib/types';

/** Trend weight series plus the 7-day delta, memoised over the logs. */
export function useTrend(logs: DailyLog[] | undefined, days = 7) {
  return useMemo(() => {
    const series = computeEMA(weightSeries(logs ?? []));
    return { series, delta: computeTrendDelta(series, days), latest: series[series.length - 1] ?? null };
  }, [logs, days]);
}
