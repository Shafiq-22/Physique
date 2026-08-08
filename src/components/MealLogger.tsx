import { useState } from 'react';
import {
  DAILY_TARGETS,
  MEALS,
  findOption,
  totalsFor,
  type MealId,
  type MealSelection,
} from '../lib/diet';

interface Props {
  value: MealSelection;
  onChange: (next: MealSelection) => void;
}

/**
 * Three taps instead of a food diary.
 *
 * The plan is fixed, so "ate meal 2, swapped to tuna" fully determines the
 * macros. That makes exact intake logging a three-tap job rather than a weighing
 * exercise — and exact intake is what the adaptive TDEE estimator needs before
 * it can learn anything. Weighing food into a database is more precise in theory
 * and far less accurate in practice, because nobody keeps it up.
 *
 * A skipped meal counts as skipped. Assuming the plan would quietly poison the
 * expenditure estimate.
 */
export function MealLogger({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState<MealId | null>(null);
  const totals = totalsFor(value);

  const toggle = (id: MealId): void => {
    const current = value[id];
    onChange({ ...value, [id]: { ...current, eaten: !current?.eaten } });
  };

  const chooseOption = (id: MealId, optionId: string): void => {
    onChange({ ...value, [id]: { eaten: true, optionId } });
    setExpanded(null);
  };

  return (
    <div className="space-y-3">
      {MEALS.map((meal) => {
        const entry = value[meal.id];
        const option = findOption(meal.id, entry?.optionId);
        const eaten = entry?.eaten === true;
        const open = expanded === meal.id;

        return (
          <div key={meal.id} className="card">
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={eaten}
                aria-label={`${meal.label} eaten`}
                onClick={() => toggle(meal.id)}
                className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-semibold transition active:scale-95 ${
                  eaten ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-500'
                }`}
              >
                {eaten ? '✓' : ''}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{meal.label}</span>
                  <span className="shrink-0 text-xs muted tabular-nums">{meal.time}</span>
                </div>
                <p className="text-sm text-slate-300">{option?.label}</p>
                {option ? (
                  <p className="mt-0.5 text-xs muted tabular-nums">
                    {option.macros.kcal} kcal · {option.macros.protein} g protein ·{' '}
                    {option.cookMin === 0 ? 'no cook' : `${option.cookMin} min`}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : meal.id)}
                  aria-expanded={open}
                  className="mt-1 text-xs font-medium text-sky-300"
                >
                  {open ? 'Close' : 'Swap or see what is in it'}
                </button>
              </div>
            </div>

            {open ? (
              <div className="mt-3 space-y-3 border-t border-ink-700 pt-3">
                {option ? (
                  <ul className="space-y-1">
                    {option.items.map((i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500"
                        />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {meal.base ? <p className="text-xs muted">Base: {meal.base}</p> : null}

                <div>
                  <p className="mb-1.5 text-xs muted">Swap — macros stay the same</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meal.options.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={o.id === option?.id}
                        onClick={() => chooseOption(meal.id, o.id)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                          o.id === option?.id
                            ? 'bg-accent text-ink-900'
                            : 'bg-ink-700 text-slate-300'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium muted">Today so far</span>
          <span className="text-xs muted">{totals.mealsEaten}/3 meals</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Figure
            value={totals.kcal}
            target={DAILY_TARGETS.kcal}
            unit="kcal"
            label="energy"
          />
          <Figure
            value={totals.protein}
            target={DAILY_TARGETS.protein}
            unit="g"
            label="protein"
          />
        </div>
        <p className="mt-2 text-xs muted">
          Derived from the plan, so this counts as exact intake — it feeds the learned TDEE.
        </p>
      </div>
    </div>
  );
}

function Figure({
  value,
  target,
  unit,
  label,
}: {
  value: number;
  target: number;
  unit: string;
  label: string;
}) {
  const pct = Math.min(100, (value / target) * 100);
  const hit = value >= target;

  return (
    <div className="rounded-xl bg-ink-900 px-3 py-2.5">
      <p className={`text-xl font-semibold tabular-nums ${hit ? 'text-accent' : ''}`}>
        {value}
        <span className="ml-0.5 text-xs font-normal muted">{unit}</span>
      </p>
      <p className="text-[11px] muted">
        {label} · target {target}
      </p>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full ${hit ? 'bg-accent' : 'bg-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
