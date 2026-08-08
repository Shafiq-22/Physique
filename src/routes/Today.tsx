import { Link } from 'react-router-dom';
import { useDailyLogs, useLogForDate } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { useMeasurements } from '../hooks/useMeasurements';
import { useWorkouts, useWorkoutSets } from '../hooks/useWorkouts';
import { useRecommendations } from '../hooks/useRecommendations';
import { useEngine } from '../hooks/useEngine';
import { TrendCard } from '../components/TrendCard';
import { VerdictCard } from '../components/VerdictCard';
import { ReadinessRing } from '../components/ReadinessRing';
import { TdeeCard } from '../components/TdeeCard';
import { TargetsCard } from '../components/TargetsCard';
import { SessionCard } from '../components/SessionCard';
import { FoodActionCard } from '../components/FoodActionCard';
import { PrepCard } from '../components/PrepCard';
import { MEALS, totalsFor } from '../lib/diet';
import { useProfile } from '../hooks/useProfile';
import { programWeeksElapsed } from '../hooks/useProgram';
import { intervalForWeek, isHighRiskWindow, sessionForDate } from '../lib/program';
import { shortLabel, todayISO } from '../lib/dates';
import { PHASE_TARGETS } from '../lib/config';

const PHASE_LABEL: Record<string, string> = {
  cut: 'Cutting',
  maintain: 'Maintaining',
  gain: 'Lean gain',
  mini_cut: 'Mini-cut',
  recomp: 'Recomp',
};

export default function Today() {
  const today = todayISO();
  const { data: logs, isLoading, error } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const { data: measurements } = useMeasurements();
  const { data: workouts } = useWorkouts();
  const { data: sets } = useWorkoutSets();
  const { data: recommendations } = useRecommendations();
  const { data: todayLog } = useLogForDate(today);
  const { data: profile } = useProfile();

  const engine = useEngine({ logs, phase, measurements, workouts, sets, recommendations });
  const loggedToday = todayLog?.weight_kg !== null && todayLog?.weight_kg !== undefined;

  // Today's programmed session, and whether it has already been logged.
  const session = sessionForDate(today);
  const weeks = programWeeksElapsed(profile, logs);
  const trainedToday = (workouts ?? []).some((w) => w.performed_at.slice(0, 10) === today);
  const mealsToday = totalsFor(todayLog?.meals ?? {});

  return (
    <div className="space-y-4 pt-1">
      {/* The safety net outranks everything else on the screen. */}
      {engine.overreaching ? (
        <VerdictCard verdict={engine.overreaching} eyebrow="Stop and read this" defaultOpen />
      ) : null}

      {!loggedToday ? (
        <Link to="/log" className="btn-primary block w-full text-center">
          Log today (30s)
        </Link>
      ) : null}

      <SessionCard
        session={session}
        done={trainedToday}
        interval={session.cardioZone === 'intervals' ? intervalForWeek(weeks) : null}
        weeksElapsed={weeks}
        highRisk={isHighRiskWindow(weeks)}
      />

      {phase ? (
        <div className="flex items-center gap-2">
          <span className="chip bg-ink-700 text-slate-300">
            {PHASE_LABEL[phase.phase_type] ?? phase.phase_type}
          </span>
          <span className="text-xs muted">
            {engine.targets?.kcal ?? phase.target_kcal ?? PHASE_TARGETS[phase.phase_type].kcal} kcal · since{' '}
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
        <TrendCard series={engine.series} delta={engine.trendDelta} />
      )}

      {engine.readiness ? <ReadinessRing readiness={engine.readiness} /> : null}

      {engine.targets ? <TargetsCard targets={engine.targets} /> : null}

      {engine.weekly ? (
        <VerdictCard verdict={engine.weekly} eyebrow="This week" />
      ) : phase && engine.series.length > 0 ? (
        <section className="card">
          <p className="text-sm muted">
            Seven days of weight builds the first verdict. {7 - Math.min(engine.series.length, 7)} to
            go.
          </p>
        </section>
      ) : null}

      {engine.weekly ? <FoodActionCard verdict={engine.weekly} /> : null}

      {engine.transition ? (
        <VerdictCard verdict={engine.transition} eyebrow="Phase" />
      ) : null}

      {engine.deload && engine.deload.code !== 'no_deload' ? (
        <VerdictCard verdict={engine.deload} eyebrow="Recovery" />
      ) : null}

      <Link to="/log" className="card block" aria-label="Meals today">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium muted">Meals</span>
          <span className="text-xs muted tabular-nums">
            {mealsToday.mealsEaten}/{MEALS.length}
          </span>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {mealsToday.kcal}
          <span className="ml-1 text-sm font-normal muted">kcal</span>
          <span className="ml-3 text-lg">{mealsToday.protein}</span>
          <span className="ml-1 text-sm font-normal muted">g protein</span>
        </p>
        <div className="mt-2 flex gap-1.5">
          {MEALS.map((m) => (
            <span
              key={m.id}
              className={`h-1.5 flex-1 rounded-full ${
                (todayLog?.meals ?? {})[m.id]?.eaten ? 'bg-accent' : 'bg-ink-700'
              }`}
            />
          ))}
        </div>
      </Link>

      <PrepCard date={today} />

      <TdeeCard
        adaptive={engine.tdee}
        fallback={engine.mifflin}
        intakeDays={engine.intakeDays}
      />

      <div className="flex gap-2">
        <Link to="/program" className="btn-ghost flex-1 text-center">
          Programme
        </Link>
        <Link to="/measure" className="btn-ghost flex-1 text-center">
          Measure
        </Link>
      </div>

      {loggedToday ? (
        <p className="pb-2 pt-1 text-center text-sm muted">
          Logged for today. That is everything — close the app.
        </p>
      ) : null}
    </div>
  );
}
