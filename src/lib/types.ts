/** Shared types mirroring the Postgres schema in `supabase/migrations`. */

export type PhaseType = 'cut' | 'maintain' | 'gain' | 'mini_cut' | 'recomp';
export type Pose = 'front' | 'side' | 'back';
export type RecommendationScope = 'weekly' | 'monthly' | 'deload' | 'alert';
export type Severity = 'info' | 'warn' | 'high';

/** ISO date, `yyyy-MM-dd`. */
export type ISODate = string;

export interface Profile {
  id: string;
  display_name: string | null;
  dob: ISODate | null;
  sex: string | null;
  height_cm: number | null;
  /** When the training programme began; drives the conditioning block. */
  program_start: ISODate | null;
  created_at?: string;
}

export interface Phase {
  id: string;
  user_id: string;
  phase_type: PhaseType;
  start_date: ISODate;
  end_date: ISODate | null;
  target_kcal: number | null;
  protein_g: number | null;
  target_weekly_change_kg: number | null;
  notes: string | null;
  created_at?: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: ISODate;
  weight_kg: number | null;
  resting_hr: number | null;
  hrv_ms: number | null;
  sleep_hours: number | null;
  energy_1_10: number | null;
  mood_1_10: number | null;
  steps: number | null;
  kcal_intake: number | null;
  protein_g: number | null;
  calories_on_target: boolean | null;
  protein_hit: boolean | null;
  intrusive_food_thoughts: boolean | null;
  cold_hands_feet: boolean | null;
  notes: string | null;
  created_at?: string;
}

/** The subset a client sends when creating/updating a day. */
export type DailyLogInput = Partial<Omit<DailyLog, 'id' | 'user_id' | 'created_at'>> & {
  log_date: ISODate;
};

export interface Measurement {
  id: string;
  user_id: string;
  measured_on: ISODate;
  waist_cm: number | null;
  chest_cm: number | null;
  shoulders_cm: number | null;
  arm_l_cm: number | null;
  arm_r_cm: number | null;
  forearm_cm: number | null;
  neck_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  hip_cm: number | null;
  bodyfat_pct: number | null;
  created_at?: string;
}

export interface Workout {
  id: string;
  user_id: string;
  performed_at: string;
  session_type: string | null;
  session_rpe: number | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_name: string;
  set_index: number;
  load_kg: number | null;
  leverage: string | null;
  reps: number | null;
  rpe: number | null;
  is_pr: boolean | null;
}

export interface Benchmark {
  id: string;
  user_id: string;
  measured_on: ISODate;
  metric: string;
  value: number;
}

export interface Photo {
  id: string;
  user_id: string;
  taken_on: ISODate;
  pose: Pose;
  storage_path: string;
  created_at?: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  generated_on: ISODate;
  scope: RecommendationScope;
  verdict: string;
  rationale: string[] | null;
  data_snapshot: Record<string, unknown> | null;
  acknowledged: boolean;
}

/**
 * The output shape of every decision-engine rule.
 *
 * `rationale` and `snapshot` are not optional extras — the UI renders them so
 * the user always sees which numbers produced the instruction.
 */
export interface Verdict {
  verdict: string;
  severity: Severity;
  rationale: string[];
  snapshot: Record<string, unknown>;
  /** Machine-readable rule outcome, for tests and persistence. */
  code: string;
}
