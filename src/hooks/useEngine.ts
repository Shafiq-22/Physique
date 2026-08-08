import { useMemo } from 'react';
import {
  computeBaseline,
  computeBestAdaptiveTDEE,
  computeCompliance,
  computeEMA,
  computeReadiness,
  computeTrendDelta,
  latestMeasurement,
  mifflinStJeorTDEE,
  shiftISO,
  weightSeries,
} from '../lib/analytics';
import {
  evaluateDeload,
  evaluateOverreaching,
  evaluatePhaseTransition,
  evaluateWeekly,
} from '../lib/decisionEngine';
import { computeStrengthTrend } from '../lib/workouts';
import { detectProgressStall } from '../lib/progression';
import { computePhaseTargets, type PhaseTargets } from '../lib/targets';
import { PROFILE } from '../lib/config';
import { todayISO } from '../lib/dates';
import type {
  DailyLog,
  ISODate,
  Measurement,
  Phase,
  Recommendation,
  Verdict,
  Workout,
  WorkoutSet,
} from '../lib/types';
import { daysSinceLastDeload } from './useRecommendations';

export interface EngineInput {
  logs: DailyLog[] | undefined;
  phase: Phase | null | undefined;
  measurements?: Measurement[];
  workouts?: Workout[];
  sets?: WorkoutSet[];
  recommendations?: Recommendation[];
}

export interface EngineOutput {
  trendDelta: ReturnType<typeof computeTrendDelta>;
  series: ReturnType<typeof computeEMA>;
  readiness: ReturnType<typeof computeReadiness>;
  tdee: ReturnType<typeof computeBestAdaptiveTDEE>;
  mifflin: number | null;
  intakeDays: number;
  compliancePct: number;
  complianceDays: number;
  weekly: Verdict | null;
  transition: Verdict | null;
  deload: Verdict | null;
  /** High severity and pinned to Today when present. */
  overreaching: Verdict | null;
  strengthDetail: string;
  /** Programme rule: nothing improved on load or reps for 3 weeks. */
  progressStall: ReturnType<typeof detectProgressStall>;
  /** Calories, protein and rate band derived from current weight + expenditure. */
  targets: PhaseTargets | null;
}

const ageFrom = (dob: string, asOf: ISODate): number => {
  const b = new Date(`${dob}T00:00:00Z`);
  const n = new Date(`${asOf}T00:00:00Z`);
  let age = n.getUTCFullYear() - b.getUTCFullYear();
  const m = n.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < b.getUTCDate())) age--;
  return age;
};

/**
 * Runs the whole decision engine over cached data.
 *
 * Every rule is a pure function, so this is just wiring plus memoisation — the
 * verdicts recompute locally and instantly rather than waiting on a round trip.
 */
export function useEngine(input: EngineInput): EngineOutput {
  const { logs, phase, measurements, workouts, sets, recommendations } = input;

  return useMemo(() => {
    const all = logs ?? [];
    const asOf = all.length ? all[all.length - 1]!.log_date : todayISO();

    const series = computeEMA(weightSeries(all));
    const trendDelta = computeTrendDelta(series, 7);

    // --- Readiness ---
    const todayLog = all.find((l) => l.log_date === todayISO()) ?? null;
    const baseline = computeBaseline(all, asOf);
    const readiness = todayLog ? computeReadiness(todayLog, baseline) : null;

    // --- Energy ---
    const tdee = computeBestAdaptiveTDEE(all);
    const intakeDays = all.filter((l) => l.kcal_intake !== null).length;
    const latestWeight = series[series.length - 1]?.ema ?? null;
    const mifflin =
      latestWeight !== null
        ? mifflinStJeorTDEE({
            weightKg: latestWeight,
            ageYears: ageFrom(PROFILE.DOB, todayISO()),
          })
        : null;

    // --- Targets, derived from current weight and measured expenditure ---
    const targets: PhaseTargets | null = phase
      ? computePhaseTargets(
          phase.phase_type,
          latestWeight,
          tdee?.tdee ?? mifflin,
          tdee ? 'measured' : 'estimated',
        )
      : null;

    // --- Compliance over the same week the trend delta covers ---
    const weekEnd = trendDelta?.toDate ?? asOf;
    const weekStart = shiftISO(weekEnd, -6);
    const week = all.filter((l) => l.log_date >= weekStart && l.log_date <= weekEnd);
    // An explicitly saved phase target wins; otherwise use the derived one.
    const targetKcal = phase?.target_kcal ?? targets?.kcal ?? null;
    const compliance = computeCompliance(week, targetKcal);

    // --- Verdicts ---
    const weekly =
      trendDelta && phase
        ? evaluateWeekly(
            {
              emaNow: trendDelta.emaNow,
              emaPrevWeek: trendDelta.emaThen,
              bodyweightKg: trendDelta.emaNow,
            },
            phase.phase_type,
            compliance.pct,
            targets?.weeklyChangeKg,
          )
        : null;

    const transition = phase
      ? evaluatePhaseTransition(latestMeasurement(measurements ?? []), phase.phase_type)
      : null;

    const setDates = new Map<string, ISODate>();
    for (const w of workouts ?? []) setDates.set(w.id, w.performed_at.slice(0, 10));

    // The programme's own rule: nothing improving for 3 weeks is a fatigue flag.
    const progressStall = detectProgressStall(sets ?? [], setDates, asOf);

    const deload = all.length
      ? evaluateDeload({
          logs: all,
          sets,
          setDates,
          daysSinceLastDeload: daysSinceLastDeload(recommendations),
          asOf,
          progressStall,
        })
      : null;

    const strength = computeStrengthTrend(sets ?? [], setDates, asOf);

    // The safety net only applies while in a deficit.
    const inDeficit = phase?.phase_type === 'cut' || phase?.phase_type === 'mini_cut';
    const overreaching = inDeficit
      ? evaluateOverreaching({
          logs: all,
          performanceDeclining: strength.declining,
          asOf,
        })
      : null;

    return {
      series,
      trendDelta,
      readiness,
      tdee,
      mifflin,
      intakeDays,
      compliancePct: compliance.pct,
      complianceDays: compliance.daysLogged,
      weekly,
      transition,
      deload,
      overreaching,
      strengthDetail: strength.detail,
      progressStall,
      targets,
    };
  }, [logs, phase, measurements, workouts, sets, recommendations]);
}
