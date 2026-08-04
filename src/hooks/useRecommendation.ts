import { useMemo } from 'react';
import { computeCompliance, shiftISO } from '../lib/analytics';
import { evaluateWeekly } from '../lib/decisionEngine';
import { PHASE_TARGETS } from '../lib/config';
import type { DailyLog, Phase, Verdict } from '../lib/types';
import type { TrendDelta } from '../lib/analytics';

export interface WeeklyRecommendation {
  verdict: Verdict;
  compliancePct: number;
  daysAssessed: number;
}

/**
 * The weekly verdict for the current phase, or null while the trend is still
 * building. Compliance is measured over the same seven days as the trend delta,
 * so the verdict and its rationale describe one consistent week.
 */
export function useWeeklyRecommendation(
  logs: DailyLog[] | undefined,
  delta: TrendDelta | null,
  phase: Phase | null | undefined,
): WeeklyRecommendation | null {
  return useMemo(() => {
    if (!delta || !phase) return null;

    const weekStart = shiftISO(delta.toDate, -6);
    const week = (logs ?? []).filter((l) => l.log_date >= weekStart && l.log_date <= delta.toDate);
    const targetKcal = phase.target_kcal ?? PHASE_TARGETS[phase.phase_type].kcal;
    const compliance = computeCompliance(week, targetKcal);

    const verdict = evaluateWeekly(
      { emaNow: delta.emaNow, emaPrevWeek: delta.emaThen, bodyweightKg: delta.emaNow },
      phase.phase_type,
      compliance.pct,
    );

    return { verdict, compliancePct: compliance.pct, daysAssessed: compliance.daysLogged };
  }, [logs, delta, phase]);
}
