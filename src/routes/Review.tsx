import { useDailyLogs } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { useTrend } from '../hooks/useTrend';
import { useWeeklyRecommendation } from '../hooks/useRecommendation';
import { VerdictCard } from '../components/VerdictCard';

/**
 * Phase 5 turns this into the full Sunday ritual — week aggregates, the whole
 * decision engine, and an acknowledgement persisted to `recommendations`. The
 * weekly rate verdict already works, so it is shown here rather than withheld.
 */
export default function Review() {
  const { data: logs } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const { delta } = useTrend(logs);
  const weekly = useWeeklyRecommendation(logs, delta, phase);

  return (
    <div className="space-y-4 pt-1">
      {weekly ? (
        <>
          <VerdictCard verdict={weekly.verdict} eyebrow="This week" defaultOpen />
          <section className="card">
            <h2 className="text-sm font-medium muted">Adherence</h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{weekly.compliancePct}%</p>
            <p className="mt-1 text-sm muted">
              From {weekly.daysAssessed} day(s) with calorie data this week.
            </p>
          </section>
        </>
      ) : (
        <section className="card">
          <p className="muted">
            A week of weight and a set phase produce the first verdict here.
          </p>
        </section>
      )}

      <section className="card">
        <h2 className="font-medium">Coming in Phase 5</h2>
        <ul className="mt-2 space-y-1 text-sm muted">
          <li>Deload and overreaching checks</li>
          <li>Phase-transition calls on waist and body fat</li>
          <li>Week aggregates: sleep, RHR, HRV, readiness, PRs</li>
          <li>Acknowledge a recommendation to file it</li>
        </ul>
      </section>
    </div>
  );
}
