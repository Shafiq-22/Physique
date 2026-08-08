import { foodActionsFor } from '../lib/diet';
import type { Verdict } from '../lib/types';

/**
 * The weekly verdict, expressed in this plan's food.
 *
 * "Add 200 kcal" is not something you can act on at 19:45 — "add a fourth
 * chapati" is. The engine decides direction and size; this maps it onto the
 * levers the plan actually has. Nothing renders when the verdict is to change
 * nothing, because then there is nothing to do.
 */
export function FoodActionCard({ verdict }: { verdict: Verdict }) {
  const actions = foodActionsFor(verdict.code);
  if (actions.length === 0) return null;

  return (
    <section className="card" aria-label="What to change at the table">
      <h2 className="text-sm font-medium muted">On the plate</h2>
      <p className="mt-1 text-xs muted">Pick one. Hold it for a full week before judging it.</p>
      <ul className="mt-2 space-y-2">
        {actions.map((a) => (
          <li key={a.action} className="flex items-baseline gap-2">
            <span
              className={`shrink-0 text-xs tabular-nums ${
                a.deltaKcal > 0 ? 'text-accent' : a.deltaKcal < 0 ? 'text-amber-300' : 'muted'
              }`}
            >
              {a.deltaKcal === 0
                ? '—'
                : `${a.deltaKcal > 0 ? '+' : ''}${a.deltaKcal}`}
            </span>
            <span className="text-sm text-slate-200">{a.action}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
