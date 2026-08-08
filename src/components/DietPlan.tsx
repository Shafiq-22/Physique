import { useState } from 'react';
import {
  CALORIE_TRAPS,
  CARB_SWAPS,
  DAILY_TARGETS,
  DIET_DISCLAIMER,
  HYDRATION,
  LEAN_GAIN,
  MEALS,
  PREP_SUNDAY,
  PREP_WEDNESDAY,
  QUICK_COOK,
  WEEKDAY_COOKING,
  planTotals,
} from '../lib/diet';
import type { PhaseType } from '../lib/types';

/** The diet, as reference. Today answers what to eat now; this is everything else. */
export function DietPlan({ phase }: { phase: PhaseType | null }) {
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const totals = planTotals();
  const gaining = phase === 'gain';

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="font-medium">Daily targets</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat value={DAILY_TARGETS.kcal} label="kcal" />
          <Stat value={DAILY_TARGETS.protein} label="g protein" />
          <Stat value={DAILY_TARGETS.fat} label="g fat" />
          <Stat value={DAILY_TARGETS.carbs} label="g carbs" />
        </div>
        <p className="mt-2 text-xs muted">
          {DAILY_TARGETS.fibreG[0]}–{DAILY_TARGETS.fibreG[1]} g fibre ·{' '}
          {DAILY_TARGETS.waterL[0]}–{DAILY_TARGETS.waterL[1]} L water. Halal, whole-food, no
          protein powder — the plan hits {totals.protein} g protein from food alone.
        </p>
        <p className="mt-1 text-xs muted">
          Strictly three meals. Fruit and nuts are folded into meals, never eaten as separate
          snacks.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium muted">The three meals</h2>
        {MEALS.map((meal) => {
          const open = openMeal === meal.id;
          const def = meal.options[0]!;
          return (
            <div key={meal.id} className="card">
              <button
                type="button"
                onClick={() => setOpenMeal(open ? null : meal.id)}
                aria-expanded={open}
                className="w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    <span className="mr-2 text-xs muted tabular-nums">{meal.time}</span>
                    {meal.label}
                  </span>
                  <span className="shrink-0 text-xs muted tabular-nums">
                    {def.macros.kcal} kcal · {def.macros.protein} g P
                  </span>
                </div>
                <span className="block text-xs muted">{meal.role}</span>
              </button>

              {open ? (
                <div className="mt-3 space-y-3 border-t border-ink-700 pt-3">
                  {meal.options.map((o) => (
                    <div key={o.id}>
                      <p className="text-sm font-medium text-slate-200">
                        {o.label}
                        <span className="ml-2 text-xs font-normal muted">
                          {o.cookMin === 0 ? 'no cook' : `${o.cookMin} min`}
                        </span>
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {o.items.map((i) => (
                          <li key={i} className="text-xs muted">
                            {i}
                          </li>
                        ))}
                      </ul>
                      {o.note ? <p className="text-xs text-slate-400">{o.note}</p> : null}
                    </div>
                  ))}
                  {meal.base ? (
                    <p className="text-xs muted">Base kept across swaps: {meal.base}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <p className="px-1 text-xs muted">{CARB_SWAPS}</p>
      </section>

      <section className="card">
        <h2 className="font-medium">Prep — this is what makes it easy</h2>
        <p className="mt-1 text-xs muted">{WEEKDAY_COOKING}</p>

        <h3 className="mt-3 text-sm font-medium text-slate-300">Sunday · ~45 min</h3>
        <ol className="mt-1 space-y-1">
          {PREP_SUNDAY.map((p, i) => (
            <li key={p.task} className="flex gap-2 text-sm text-slate-300">
              <span className="w-4 shrink-0 text-xs muted tabular-nums">{i + 1}</span>
              <span>
                {p.task}
                {p.detail ? <span className="block text-xs muted">{p.detail}</span> : null}
              </span>
            </li>
          ))}
        </ol>

        <h3 className="mt-3 text-sm font-medium text-slate-300">Wednesday · ~10 min</h3>
        <ul className="mt-1 space-y-1">
          {PREP_WEDNESDAY.map((p) => (
            <li key={p.task} className="flex gap-2 text-sm text-slate-300">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{p.task}</span>
            </li>
          ))}
        </ul>

        <table className="mt-3 w-full text-xs">
          <tbody>
            {QUICK_COOK.map((q) => (
              <tr key={q.protein} className="border-t border-ink-700">
                <td className="py-1.5 pr-2 text-slate-200">{q.protein}</td>
                <td className="py-1.5 pr-2 muted">{q.method}</td>
                <td className="py-1.5 text-right muted tabular-nums">{q.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-medium">Hydration & sodium</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {HYDRATION.targetL[0]}–{HYDRATION.targetL[1]}
          <span className="ml-1 text-sm font-normal muted">L / day</span>
        </p>
        <p className="mt-1 text-xs muted">{HYDRATION.check}</p>
        <p className="mt-2 text-sm text-slate-300">{HYDRATION.sodium}</p>
        <p className="mt-1 text-xs muted">{HYDRATION.potassium}</p>
      </section>

      <section className="card border border-amber-500/30">
        <h2 className="font-medium">Two invisible calorie traps</h2>
        <ul className="mt-2 space-y-1.5">
          {CALORIE_TRAPS.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-amber-200">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`card ${gaining ? 'border border-accent/40' : ''}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">Lean gain</h2>
          <span className="shrink-0 text-xs muted">
            {gaining ? 'active now' : '≈ month 10'}
          </span>
        </div>
        <p className="mt-1 text-sm muted">{LEAN_GAIN.note}</p>
        <p className="mt-2 text-sm tabular-nums text-slate-200">
          {LEAN_GAIN.kcal} kcal · {LEAN_GAIN.protein} g protein · {LEAN_GAIN.carbs} g carbs
        </p>
        <ul className="mt-2 space-y-1">
          {LEAN_GAIN.additions.map((a) => (
            <li key={a} className="flex gap-2 text-sm text-slate-300">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 pb-2 text-xs muted">{DIET_DISCLAIMER}</p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-ink-900 px-2 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] muted">{label}</p>
    </div>
  );
}
