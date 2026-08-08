import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { todayISO } from '../lib/dates';
import type { Recommendation, RecommendationScope, Verdict } from '../lib/types';

export const recommendationKeys = { all: ['recommendations'] as const };

export function useRecommendations() {
  return useQuery({
    queryKey: recommendationKeys.all,
    queryFn: async (): Promise<Recommendation[]> => {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .order('generated_on', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Recommendation[];
    },
    staleTime: 60_000,
  });
}

/**
 * File a verdict, acknowledged.
 *
 * Recommendations are only written when the user actually accepts one, so the
 * table is a record of decisions taken rather than a log of everything the
 * engine ever computed. `rationale` and `data_snapshot` are stored alongside so
 * a past instruction can still be audited months later.
 */
export function useAcknowledge() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { verdict: Verdict; scope: RecommendationScope }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase.from('recommendations').insert({
        user_id: userId,
        generated_on: todayISO(),
        scope: input.scope,
        verdict: input.verdict.verdict,
        rationale: input.verdict.rationale,
        data_snapshot: { ...input.verdict.snapshot, code: input.verdict.code },
        acknowledged: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recommendationKeys.all });
    },
  });
}

/**
 * Days since the last deload was filed, or null if there has never been one.
 * This is what feeds the 42/56-day windows in `evaluateDeload`.
 */
export function daysSinceLastDeload(recs: Recommendation[] | undefined): number | null {
  const deloads = (recs ?? [])
    .filter((r) => r.scope === 'deload')
    .sort((a, b) => (a.generated_on < b.generated_on ? 1 : -1));
  const last = deloads[0];
  if (!last) return null;

  const ms = Date.parse(`${todayISO()}T00:00:00Z`) - Date.parse(`${last.generated_on}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
