import { useDailyLogs } from '../hooks/useDailyLog';
import { useTrend } from '../hooks/useTrend';
import { TrendCard } from '../components/TrendCard';

/**
 * Phase 4 fills this in with measurements, photos, benchmarks and the Adonis /
 * waist-to-height readings. For now it holds the long view of the trend.
 */
export default function Progress() {
  const { data: logs } = useDailyLogs();
  const { series, delta } = useTrend(logs);

  return (
    <div className="space-y-4 pt-1">
      <TrendCard series={series} delta={delta} days={365} />

      <section className="card">
        <h2 className="font-medium">Coming in Phase 4</h2>
        <ul className="mt-2 space-y-1 text-sm muted">
          <li>Weekly tape measurements</li>
          <li>Adonis ratio and waist-to-height against target bands</li>
          <li>Private progress photos with two-date comparison</li>
          <li>Monthly benchmark tests</li>
        </ul>
      </section>
    </div>
  );
}
