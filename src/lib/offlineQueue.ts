/**
 * Offline write queue.
 *
 * Logging happens at 6am in a bathroom with one bar of signal, so a write must
 * never be lost to a dropped request. Every mutation goes through here: it is
 * persisted to IndexedDB first, then flushed. Reads stay on React Query's cache
 * — this queue is writes only.
 */

import { del, get, set } from 'idb-keyval';
import { supabase } from './supabase';

const QUEUE_KEY = 'vector:write-queue';

export interface QueuedWrite {
  id: string;
  table: string;
  /** Columns that identify an existing row for upsert conflict resolution. */
  onConflict?: string;
  payload: Record<string, unknown>;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

const notify = async (): Promise<void> => {
  const q = await readQueue();
  for (const l of listeners) l(q.length);
};

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  void readQueue().then((q) => fn(q.length));
  return () => listeners.delete(fn);
}

export async function readQueue(): Promise<QueuedWrite[]> {
  return (await get<QueuedWrite[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(q: QueuedWrite[]): Promise<void> {
  if (q.length === 0) await del(QUEUE_KEY);
  else await set(QUEUE_KEY, q);
  await notify();
}

/**
 * Add a write to the queue. Writes for the same table+conflict key collapse, so
 * editing today's weight four times before regaining signal sends one row.
 */
export async function enqueue(
  item: Omit<QueuedWrite, 'id' | 'queuedAt' | 'attempts'>,
): Promise<void> {
  const q = await readQueue();
  const keyOf = (w: Pick<QueuedWrite, 'table' | 'onConflict' | 'payload'>): string => {
    const cols = (w.onConflict ?? '').split(',').filter(Boolean);
    return [w.table, ...cols.map((c) => String(w.payload[c.trim()]))].join('|');
  };
  const key = keyOf(item);
  const existing = q.findIndex((w) => keyOf(w) === key);

  const next: QueuedWrite = {
    id:
      existing >= 0
        ? q[existing]!.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
    ...item,
    payload:
      existing >= 0 ? { ...q[existing]!.payload, ...item.payload } : item.payload,
  };

  if (existing >= 0) q[existing] = next;
  else q.push(next);

  await writeQueue(q);
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

let flushing = false;

/** Send everything queued. Safe to call concurrently — extra calls no-op. */
export async function flushQueue(): Promise<FlushResult> {
  if (flushing) {
    const q = await readQueue();
    return { sent: 0, failed: 0, remaining: q.length };
  }
  flushing = true;

  try {
    let q = await readQueue();
    if (q.length === 0) return { sent: 0, failed: 0, remaining: 0 };

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { sent: 0, failed: 0, remaining: q.length };

    let sent = 0;
    let failed = 0;
    const kept: QueuedWrite[] = [];

    for (const item of q) {
      const { error } = await supabase
        .from(item.table)
        .upsert({ ...item.payload, user_id: session.user.id }, { onConflict: item.onConflict });

      if (error) {
        failed++;
        kept.push({ ...item, attempts: item.attempts + 1, lastError: error.message });
      } else {
        sent++;
      }
    }

    q = kept;
    await writeQueue(q);
    return { sent, failed, remaining: q.length };
  } finally {
    flushing = false;
  }
}

/** Flush now, and again whenever the browser regains connectivity. */
export function startQueueSync(): () => void {
  const onOnline = (): void => {
    void flushQueue();
  };
  const onVisible = (): void => {
    if (document.visibilityState === 'visible' && navigator.onLine) void flushQueue();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  if (navigator.onLine) void flushQueue();

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
