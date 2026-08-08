import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { shiftISO } from '../lib/analytics';
import { todayISO } from '../lib/dates';
import type { DailyLog, DailyLogInput, ISODate } from '../lib/types';

export const dailyLogKeys = {
  all: ['daily_logs'] as const,
  range: (from: ISODate) => ['daily_logs', from] as const,
};

/** Daily logs from `from` onward, oldest first. Defaults to a year of history. */
export function useDailyLogs(from: ISODate = shiftISO(todayISO(), -365)) {
  return useQuery({
    queryKey: dailyLogKeys.range(from),
    queryFn: async (): Promise<DailyLog[]> => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .gte('log_date', from)
        .order('log_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyLog[];
    },
    staleTime: 60_000,
  });
}

export function useLogForDate(date: ISODate = todayISO()) {
  const { data, ...rest } = useDailyLogs();
  return { ...rest, data: data?.find((l) => l.log_date === date) ?? null };
}

/**
 * Save a day.
 *
 * The cache is updated first and the row is queued for the server, so the entry
 * screen never blocks on the network. If the request fails — or we are offline —
 * the write waits in IndexedDB and goes out on reconnect.
 */
export function useSaveDailyLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DailyLogInput) => {
      await enqueue({
        table: 'daily_logs',
        onConflict: 'user_id,log_date',
        payload: input as Record<string, unknown>,
      });
      return flushQueue();
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: dailyLogKeys.all });

      const snapshots = qc.getQueriesData<DailyLog[]>({ queryKey: dailyLogKeys.all });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        const idx = prev.findIndex((l) => l.log_date === input.log_date);
        const next =
          idx >= 0
            ? prev.map((l, i) => (i === idx ? { ...l, ...input } : l))
            : [...prev, { ...blankLog(input.log_date), ...input }].sort((a, b) =>
                a.log_date < b.log_date ? -1 : 1,
              );
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (_err, _input, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) qc.setQueryData(key, prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dailyLogKeys.all });
    },
  });
}

function blankLog(date: ISODate): DailyLog {
  return {
    id: `pending-${date}`,
    user_id: 'pending',
    log_date: date,
    weight_kg: null,
    resting_hr: null,
    hrv_ms: null,
    sleep_hours: null,
    energy_1_10: null,
    mood_1_10: null,
    steps: null,
    kcal_intake: null,
    protein_g: null,
    calories_on_target: null,
    protein_hit: null,
    intrusive_food_thoughts: false,
    cold_hands_feet: false,
    meals: null,
    water_l: null,
    notes: null,
  };
}
