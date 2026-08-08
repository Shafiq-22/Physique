import { useEffect, useRef, useState } from 'react';

/**
 * Prescribed rest, counted down.
 *
 * Rest is part of the prescription — two minutes on a primary lift is what makes
 * the next set a working set rather than a conditioning set — but it is the
 * easiest thing to eyeball wrong. Pinned above the tab bar so it stays visible
 * while scrolling the sheet.
 */
export function RestTimer({ seconds, onDismiss }: { seconds: number; onDismiss: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = left <= 0;
  const buzzed = useRef(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (!done || buzzed.current) return;
    buzzed.current = true;
    // Not supported on iOS Safari; harmless where it is missing.
    navigator.vibrate?.(200);
  }, [done]);

  const mins = Math.floor(Math.max(0, left) / 60);
  const secs = Math.max(0, left) % 60;
  const pct = Math.max(0, Math.min(100, (left / seconds) * 100));

  return (
    <div
      className="fixed inset-x-0 bottom-14 z-20 mx-auto max-w-md px-4 pb-2"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`overflow-hidden rounded-xl border shadow-lg ${
          done ? 'border-accent/60 bg-ink-800' : 'border-ink-600 bg-ink-800'
        }`}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className={`text-xl font-semibold tabular-nums ${done ? 'text-accent' : ''}`}>
            {done ? 'Go' : `${mins}:${String(secs).padStart(2, '0')}`}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs muted">
            {done ? 'Rest complete' : `Resting · ${seconds}s prescribed`}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg bg-ink-700 px-3 py-1.5 text-sm font-medium text-slate-200"
          >
            {done ? 'Done' : 'Skip'}
          </button>
        </div>
        <div className="h-1 w-full bg-ink-900">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${
              done ? 'bg-accent' : 'bg-sky-500'
            }`}
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
