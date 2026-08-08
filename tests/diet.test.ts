import { describe, expect, it } from 'vitest';
import {
  DAILY_TARGETS,
  MEALS,
  findOption,
  foodActionsFor,
  planTotals,
  totalsFor,
} from '../src/lib/diet';

describe('the plan', () => {
  it('is exactly three meals', () => {
    expect(MEALS.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('hits the daily targets when eaten in full', () => {
    const t = planTotals();
    expect(t.kcal).toBe(2300);
    // The plan quotes 176 g protein against a 170 g target — deliberately over.
    expect(t.protein).toBe(176);
    expect(t.protein).toBeGreaterThanOrEqual(DAILY_TARGETS.protein);
    expect(t.fat).toBe(70);
    expect(t.carbs).toBe(245);
  });

  it('keeps every swap macro-equivalent to its default', () => {
    for (const meal of MEALS) {
      const base = meal.options[0]!.macros;
      for (const o of meal.options) {
        expect(o.macros).toEqual(base);
      }
    }
  });

  it('offers a zero-cook option for every meal', () => {
    for (const meal of MEALS) {
      expect(meal.options.some((o) => o.cookMin <= 5)).toBe(true);
    }
  });
});

describe('totalsFor', () => {
  it('counts only what was actually eaten', () => {
    const t = totalsFor({ m1: { eaten: true }, m2: { eaten: true }, m3: { eaten: false } });
    expect(t.mealsEaten).toBe(2);
    expect(t.kcal).toBe(1520);
    expect(t.protein).toBe(119);
  });

  it('treats a skipped meal as a real deficit, not the full plan', () => {
    // Silently assuming the plan would corrupt the TDEE estimate downstream.
    expect(totalsFor({}).kcal).toBe(0);
    expect(totalsFor({}).mealsEaten).toBe(0);
  });

  it('uses the chosen swap', () => {
    const t = totalsFor({ m2: { eaten: true, optionId: 'm2_paneer' } });
    expect(t.kcal).toBe(770);
  });

  it('falls back to the default when a swap id is unknown', () => {
    const t = totalsFor({ m1: { eaten: true, optionId: 'nonsense' } });
    expect(t.kcal).toBe(750);
  });
});

describe('findOption', () => {
  it('defaults to the first option', () => {
    expect(findOption('m1')!.id).toBe('m1_default');
    expect(findOption('m3')!.id).toBe('m3_fish');
  });

  it('resolves a named swap', () => {
    expect(findOption('m3', 'm3_keema')!.label).toBe('Chicken keema');
  });
});

describe('translating verdicts into food', () => {
  it('turns "losing too fast" into eating more, not less', () => {
    const a = foodActionsFor('losing_too_fast');
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((x) => x.deltaKcal > 0)).toBe(true);
    expect(a[0]!.action).toContain('chapati');
  });

  it('offers both a food lever and a steps lever for a stall', () => {
    const a = foodActionsFor('stall');
    expect(a.some((x) => x.deltaKcal < 0)).toBe(true);
    expect(a.some((x) => x.action.includes('steps'))).toBe(true);
  });

  it('adds carbs when gaining too slowly and cuts them when too fast', () => {
    expect(foodActionsFor('gain_too_slow').every((x) => x.deltaKcal > 0)).toBe(true);
    expect(foodActionsFor('gain_too_fast').every((x) => x.deltaKcal < 0)).toBe(true);
  });

  it('says nothing when the verdict is to change nothing', () => {
    expect(foodActionsFor('on_track')).toEqual([]);
  });
});
