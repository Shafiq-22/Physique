import { daysBetween } from '../lib/dates';
import type { DailyLog, ISODate, Profile } from '../lib/types';

/**
 * Whole weeks since the programme began.
 *
 * The explicit `program_start` wins. Without one, the first logged day is the
 * best available guess — you started logging when you started training — so the
 * conditioning block advances sensibly rather than sitting at week 1 forever.
 * Returns null when there is nothing to measure from.
 */
export function programWeeksElapsed(
  profile: Profile | null | undefined,
  logs: DailyLog[] | undefined,
): number | null {
  const start: ISODate | null =
    profile?.program_start ??
    (logs && logs.length
      ? logs.reduce((a, b) => (a.log_date <= b.log_date ? a : b)).log_date
      : null);

  if (!start) return null;

  const days = daysBetween(start, new Date().toISOString().slice(0, 10));
  return days < 0 ? 0 : Math.floor(days / 7);
}
