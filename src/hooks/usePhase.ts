import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PHASE_TARGETS } from '../lib/config';
import { todayISO } from '../lib/dates';
import type { Phase, PhaseType } from '../lib/types';

export const phaseKeys = { all: ['phases'] as const, active: ['phases', 'active'] as const };

/** The open phase (end_date is null), or null before one has been started. */
export function useActivePhase() {
  return useQuery({
    queryKey: phaseKeys.active,
    queryFn: async (): Promise<Phase | null> => {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Phase | null) ?? null;
    },
    staleTime: 300_000,
  });
}

/**
 * Close the current phase and open a new one, defaulting targets from config.
 * A partial unique index enforces one open phase per user, so the close must
 * land before the insert.
 */
export function useStartPhase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (opts: {
      phase_type: PhaseType;
      target_kcal?: number;
      protein_g?: number;
      target_weekly_change_kg?: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const today = todayISO();
      const defaults = PHASE_TARGETS[opts.phase_type];
      const band = defaults.weekly_change_kg as unknown as [number, number];

      const { error: closeError } = await supabase
        .from('phases')
        .update({ end_date: today })
        .is('end_date', null);
      if (closeError) throw closeError;

      const { data, error } = await supabase
        .from('phases')
        .insert({
          user_id: userId,
          phase_type: opts.phase_type,
          start_date: today,
          target_kcal: opts.target_kcal ?? defaults.kcal,
          protein_g: opts.protein_g ?? defaults.protein_g,
          target_weekly_change_kg: opts.target_weekly_change_kg ?? (band[0] + band[1]) / 2,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Phase;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: phaseKeys.all });
    },
  });
}
