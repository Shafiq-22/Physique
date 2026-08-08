import { PREP_SUNDAY, PREP_WEDNESDAY, WEEKDAY_COOKING } from '../lib/diet';
import type { ISODate } from '../lib/types';

/**
 * The prep nudge, on the two days it matters.
 *
 * The whole plan rests on Sunday's 45 minutes: breakfast becomes zero minutes
 * and lunch a two-minute reheat only because the cooking already happened. A
 * missed prep day is what turns a good week into takeaway on Wednesday, so it is
 * surfaced on the day rather than left in a document.
 */
export function PrepCard({ date }: { date: ISODate }) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isSunday = dow === 0;
  const isWednesday = dow === 3;
  if (!isSunday && !isWednesday) return null;

  const tasks = isSunday ? PREP_SUNDAY : PREP_WEDNESDAY;

  return (
    <section className="card border border-sky-500/30" aria-label="Prep day">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">{isSunday ? 'Sunday prep' : 'Wednesday top-up'}</h2>
        <span className="shrink-0 text-xs muted">{isSunday ? '~45 min' : '~10 min'}</span>
      </div>
      <p className="mt-1 text-xs muted">
        {isSunday ? WEEKDAY_COOKING : 'Chicken keeps best 3–4 days.'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {tasks.map((t) => (
          <li key={t.task} className="flex gap-2 text-sm text-slate-300">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
            <span>
              {t.task}
              {t.detail ? <span className="block text-xs muted">{t.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
