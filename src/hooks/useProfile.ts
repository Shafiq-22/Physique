import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PROFILE } from '../lib/config';
import type { Profile } from '../lib/types';

export const profileKeys = { all: ['profile'] as const };

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
    staleTime: 300_000,
  });
}

/** Height from the profile, falling back to the config default for a fresh account. */
export function useHeightCm(): number {
  const { data } = useProfile();
  return data?.height_cm ?? PROFILE.HEIGHT_CM;
}

export function useSaveProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      // The signup trigger creates the row, but upsert keeps this safe if an
      // account predates that trigger.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...patch }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
