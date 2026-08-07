/**
 * Pure analytics. No I/O, no React, no Date.now() — every function is a
 * deterministic transform of its arguments so it can be unit-tested directly.
 */

import { AESTHETICS, EMA_SPAN, ENERGY, PROFILE, READINESS, COMPLIANCE_KCAL_TOLERANCE } from './config';
import { daysBetween, isoCompare } from './dates';
import type { DailyLog, ISODate, Measurement } from './types';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------------
// 4.1 Trend weight — 7-day EMA
// ---------------------------------------------------------------------------

export interface DatedValue {
  date: ISODate;
  value: number;
}

export interface EMAPoint {
  date: ISODate;
  ema: number;
  /** The raw observation behind this point, kept for the "tap to reveal" view. */
  raw: number;
}

/**
 * Exponential moving average over logged days in date order.
 *
 * Gaps are tolerated by design: a missing day is simply absent from the series
 * rather than breaking it or being interpolated. Weighing is voluntary and
 * skipping a day should cost nothing.
 */
export function computeEMA(points: DatedValue[], span: number = EMA_SPAN): EMAPoint[] {
  const clean = points
    .filter((p) => isNum(p.value))
    .slice()
    .sort((a, b) => isoCompare(a.date, b.date));

  if (clean.length === 0) return [];

  const k = 2 / (span + 1);
  const out: EMAPoint[] = [];
  let ema = clean[0]!.value;

  for (let i = 0; i < clean.length; i++) {
    const p = clean[i]!;
    ema = i === 0 ? p.value : ema + k * (p.value - ema);
    out.push({ date: p.date, ema, raw: p.value });
  }
  return out;
}

/** Weight logs as EMA input, newest last. */
export function weightSeries(logs: DailyLog[]): DatedValue[] {
  return logs
    .filter((l) => isNum(l.weight_kg))
    .map((l) => ({ date: l.log_date, value: l.weight_kg as number }));
}

/** The EMA point on or immediately before `date`, or null if the series starts later. */
export function emaAsOf(series: EMAPoint[], date: ISODate): EMAPoint | null {
  let found: EMAPoint | null = null;
  for (const p of series) {
    if (isoCompare(p.date, date) <= 0) found = p;
    else break;
  }
  return found;
}

export interface TrendDelta {
  emaNow: number;
  emaThen: number;
  deltaKg: number;
  fromDate: ISODate;
  toDate: ISODate;
  /** Actual days spanned, which may differ from `days` when logs are sparse. */
  spanDays: number;
}

/**
 * Change in trend weight over the trailing `days`. Returns null when the series
 * does not yet reach back that far — the UI then says "building your trend"
 * rather than showing a delta computed from too little history.
 */
export function computeTrendDelta(series: EMAPoint[], days = 7): TrendDelta | null {
  if (series.length < 2) return null;

  const last = series[series.length - 1]!;
  const targetDate = shiftISO(last.date, -days);
  const then = emaAsOf(series, targetDate);
  if (!then || then.date === last.date) return null;

  return {
    emaNow: last.ema,
    emaThen: then.ema,
    deltaKg: last.ema - then.ema,
    fromDate: then.date,
    toDate: last.date,
    spanDays: daysBetween(then.date, last.date),
  };
}

// Local ISO shift that avoids importing the whole date module into hot paths.
function shiftISO(date: ISODate, delta: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 4.2 Adaptive TDEE
// ---------------------------------------------------------------------------

export interface AdaptiveTDEE {
  tdee: number;
  confidence: 'low' | 'ok';
  nDays: number;
  meanIntake: number;
  trendDeltaKg: number;
  windowDays: number;
}

/**
 * MacroFactor-style expenditure estimate.
 *
 *   TDEE ≈ meanDailyIntake − (Δ trend weight in kg × kcal/kg ÷ days)
 *
 * Δ comes from EMA endpoints, never raw weights — a single salty dinner must
 * not move the estimate. Returns null until there is enough logged intake, in
 * which case the caller falls back to the static Mifflin figure.
 */
export function computeAdaptiveTDEE(
  logs: DailyLog[],
  windowDays: number = ENERGY.TDEE_WINDOW_DAYS,
): AdaptiveTDEE | null {
  if (logs.length === 0) return null;

  const sorted = logs.slice().sort((a, b) => isoCompare(a.log_date, b.log_date));
  const ref = sorted[sorted.length - 1]!.log_date;
  // A delta "over N days" needs samples N days apart, so the window is
  // inclusive of both endpoints: [ref − windowDays, ref].
  const windowStart = shiftISO(ref, -windowDays);
  const inWindow = sorted.filter((l) => isoCompare(l.log_date, windowStart) >= 0);

  const intakes = inWindow.filter((l) => isNum(l.kcal_intake)).map((l) => l.kcal_intake as number);
  if (intakes.length < ENERGY.MIN_INTAKE_DAYS_FOR_TDEE) return null;

  // Seed the EMA on full history so the endpoints inside the window are warm.
  const series = computeEMA(weightSeries(sorted));
  const inner = series.filter((p) => isoCompare(p.date, windowStart) >= 0);
  if (inner.length < 2) return null;

  const first = inner[0]!;
  const last = inner[inner.length - 1]!;
  const elapsed = daysBetween(first.date, last.date);
  if (elapsed <= 0) return null;

  const trendDeltaKg = last.ema - first.ema;
  const dailyEnergyBalance = (trendDeltaKg * ENERGY.KCAL_PER_KG_FAT) / elapsed;
  const meanIntake = mean(intakes);
  const tdee = meanIntake - dailyEnergyBalance;

  const stable = windowDays >= ENERGY.TDEE_WINDOW_DAYS_STABLE && intakes.length >= 20;

  return {
    tdee: Math.round(tdee),
    confidence: stable ? 'ok' : 'low',
    nDays: intakes.length,
    meanIntake: Math.round(meanIntake),
    trendDeltaKg: round(trendDeltaKg, 3),
    windowDays,
  };
}

/**
 * Prefer the 28-day window once there is enough data for it; fall back to 14.
 * The longer window is materially more stable, so it wins whenever available.
 */
export function computeBestAdaptiveTDEE(logs: DailyLog[]): AdaptiveTDEE | null {
  return (
    computeAdaptiveTDEE(logs, ENERGY.TDEE_WINDOW_DAYS_STABLE) ??
    computeAdaptiveTDEE(logs, ENERGY.TDEE_WINDOW_DAYS)
  );
}

/** Static fallback shown while the adaptive estimator is still learning. */
export function mifflinStJeorTDEE(opts: {
  weightKg: number;
  heightCm?: number;
  ageYears: number;
  sex?: string;
  activityFactor?: number;
}): number {
  const heightCm = opts.heightCm ?? PROFILE.HEIGHT_CM;
  const s = (opts.sex ?? PROFILE.SEX) === 'male' ? 5 : -161;
  const bmr = 10 * opts.weightKg + 6.25 * heightCm - 5 * opts.ageYears + s;
  return Math.round(bmr * (opts.activityFactor ?? 1.45));
}

// ---------------------------------------------------------------------------
// 4.3 Readiness
// ---------------------------------------------------------------------------

export interface Baseline {
  rhr: number | null;
  hrv: number | null;
  nDays: number;
}

export interface Readiness {
  score: number;
  band: 'green' | 'amber' | 'red';
  drivers: string[];
  components: { key: string; score: number; weight: number; label: string }[];
}

/**
 * Baseline over the 30 days ending just *before* an evaluation window.
 *
 * When a rule asks "has RHR been elevated for the last 8 days?", the answer must
 * be measured against what normal looked like beforehand. Including those 8 days
 * in the baseline lets a sustained elevation quietly redefine normal and hide the
 * very signal the rule exists to catch.
 */
export function computePriorBaseline(
  logs: DailyLog[],
  windowStart: ISODate,
  windowDays: number = READINESS.BASELINE_DAYS,
): Baseline {
  return computeBaseline(logs, shiftISO(windowStart, -1), windowDays);
}

/** Trailing-window averages of RHR and HRV, used as the readiness reference. */
export function computeBaseline(
  logs: DailyLog[],
  asOf: ISODate,
  windowDays: number = READINESS.BASELINE_DAYS,
): Baseline {
  const start = shiftISO(asOf, -windowDays);
  const win = logs.filter(
    (l) => isoCompare(l.log_date, start) >= 0 && isoCompare(l.log_date, asOf) <= 0,
  );
  const rhrs = win.filter((l) => isNum(l.resting_hr)).map((l) => l.resting_hr as number);
  const hrvs = win.filter((l) => isNum(l.hrv_ms)).map((l) => l.hrv_ms as number);
  return {
    rhr: rhrs.length ? mean(rhrs) : null,
    hrv: hrvs.length ? mean(hrvs) : null,
    nDays: win.length,
  };
}

/** Sleep hours → 0..1, flat-topped through the good band. */
export function sleepScore(hours: number): number {
  const { SLEEP_FLOOR, SLEEP_POOR, SLEEP_GOOD, SLEEP_POOR_SCORE } = READINESS;
  if (hours <= SLEEP_FLOOR) return 0;
  if (hours >= SLEEP_GOOD) return 1;
  if (hours <= SLEEP_POOR) {
    return ((hours - SLEEP_FLOOR) / (SLEEP_POOR - SLEEP_FLOOR)) * SLEEP_POOR_SCORE;
  }
  const t = (hours - SLEEP_POOR) / (SLEEP_GOOD - SLEEP_POOR);
  return SLEEP_POOR_SCORE + t * (1 - SLEEP_POOR_SCORE);
}

/**
 * Map a deviation from baseline onto 0..1, where sitting exactly at baseline
 * scores BASELINE_SCORE and there is headroom above it for a genuinely good day.
 * `dev` is normalised and signed so that positive always means "better".
 */
function deviationScore(dev: number): number {
  const b = READINESS.BASELINE_SCORE;
  return clamp01(dev >= 0 ? b + (1 - b) * dev : b + b * dev);
}

/**
 * Weighted readiness 0..100 with the one or two biggest negative drivers named.
 * Components whose inputs are missing are dropped and the remaining weights are
 * renormalised, so a day without an HRV reading still produces a usable score.
 */
export function computeReadiness(today: DailyLog, baseline: Baseline): Readiness | null {
  const W = READINESS.WEIGHTS;
  const parts: { key: string; score: number; weight: number; label: string }[] = [];

  if (isNum(today.resting_hr) && isNum(baseline.rhr)) {
    const delta = today.resting_hr - baseline.rhr;
    parts.push({
      key: 'rhr',
      score: deviationScore(-delta / READINESS.RHR_SPAN_BPM),
      weight: W.rhr,
      label: `Resting HR ${Math.round(today.resting_hr)} vs ${Math.round(baseline.rhr)} baseline`,
    });
  }

  if (isNum(today.hrv_ms) && isNum(baseline.hrv) && baseline.hrv > 0) {
    const rel = (today.hrv_ms - baseline.hrv) / baseline.hrv;
    parts.push({
      key: 'hrv',
      score: deviationScore(rel / READINESS.HRV_SPAN_PCT),
      weight: W.hrv,
      label: `HRV ${Math.round(today.hrv_ms)}ms vs ${Math.round(baseline.hrv)}ms baseline`,
    });
  }

  if (isNum(today.sleep_hours)) {
    parts.push({
      key: 'sleep',
      score: sleepScore(today.sleep_hours),
      weight: W.sleep,
      label: `Slept ${round(today.sleep_hours, 1)}h`,
    });
  }

  const subj = [today.energy_1_10, today.mood_1_10].filter(isNum);
  if (subj.length) {
    parts.push({
      key: 'subjective',
      score: clamp01(mean(subj) / 10),
      weight: W.subjective,
      label: `Energy/mood ${subj.map((v) => Math.round(v)).join(' & ')}`,
    });
  }

  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(
    (parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight) * 100,
  );

  const band = score >= READINESS.GREEN ? 'green' : score >= READINESS.AMBER ? 'amber' : 'red';

  const drivers = parts
    .filter((p) => p.score < READINESS.DRIVER_THRESHOLD)
    .sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))
    .slice(0, 2)
    .map((p) => p.label);

  return { score, band, drivers, components: parts };
}

/** What the band means, in instruction form. */
export const READINESS_ACTION: Record<Readiness['band'], string> = {
  green: 'Train as planned.',
  amber: 'Drop the last set of each exercise.',
  red: 'Easy day — mobility or a walk.',
};

// ---------------------------------------------------------------------------
// 4.5 Derived aesthetics
// ---------------------------------------------------------------------------

export interface RatioReading {
  ratio: number;
  target: readonly [number, number];
  status: 'below' | 'in_band' | 'above';
  /** Signed distance to the nearest edge of the target band; 0 when inside. */
  distanceToTarget: number;
  label: string;
}

export function adonisRatio(shouldersCm: number, waistCm: number): RatioReading | null {
  if (!isNum(shouldersCm) || !isNum(waistCm) || waistCm <= 0) return null;
  const [lo, hi] = AESTHETICS.ADONIS_TARGET as unknown as [number, number];
  const ratio = round(shouldersCm / waistCm, 3);
  const status = ratio < lo ? 'below' : ratio > hi ? 'above' : 'in_band';
  const distanceToTarget =
    status === 'below' ? round(ratio - lo, 3) : status === 'above' ? round(ratio - hi, 3) : 0;
  return {
    ratio,
    target: [lo, hi],
    status,
    distanceToTarget,
    label:
      status === 'in_band'
        ? `in target band (${lo.toFixed(2)}–${hi.toFixed(2)})`
        : status === 'below'
          ? `below target (${lo.toFixed(2)})`
          : `above target (${hi.toFixed(2)})`,
  };
}

export interface WaistHeightReading {
  ratio: number;
  flagged: boolean;
  threshold: number;
  label: string;
}

export function waistToHeight(
  waistCm: number,
  heightCm: number = PROFILE.HEIGHT_CM,
): WaistHeightReading | null {
  if (!isNum(waistCm) || !isNum(heightCm) || heightCm <= 0) return null;
  const ratio = round(waistCm / heightCm, 3);
  const flagged = ratio >= AESTHETICS.WAIST_HEIGHT_FLAG;
  return {
    ratio,
    flagged,
    threshold: AESTHETICS.WAIST_HEIGHT_FLAG,
    label: flagged ? `at or above health flag (${AESTHETICS.WAIST_HEIGHT_FLAG})` : 'healthy range',
  };
}

export function latestMeasurement(ms: Measurement[]): Measurement | null {
  if (ms.length === 0) return null;
  return ms.slice().sort((a, b) => isoCompare(a.measured_on, b.measured_on))[ms.length - 1]!;
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

export interface Compliance {
  pct: number;
  daysOnTarget: number;
  daysLogged: number;
}

/**
 * Share of logged days that hit the calorie target.
 *
 * An explicit `calories_on_target` toggle wins; otherwise exact intake within
 * COMPLIANCE_KCAL_TOLERANCE of the phase target counts. Days with neither are
 * not counted as failures — they are simply not evidence either way.
 */
export function computeCompliance(logs: DailyLog[], targetKcal: number | null): Compliance {
  let onTarget = 0;
  let assessed = 0;

  for (const l of logs) {
    if (typeof l.calories_on_target === 'boolean') {
      assessed++;
      if (l.calories_on_target) onTarget++;
    } else if (isNum(l.kcal_intake) && isNum(targetKcal)) {
      assessed++;
      if (Math.abs(l.kcal_intake - targetKcal) <= COMPLIANCE_KCAL_TOLERANCE) onTarget++;
    }
  }

  return {
    pct: assessed === 0 ? 0 : Math.round((onTarget / assessed) * 100),
    daysOnTarget: onTarget,
    daysLogged: assessed,
  };
}

export { round as roundTo, shiftISO };
