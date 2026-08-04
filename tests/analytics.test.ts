import { describe, expect, it } from 'vitest';
import {
  adonisRatio,
  computeAdaptiveTDEE,
  computeBaseline,
  computeCompliance,
  computeEMA,
  computeReadiness,
  computeTrendDelta,
  sleepScore,
  waistToHeight,
} from '../src/lib/analytics';
import { ENERGY } from '../src/lib/config';
import { day, makeLog, makeLogs } from './helpers';

// ---------------------------------------------------------------------------
// §6.1 — EMA
// ---------------------------------------------------------------------------

describe('computeEMA', () => {
  // 14 days moving 82.0 -> 81.3, with day 5 missing entirely.
  const raw = Array.from({ length: 14 }, (_, i) => ({
    date: day(i),
    value: 82.0 - (0.7 * i) / 13,
  })).filter((_, i) => i !== 5);

  it('smooths monotonically and never breaks on a missing day', () => {
    const ema = computeEMA(raw, 7);

    expect(ema).toHaveLength(13); // 14 days minus the gap
    expect(ema.map((p) => p.date)).not.toContain(day(5));

    // A monotonically falling input produces a monotonically falling EMA.
    for (let i = 1; i < ema.length; i++) {
      expect(ema[i]!.ema).toBeLessThan(ema[i - 1]!.ema);
    }

    // ...and it lags, so it stays above the raw value it is chasing downward.
    for (let i = 1; i < ema.length; i++) {
      expect(ema[i]!.ema).toBeGreaterThan(ema[i]!.raw);
    }
  });

  it('places the last EMA between the last raw value and the prior EMA', () => {
    const ema = computeEMA(raw, 7);
    const last = ema[ema.length - 1]!;
    const prior = ema[ema.length - 2]!;

    expect(last.ema).toBeGreaterThan(last.raw);
    expect(last.ema).toBeLessThan(prior.ema);
  });

  it('seeds on the first value and returns empty for no input', () => {
    expect(computeEMA([])).toEqual([]);
    const one = computeEMA([{ date: day(0), value: 80 }]);
    expect(one[0]!.ema).toBe(80);
  });
});

describe('computeTrendDelta', () => {
  it('reports the 7-day change in trend weight', () => {
    const series = computeEMA(
      Array.from({ length: 14 }, (_, i) => ({ date: day(i), value: 82 - i * 0.05 })),
    );
    const delta = computeTrendDelta(series, 7);
    expect(delta).not.toBeNull();
    expect(delta!.spanDays).toBe(7);
    expect(delta!.deltaKg).toBeLessThan(0);
  });

  it('returns null before the series reaches back far enough', () => {
    const series = computeEMA([
      { date: day(0), value: 82 },
      { date: day(1), value: 81.9 },
    ]);
    expect(computeTrendDelta(series, 7)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §6.2 — Adaptive TDEE
// ---------------------------------------------------------------------------

describe('computeAdaptiveTDEE', () => {
  // 40 days of history so the EMA is warm, falling at exactly 0.5 kg / 14 days,
  // with intake logged at 2300 kcal every day.
  const RATE = 0.5 / 14;
  const fullHistory = makeLogs(40, (i) => ({
    weight_kg: 85 - i * RATE,
    kcal_intake: 2300,
  }));

  it('estimates ~2575 kcal from 2300 intake and a -0.50 kg trend over 14 days', () => {
    const est = computeAdaptiveTDEE(fullHistory, 14);

    expect(est).not.toBeNull();
    expect(est!.meanIntake).toBe(2300);
    expect(est!.trendDeltaKg).toBeCloseTo(-0.5, 2);

    // 2300 + (0.50 x 7700 / 14) = 2575
    expect(est!.tdee).toBeGreaterThanOrEqual(2570);
    expect(est!.tdee).toBeLessThanOrEqual(2580);
  });

  it('returns null with only 6 days of logged intake', () => {
    const sparse = makeLogs(40, (i) => ({
      weight_kg: 85 - i * RATE,
      // Intake on 6 days inside the trailing window only.
      kcal_intake: i >= 34 ? 2300 : null,
    }));

    const est = computeAdaptiveTDEE(sparse, 14);
    expect(est).toBeNull();
    expect(6).toBeLessThan(ENERGY.MIN_INTAKE_DAYS_FOR_TDEE);
  });

  it('marks the 14-day window low confidence and the 28-day window ok', () => {
    expect(computeAdaptiveTDEE(fullHistory, 14)!.confidence).toBe('low');
    expect(computeAdaptiveTDEE(fullHistory, 28)!.confidence).toBe('ok');
  });

  it('uses trend endpoints, so one heavy day does not move the estimate much', () => {
    const spiked = fullHistory.map((l, i) =>
      i === fullHistory.length - 1 ? { ...l, weight_kg: (l.weight_kg as number) + 1.5 } : l,
    );
    const base = computeAdaptiveTDEE(fullHistory, 14)!;
    const withSpike = computeAdaptiveTDEE(spiked, 14)!;
    // A +1.5 kg raw spike moves trend weight by only k = 0.25 of that.
    expect(Math.abs(withSpike.tdee - base.tdee)).toBeLessThan(250);
  });
});

// ---------------------------------------------------------------------------
// §4.3 — Readiness
// ---------------------------------------------------------------------------

describe('computeReadiness', () => {
  const history = makeLogs(30, () => ({ resting_hr: 55, hrv_ms: 60 }));
  const baseline = computeBaseline(history, day(29));

  it('builds baselines from the trailing window', () => {
    expect(baseline.rhr).toBeCloseTo(55, 5);
    expect(baseline.hrv).toBeCloseTo(60, 5);
  });

  it('scores a good day green and names no drivers', () => {
    const today = makeLog(day(30), {
      resting_hr: 53,
      hrv_ms: 68,
      sleep_hours: 8,
      energy_1_10: 8,
      mood_1_10: 8,
    });
    const r = computeReadiness(today, baseline)!;
    expect(r.band).toBe('green');
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.drivers).toHaveLength(0);
  });

  it('scores a wrecked day red and names the biggest drivers', () => {
    const today = makeLog(day(30), {
      resting_hr: 63,
      hrv_ms: 40,
      sleep_hours: 4.5,
      energy_1_10: 3,
      mood_1_10: 3,
    });
    const r = computeReadiness(today, baseline)!;
    expect(r.band).toBe('red');
    expect(r.score).toBeLessThan(50);
    expect(r.drivers.length).toBeGreaterThan(0);
    expect(r.drivers.length).toBeLessThanOrEqual(2);
  });

  it('still scores when HRV is missing, by renormalising the weights', () => {
    const today = makeLog(day(30), {
      resting_hr: 55,
      sleep_hours: 8,
      energy_1_10: 7,
      mood_1_10: 7,
    });
    const r = computeReadiness(today, baseline)!;
    expect(r.components.map((c) => c.key)).not.toContain('hrv');
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('returns null when there is nothing to score', () => {
    expect(computeReadiness(makeLog(day(30)), baseline)).toBeNull();
  });

  it('maps sleep hours onto the poor/good bands', () => {
    expect(sleepScore(4)).toBe(0);
    expect(sleepScore(6)).toBeCloseTo(0.4, 5);
    expect(sleepScore(7.5)).toBe(1);
    expect(sleepScore(9)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §6.7 — Aesthetics
// ---------------------------------------------------------------------------

describe('derived aesthetics', () => {
  it('computes the Adonis ratio and flags it below target', () => {
    const a = adonisRatio(120, 84)!;
    // 120/84 = 1.42857…; the spec quotes the truncated 1.428, we round to 3dp.
    expect(a.ratio).toBeCloseTo(1.42857, 3);
    expect(a.ratio).toBe(1.429);
    expect(a.status).toBe('below');
    expect(a.label).toBe('below target (1.60)');
    expect(a.distanceToTarget).toBeCloseTo(-0.171, 3); // 0.171 short of the 1.60 floor
  });

  it('recognises a ratio inside the target band', () => {
    const a = adonisRatio(129, 80)!; // 1.6125
    expect(a.status).toBe('in_band');
    expect(a.distanceToTarget).toBe(0);
  });

  it('flags waist-to-height at or above 0.50', () => {
    expect(waistToHeight(84, 180)!.flagged).toBe(false);
    expect(waistToHeight(90, 180)!.flagged).toBe(true);
    expect(waistToHeight(90, 180)!.ratio).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

describe('computeCompliance', () => {
  it('prefers the explicit toggle', () => {
    const logs = makeLogs(10, (i) => ({ calories_on_target: i < 9 }));
    expect(computeCompliance(logs, 2300).pct).toBe(90);
  });

  it('falls back to exact intake within tolerance of the target', () => {
    const logs = makeLogs(10, (i) => ({ kcal_intake: i < 8 ? 2350 : 2900 }));
    expect(computeCompliance(logs, 2300).pct).toBe(80);
  });

  it('ignores days with no calorie evidence rather than counting them as misses', () => {
    const logs = [
      ...makeLogs(4, () => ({ calories_on_target: true })),
      makeLog(day(50), { weight_kg: 80 }),
    ];
    const c = computeCompliance(logs, 2300);
    expect(c.daysLogged).toBe(4);
    expect(c.pct).toBe(100);
  });
});
