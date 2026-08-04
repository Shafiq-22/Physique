import { useEffect, useState } from 'react';
import { flushQueue, onQueueChange } from '../lib/offlineQueue';

/**
 * Shows only when writes are waiting. Silence is the normal state — this is a
 * status indicator, not a nag.
 */
export function SyncBadge() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => onQueueChange(setPending), []);

  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flushQueue()}
      className="chip bg-amber-500/15 text-amber-300"
      title={online ? 'Tap to retry now' : 'Will sync when you are back online'}
    >
      {pending} to sync{online ? '' : ' · offline'}
    </button>
  );
}
