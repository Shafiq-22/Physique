interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
}

/**
 * 1–10 in a single tap.
 *
 * A stepper would need up to ten presses for a number the user already knows,
 * so the whole range is on screen. Tapping the active value clears it, keeping
 * "didn't answer" reachable and distinct from a low score.
 */
export function ScalePicker({ label, value, onChange, hint }: Props) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {hint ? <span className="text-xs muted">{hint}</span> : null}
      </div>
      <div className="mt-2 flex gap-1" role="group" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              aria-label={`${label} ${n} of 10`}
              onClick={() => onChange(active ? null : n)}
              className={`h-11 min-w-0 flex-1 rounded-lg text-sm font-semibold tabular-nums transition active:scale-95 ${
                active ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-400'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
