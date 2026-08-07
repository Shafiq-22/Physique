import { Link } from 'react-router-dom';
import { useDailyLogs, useLogForDate } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { useTrend } from '../hooks/useTrend';
import { useWeeklyRecommendation } from '../hooks/useRecommendation';
import { TrendCard } from '../components/TrendCard';
import { VerdictCard } from '../components/VerdictCard';
import { shortLabel, todayISO } from '../lib/dates';
import { PHASE_TARGETS } from '../lib/config';

const PHASE_LABEL: Record<string, string> = {
  cut: 'Cutting',
  maintain: 'Maintaining',
  gain: 'Lean gain',
  mini_cut: 'Mini-cut',
};

export default function Today() {
  const today = todayISO();
  const { data: logs, isLoading, error } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const { data: todayLog } = useLogForDate(today);
  const { series, delta } = useTrend(logs);
  const weekly = useWeeklyRecommendation(logs, delta, phase);

  const loggedToday = todayLog?.weight_kg !== null && todayLog?.weight_kg !== undefined;

  return (
    <div className="space-y-4 pt-1">
      {!loggedToday ? (
        <Link to="/log" className="btn-primary block w-full text-center">
          Log today (30s)
        </Link>
      ) : null}

      {phase ? (
        <div className="flex items-center gap-2">
          <span className="chip bg-ink-700 text-slate-300">
            {PHASE_LABEL[phase.phase_type] ?? phase.phase_type}
          </span>
          <span className="text-xs muted">
            {phase.target_kcal ?? PHASE_TARGETS[phase.phase_type].kcal} kcal · since{' '}
            {shortLabel(phase.start_date)}
          </span>
        </div>
      ) : (
        <Link to="/settings" className="card block">
          <p className="font-medium">Set your phase</p>
          <p className="mt-1 text-sm muted">
            Verdicts need to know whether you are cutting, maintaining or gaining.
          </p>
        </Link>
      )}

      {error ? (
        <div className="card border border-danger/40">
          <p className="text-sm text-danger">Could not reach the server.</p>
          <p className="mt-1 text-sm muted">
            Showing what is cached. Anything you log now syncs when you are back online.
          </p>
        </div>
      ) : null}

      {isLoading && !logs ? (
        <div className="card">
          <p className="muted">Loading your trend…</p>
        </div>
      ) : (
        <TrendCard series={series} delta={delta} />
      )}

      {weekly ? (
        <VerdictCard verdict={weekly.verdict} eyebrow="This week" />
      ) : phase && series.length > 0 ? (
        <section className="card">
          <p className="text-sm muted">
            Seven days of weight builds the first verdict. {7 - Math.min(series.length, 7)} to go.
          </p>
        </section>
      ) : null}

      {loggedToday ? (
        <p className="pt-2 text-center text-sm muted">
          Logged for today. That is everything — close the app.
        </p>
      ) : null}
    </div>
  );
}
