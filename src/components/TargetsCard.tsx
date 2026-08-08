import { useState } from 'react';
import type { PhaseTargets } from '../lib/targets';
import { PHASE_RULES } from '../lib/config';
import { roundTo } from '../lib/analytics';

/**
 * The three numbers the phase actually asks of you, plus how they were reached.
 *
 * Everything here is derived from current bodyweight and measured expenditure,
 * so it moves as you do — a target that was right 8 kg ago is not right now.
 */
export function TargetsCard({ targets }: { targets: PhaseTargets }) {
  const [open, setOpen] = useState(false);
  const rule = PHASE_RULES[targets.phase];
  const [lo, hi] = targets.weeklyChangeKg;

  return (
    <section className="card" aria-label="Phase targets">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium muted">{rule.label} targets</h2>
        <span
          className={`chip ${
            targets.tdeeSource === 'measured'
              ? 'bg-sky-500/15 text-sky-300'
              : 'bg-ink-700 text-slate-400'
          }`}
        >
          {targets.tdeeSource === 'measured'
            ? 'from your data'
            : targets.tdeeSource === 'estimated'
              ? 'estimated'
              : 'plan default'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure value={targets.kcal} unit="kcal" label="per day" />
        <Figure value={targets.protein_g} unit="g" label="protein" />
        <Figure
          value={roundTo((lo + hi) / 2, 2)}
          unit="kg"
          label="per week"
          signed
        />
      </div>

      <p className="mt-3 text-xs muted">
        Acceptable range {lo} to {hi} kg/week ({targets.weeklyChangePctBw[0]}% to{' '}
        {targets.weeklyChangePctBw[1]}% of bodyweight).
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 text-sm font-medium text-sky-300"
      >
        {open ? 'Hide the maths' : 'How was this worked out?'}
      </button>

      {open ? (
        <ul className="mt-2 space-y-1.5 border-t border-ink-700 pt-2">
          {targets.rationale.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-slate-300">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Figure({
  value,
  unit,
  label,
  signed = false,
}: {
  value: number;
  unit: string;
  label: string;
  signed?: boolean;
}) {
  return (
    <div className="rounded-xl bg-ink-900 px-2 py-2.5 text-center">
      <p className="text-xl font-semibold tabular-nums">
        {signed && value > 0 ? '+' : ''}
        {value}
        <span className="ml-0.5 text-xs font-normal muted">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11px] muted">{label}</p>
    </div>
  );
}
