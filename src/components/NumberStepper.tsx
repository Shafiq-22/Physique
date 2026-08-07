import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  /** Long-press / secondary buttons move by this much. */
  coarseStep?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  /** Shown faintly in the field when empty — usually yesterday's value. */
  placeholder?: number | null;
  autoFocus?: boolean;
}

/**
 * Big-target +/- input for one-handed phone use. The text field stays editable
 * for the rare case where typing is faster, but the steppers are the point:
 * weight moves in 0.1 kg, and the thumb never has to find a tiny caret.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 0.1,
  coarseStep,
  min,
  max,
  unit,
  decimals = 1,
  placeholder,
  autoFocus,
}: Props) {
  const [text, setText] = useState(value === null ? '' : value.toFixed(decimals));

  useEffect(() => {
    setText(value === null ? '' : value.toFixed(decimals));
  }, [value, decimals]);

  const clamp = (n: number): number => {
    let out = n;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return Number(out.toFixed(decimals));
  };

  const bump = (by: number): void => {
    const base = value ?? placeholder ?? 0;
    onChange(clamp(base + by));
  };

  const commit = (raw: string): void => {
    setText(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n));
  };

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {unit ? <span className="text-xs muted">{unit}</span> : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <StepButton onClick={() => bump(-(coarseStep ?? step))} label={`Decrease ${label}`}>
          −
        </StepButton>

        <input
          inputMode="decimal"
          enterKeyHint="next"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => commit(e.target.value)}
          placeholder={placeholder !== null && placeholder !== undefined ? placeholder.toFixed(decimals) : '—'}
          aria-label={label}
          className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-3 text-center text-2xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent/60 placeholder:text-slate-600"
        />

        <StepButton onClick={() => bump(coarseStep ?? step)} label={`Increase ${label}`}>
          +
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-14 w-14 shrink-0 rounded-xl bg-ink-700 text-2xl font-semibold text-slate-100 transition active:scale-95 active:bg-ink-600"
    >
      {children}
    </button>
  );
}
