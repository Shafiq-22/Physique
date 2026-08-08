import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Photo, Pose } from '../lib/types';

export const photoKeys = { all: ['photos'] as const, signed: ['photo-url'] as const };

const BUCKET = 'progress-photos';

export function usePhotos() {
  return useQuery({
    queryKey: photoKeys.all,
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('taken_on', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
    staleTime: 300_000,
  });
}

/**
 * Progress photos live in a private bucket and are only ever read through a
 * short-lived signed URL. The path is `{user_id}/{date}-{pose}.jpg`, which the
 * storage policy checks against auth.uid().
 */
export function useSignedPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: [...photoKeys.signed, path],
    enabled: Boolean(path),
    // Re-sign comfortably before the one-hour URL expires.
    staleTime: 45 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { file: File; taken_on: string; pose: Pose }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${input.taken_on}-${input.pose}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: true, contentType: input.file.type });
      if (upErr) throw upErr;

      // Re-shooting the same day and pose replaces rather than accumulates.
      const existing = await supabase
        .from('photos')
        .select('id')
        .eq('taken_on', input.taken_on)
        .eq('pose', input.pose)
        .maybeSingle();

      const row = { user_id: userId, taken_on: input.taken_on, pose: input.pose, storage_path: path };
      const { error } = existing.data?.id
        ? await supabase.from('photos').update(row).eq('id', existing.data.id)
        : await supabase.from('photos').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: photoKeys.all });
    },
  });
}
