import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Benchmark, Measurement } from '../lib/types';

export const measurementKeys = { all: ['measurements'] as const };
export const benchmarkKeys = { all: ['benchmarks'] as const };

export function useMeasurements() {
  return useQuery({
    queryKey: measurementKeys.all,
    queryFn: async (): Promise<Measurement[]> => {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .order('measured_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
    staleTime: 300_000,
  });
}

/** Upsert by date, so re-measuring the same day corrects rather than duplicates. */
export function useSaveMeasurement() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Measurement> & { measured_on: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const existing = await supabase
        .from('measurements')
        .select('id')
        .eq('measured_on', input.measured_on)
        .maybeSingle();

      const row = { ...input, user_id: userId };
      const { error } = existing.data?.id
        ? await supabase.from('measurements').update(row).eq('id', existing.data.id)
        : await supabase.from('measurements').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: measurementKeys.all });
    },
  });
}

export function useBenchmarks() {
  return useQuery({
    queryKey: benchmarkKeys.all,
    queryFn: async (): Promise<Benchmark[]> => {
      const { data, error } = await supabase
        .from('benchmarks')
        .select('*')
        .order('measured_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Benchmark[];
    },
    staleTime: 300_000,
  });
}

export function useSaveBenchmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { measured_on: string; metric: string; value: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');
      const { error } = await supabase.from('benchmarks').insert({ ...input, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: benchmarkKeys.all });
    },
  });
}
