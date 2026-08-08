interface Props {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  /** Reverses the tint: for symptoms, "Yes" is the bad answer. */
  yesIsBad?: boolean;
}

/** Three-state Yes / No / unanswered. Tapping the active choice clears it. */
export function Toggle({ label, hint, value, onChange, yesIsBad = false }: Props) {
  const opts: { v: boolean; text: string }[] = [
    { v: true, text: 'Yes' },
    { v: false, text: 'No' },
  ];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {hint ? <span className="shrink-0 text-xs muted">{hint}</span> : null}
      </div>
      <div className="mt-2 flex gap-2">
        {opts.map((o) => {
          const active = value === o.v;
          const bad = yesIsBad ? o.v : !o.v;
          return (
            <button
              key={o.text}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : o.v)}
              className={`h-12 flex-1 rounded-xl font-semibold transition active:scale-[0.98] ${
                active
                  ? bad
                    ? 'bg-amber-400 text-ink-900'
                    : 'bg-accent text-ink-900'
                  : 'bg-ink-700 text-slate-300'
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
