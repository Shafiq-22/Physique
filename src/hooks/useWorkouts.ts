import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { flagSessionPRs } from '../lib/workouts';
import type { ISODate, Workout, WorkoutSet } from '../lib/types';

export const workoutKeys = {
  all: ['workouts'] as const,
  sets: ['workout_sets'] as const,
};

export function useWorkouts() {
  return useQuery({
    queryKey: workoutKeys.all,
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Workout[];
    },
    staleTime: 60_000,
  });
}

export function useWorkoutSets() {
  return useQuery({
    queryKey: workoutKeys.sets,
    queryFn: async (): Promise<WorkoutSet[]> => {
      const { data, error } = await supabase.from('workout_sets').select('*').limit(3000);
      if (error) throw error;
      return (data ?? []) as WorkoutSet[];
    },
    staleTime: 60_000,
  });
}

/** workout_id → the calendar date it was performed, for the date-based rules. */
export function useSetDates(workouts: Workout[] | undefined): Map<string, ISODate> {
  const map = new Map<string, ISODate>();
  for (const w of workouts ?? []) map.set(w.id, w.performed_at.slice(0, 10));
  return map;
}

export interface DraftSet {
  exercise_name: string;
  load_kg: number | null;
  leverage: string | null;
  reps: number | null;
  rpe: number | null;
}

/**
 * Save a session and its sets.
 *
 * Unlike the daily log this is not queued offline: a workout is many rows across
 * two tables with a foreign key between them, and replaying that safely needs
 * more than the single-row upsert queue provides. Sets are PR-flagged against
 * full history at write time so the badge is stored, not recomputed on every render.
 */
export function useSaveWorkout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      session_type: string | null;
      session_rpe: number | null;
      notes: string | null;
      sets: DraftSet[];
      priorSets: WorkoutSet[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          session_type: input.session_type,
          session_rpe: input.session_rpe,
          notes: input.notes,
        })
        .select()
        .single();
      if (wErr) throw wErr;

      const usable = input.sets.filter((s) => s.exercise_name.trim() !== '' && s.reps !== null);
      const flags = flagSessionPRs(usable, input.priorSets);

      if (usable.length > 0) {
        const { error: sErr } = await supabase.from('workout_sets').insert(
          usable.map((s, i) => ({
            user_id: userId,
            workout_id: (workout as Workout).id,
            exercise_name: s.exercise_name.trim(),
            set_index: i + 1,
            load_kg: s.load_kg,
            leverage: s.leverage,
            reps: s.reps,
            rpe: s.rpe,
            is_pr: flags[i]?.isPr ?? false,
          })),
        );
        if (sErr) throw sErr;
      }

      return { workout: workout as Workout, prCount: flags.filter((f) => f.isPr).length };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workoutKeys.all });
      void qc.invalidateQueries({ queryKey: workoutKeys.sets });
    },
  });
}
