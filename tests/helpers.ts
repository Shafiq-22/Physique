import type { DailyLog, ISODate } from '../src/lib/types';

/** Deterministic day sequence starting from a fixed anchor date. */
export const day = (n: number, anchor = '2026-01-01'): ISODate => {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const makeLog = (date: ISODate, fields: Partial<DailyLog> = {}): DailyLog => ({
  id: `log-${date}`,
  user_id: 'test-user',
  log_date: date,
  weight_kg: null,
  resting_hr: null,
  hrv_ms: null,
  sleep_hours: null,
  energy_1_10: null,
  mood_1_10: null,
  steps: null,
  kcal_intake: null,
  protein_g: null,
  calories_on_target: null,
  protein_hit: null,
  intrusive_food_thoughts: false,
  cold_hands_feet: false,
  meals: null,
  water_l: null,
  notes: null,
  ...fields,
});

/** `n` consecutive logs built by index. */
export const makeLogs = (n: number, build: (i: number) => Partial<DailyLog>): DailyLog[] =>
  Array.from({ length: n }, (_, i) => makeLog(day(i), build(i)));
