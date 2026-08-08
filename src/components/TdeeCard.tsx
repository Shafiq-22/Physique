import type { AdaptiveTDEE } from '../lib/analytics';
import { ENERGY } from '../lib/config';

interface Props {
  adaptive: AdaptiveTDEE | null;
  /** Static Mifflin–St Jeor estimate, shown while the adaptive one is learning. */
  fallback: number | null;
  /** Days of exact intake logged so far, for the progress hint. */
  intakeDays: number;
}

/**
 * Learned energy expenditure.
 *
 * Until there are enough days of logged intake this shows the textbook Mifflin
 * estimate and says plainly that it is still learning — a population average
 * dressed up as a personal number would be worse than no number at all.
 */
export function TdeeCard({ adaptive, fallback, intakeDays }: Props) {
  if (!adaptive) {
    const needed = Math.max(0, ENERGY.MIN_INTAKE_DAYS_FOR_TDEE - intakeDays);
    return (
      <section className="card" aria-label="Energy expenditure">
        <h2 className="text-sm font-medium muted">Maintenance calories</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {fallback ?? '—'}
          <span className="ml-1 text-base font-normal muted">kcal</span>
        </p>
        <p className="mt-1 text-sm muted">
          Textbook estimate. Learning your metabolism — {needed} more day
          {needed === 1 ? '' : 's'} of logged intake needed.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Energy expenditure">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium muted">Maintenance calories</h2>
        <span
          className={`chip ${
            adaptive.confidence === 'ok'
              ? 'bg-sky-500/15 text-sky-300'
              : 'bg-ink-700 text-slate-400'
          }`}
        >
          {adaptive.confidence === 'ok' ? 'Confident' : 'Early estimate'}
        </span>
      </div>

      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {adaptive.tdee}
        <span className="ml-1 text-base font-normal muted">kcal</span>
      </p>

      <p className="mt-1 text-sm muted">
        Learned from {adaptive.nDays} days of intake averaging {adaptive.meanIntake} kcal, against
        a {adaptive.trendDeltaKg >= 0 ? '+' : ''}
        {adaptive.trendDeltaKg} kg move in trend weight over {adaptive.windowDays} days.
      </p>
    </section>
  );
}
