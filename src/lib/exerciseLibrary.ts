/**
 * Exercise library, indexed by body part and by what you need to do it.
 *
 * Curated rather than exhaustive: every entry is something worth programming.
 * A list of 500 machine variations makes the picker slower, not better.
 *
 * `equipment` is the real filter — the question at 6am is rarely "what hits
 * chest" and almost always "what hits chest with what I have in this room".
 */

export type BodyPart =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'full_body';

export type Equipment =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'machine'
  | 'cable'
  | 'band'
  | 'pullup_bar'
  | 'kettlebell';

export type Pattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'isolation'
  | 'anti_extension'
  | 'anti_rotation';

export interface Exercise {
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment[];
  pattern: Pattern;
  /** Compound lifts carry the programme; isolation fills the gaps. */
  compound: boolean;
  /** Typical working range, used to pre-fill and to sanity-check entries. */
  repRange: [number, number];
  /** Short note on execution or why it earns its place. */
  note?: string;
}

export const BODY_PARTS: { key: BodyPart; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
  { key: 'legs', label: 'Legs' },
  { key: 'core', label: 'Core' },
  { key: 'full_body', label: 'Full body' },
];

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'dumbbell', label: 'Dumbbells' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'pullup_bar', label: 'Pull-up bar' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'band', label: 'Bands' },
  { key: 'cable', label: 'Cable' },
  { key: 'machine', label: 'Machine' },
];

export const EXERCISES: Exercise[] = [
  // --- Chest ---
  { name: 'Barbell Bench Press', bodyPart: 'chest', equipment: ['barbell'], pattern: 'horizontal_push', compound: true, repRange: [4, 8], note: 'The primary horizontal press.' },
  { name: 'Incline Barbell Press', bodyPart: 'chest', equipment: ['barbell'], pattern: 'horizontal_push', compound: true, repRange: [5, 10], note: 'Biases upper chest.' },
  { name: 'Dumbbell Bench Press', bodyPart: 'chest', equipment: ['dumbbell'], pattern: 'horizontal_push', compound: true, repRange: [6, 12], note: 'Longer range, kinder to shoulders.' },
  { name: 'Incline Dumbbell Press', bodyPart: 'chest', equipment: ['dumbbell'], pattern: 'horizontal_push', compound: true, repRange: [8, 12] },
  { name: 'Push-up', bodyPart: 'chest', equipment: ['bodyweight'], pattern: 'horizontal_push', compound: true, repRange: [8, 25], note: 'Elevate feet or hands to change the load.' },
  { name: 'Dip', bodyPart: 'chest', equipment: ['bodyweight'], pattern: 'horizontal_push', compound: true, repRange: [5, 12], note: 'Lean forward for chest, upright for triceps.' },
  { name: 'Cable Fly', bodyPart: 'chest', equipment: ['cable'], pattern: 'isolation', compound: false, repRange: [10, 15] },
  { name: 'Dumbbell Fly', bodyPart: 'chest', equipment: ['dumbbell'], pattern: 'isolation', compound: false, repRange: [10, 15] },

  // --- Back ---
  { name: 'Pull-up', bodyPart: 'back', equipment: ['pullup_bar'], pattern: 'vertical_pull', compound: true, repRange: [4, 12], note: 'Add load or band-assist to stay in range.' },
  { name: 'Chin-up', bodyPart: 'back', equipment: ['pullup_bar'], pattern: 'vertical_pull', compound: true, repRange: [4, 12], note: 'Supinated: more biceps.' },
  { name: 'Lat Pulldown', bodyPart: 'back', equipment: ['machine', 'cable'], pattern: 'vertical_pull', compound: true, repRange: [8, 15] },
  { name: 'Barbell Row', bodyPart: 'back', equipment: ['barbell'], pattern: 'horizontal_pull', compound: true, repRange: [6, 10] },
  { name: 'Pendlay Row', bodyPart: 'back', equipment: ['barbell'], pattern: 'horizontal_pull', compound: true, repRange: [4, 8], note: 'Dead-stop each rep.' },
  { name: 'Single-arm Dumbbell Row', bodyPart: 'back', equipment: ['dumbbell'], pattern: 'horizontal_pull', compound: true, repRange: [8, 12] },
  { name: 'Seated Cable Row', bodyPart: 'back', equipment: ['cable', 'machine'], pattern: 'horizontal_pull', compound: true, repRange: [8, 15] },
  { name: 'Inverted Row', bodyPart: 'back', equipment: ['bodyweight'], pattern: 'horizontal_pull', compound: true, repRange: [8, 20], note: 'Raise or lower the bar to change difficulty.' },
  { name: 'Face Pull', bodyPart: 'back', equipment: ['cable', 'band'], pattern: 'isolation', compound: false, repRange: [12, 20], note: 'Rear delts and shoulder health.' },
  { name: 'Straight-arm Pulldown', bodyPart: 'back', equipment: ['cable'], pattern: 'isolation', compound: false, repRange: [10, 15] },

  // --- Shoulders ---
  { name: 'Overhead Press', bodyPart: 'shoulders', equipment: ['barbell'], pattern: 'vertical_push', compound: true, repRange: [4, 8], note: 'The primary vertical press.' },
  { name: 'Seated Dumbbell Press', bodyPart: 'shoulders', equipment: ['dumbbell'], pattern: 'vertical_push', compound: true, repRange: [6, 12] },
  { name: 'Pike Push-up', bodyPart: 'shoulders', equipment: ['bodyweight'], pattern: 'vertical_push', compound: true, repRange: [6, 15], note: 'Elevate feet to progress toward handstand work.' },
  { name: 'Lateral Raise', bodyPart: 'shoulders', equipment: ['dumbbell', 'cable', 'band'], pattern: 'isolation', compound: false, repRange: [12, 20], note: 'Side delts drive shoulder width — the Adonis ratio lives here.' },
  { name: 'Rear Delt Fly', bodyPart: 'shoulders', equipment: ['dumbbell', 'cable'], pattern: 'isolation', compound: false, repRange: [12, 20] },
  { name: 'Arnold Press', bodyPart: 'shoulders', equipment: ['dumbbell'], pattern: 'vertical_push', compound: true, repRange: [8, 12] },

  // --- Arms ---
  { name: 'Barbell Curl', bodyPart: 'arms', equipment: ['barbell'], pattern: 'isolation', compound: false, repRange: [8, 12] },
  { name: 'Dumbbell Curl', bodyPart: 'arms', equipment: ['dumbbell'], pattern: 'isolation', compound: false, repRange: [8, 15] },
  { name: 'Hammer Curl', bodyPart: 'arms', equipment: ['dumbbell'], pattern: 'isolation', compound: false, repRange: [8, 15], note: 'Brachialis and forearm.' },
  { name: 'Incline Dumbbell Curl', bodyPart: 'arms', equipment: ['dumbbell'], pattern: 'isolation', compound: false, repRange: [10, 15], note: 'Long head under stretch.' },
  { name: 'Cable Triceps Pushdown', bodyPart: 'arms', equipment: ['cable'], pattern: 'isolation', compound: false, repRange: [10, 15] },
  { name: 'Overhead Triceps Extension', bodyPart: 'arms', equipment: ['dumbbell', 'cable'], pattern: 'isolation', compound: false, repRange: [10, 15], note: 'Long head under stretch.' },
  { name: 'Close-grip Bench Press', bodyPart: 'arms', equipment: ['barbell'], pattern: 'horizontal_push', compound: true, repRange: [6, 10] },
  { name: 'Bench Dip', bodyPart: 'arms', equipment: ['bodyweight'], pattern: 'isolation', compound: false, repRange: [10, 20] },
  { name: 'Wrist Curl', bodyPart: 'arms', equipment: ['dumbbell', 'barbell'], pattern: 'isolation', compound: false, repRange: [15, 25] },

  // --- Legs ---
  { name: 'Back Squat', bodyPart: 'legs', equipment: ['barbell'], pattern: 'squat', compound: true, repRange: [4, 8], note: 'The primary squat.' },
  { name: 'Front Squat', bodyPart: 'legs', equipment: ['barbell'], pattern: 'squat', compound: true, repRange: [4, 8], note: 'More quad, more upright.' },
  { name: 'Goblet Squat', bodyPart: 'legs', equipment: ['dumbbell', 'kettlebell'], pattern: 'squat', compound: true, repRange: [8, 15] },
  { name: 'Conventional Deadlift', bodyPart: 'legs', equipment: ['barbell'], pattern: 'hinge', compound: true, repRange: [3, 6], note: 'The primary hinge. Costly to recover from — programme it honestly.' },
  { name: 'Romanian Deadlift', bodyPart: 'legs', equipment: ['barbell', 'dumbbell'], pattern: 'hinge', compound: true, repRange: [6, 12], note: 'Hamstrings under stretch.' },
  { name: 'Bulgarian Split Squat', bodyPart: 'legs', equipment: ['dumbbell', 'bodyweight'], pattern: 'lunge', compound: true, repRange: [8, 12], note: 'Brutal, and the best single-leg builder.' },
  { name: 'Walking Lunge', bodyPart: 'legs', equipment: ['dumbbell', 'bodyweight'], pattern: 'lunge', compound: true, repRange: [10, 20] },
  { name: 'Hip Thrust', bodyPart: 'legs', equipment: ['barbell'], pattern: 'hinge', compound: true, repRange: [8, 15] },
  { name: 'Leg Press', bodyPart: 'legs', equipment: ['machine'], pattern: 'squat', compound: true, repRange: [10, 15] },
  { name: 'Leg Curl', bodyPart: 'legs', equipment: ['machine'], pattern: 'isolation', compound: false, repRange: [10, 15] },
  { name: 'Leg Extension', bodyPart: 'legs', equipment: ['machine'], pattern: 'isolation', compound: false, repRange: [12, 20] },
  { name: 'Standing Calf Raise', bodyPart: 'legs', equipment: ['machine', 'dumbbell', 'bodyweight'], pattern: 'isolation', compound: false, repRange: [12, 20] },
  { name: 'Nordic Curl', bodyPart: 'legs', equipment: ['bodyweight'], pattern: 'isolation', compound: false, repRange: [4, 10], note: 'Hamstring insurance.' },

  // --- Core ---
  { name: 'Plank', bodyPart: 'core', equipment: ['bodyweight'], pattern: 'anti_extension', compound: false, repRange: [1, 1], note: 'Logged in seconds, not reps.' },
  { name: 'Hollow Hold', bodyPart: 'core', equipment: ['bodyweight'], pattern: 'anti_extension', compound: false, repRange: [1, 1], note: 'Logged in seconds.' },
  { name: 'Hanging Leg Raise', bodyPart: 'core', equipment: ['pullup_bar'], pattern: 'anti_extension', compound: false, repRange: [8, 15] },
  { name: 'Ab Wheel Rollout', bodyPart: 'core', equipment: ['bodyweight'], pattern: 'anti_extension', compound: false, repRange: [8, 15] },
  { name: 'Pallof Press', bodyPart: 'core', equipment: ['cable', 'band'], pattern: 'anti_rotation', compound: false, repRange: [10, 15] },
  { name: 'Cable Crunch', bodyPart: 'core', equipment: ['cable'], pattern: 'isolation', compound: false, repRange: [12, 20] },
  { name: 'Side Plank', bodyPart: 'core', equipment: ['bodyweight'], pattern: 'anti_rotation', compound: false, repRange: [1, 1], note: 'Logged in seconds.' },
  { name: 'Dead Bug', bodyPart: 'core', equipment: ['bodyweight'], pattern: 'anti_extension', compound: false, repRange: [10, 20] },

  // --- Full body ---
  { name: 'Kettlebell Swing', bodyPart: 'full_body', equipment: ['kettlebell'], pattern: 'hinge', compound: true, repRange: [15, 25] },
  { name: 'Clean and Press', bodyPart: 'full_body', equipment: ['barbell', 'dumbbell'], pattern: 'vertical_push', compound: true, repRange: [3, 6] },
  { name: 'Farmer Carry', bodyPart: 'full_body', equipment: ['dumbbell', 'kettlebell'], pattern: 'carry', compound: true, repRange: [1, 1], note: 'Logged as distance or seconds.' },
  { name: 'Burpee', bodyPart: 'full_body', equipment: ['bodyweight'], pattern: 'squat', compound: true, repRange: [10, 20] },
  { name: 'Thruster', bodyPart: 'full_body', equipment: ['barbell', 'dumbbell'], pattern: 'squat', compound: true, repRange: [6, 12] },
];

export interface ExerciseFilter {
  bodyPart?: BodyPart | null;
  /** Match exercises doable with ANY of these. Empty means no filter. */
  equipment?: Equipment[];
  /** Free-text match on the name. */
  query?: string;
  compoundOnly?: boolean;
}

/**
 * Filter the library.
 *
 * Equipment is an OR across what you have: an exercise qualifies if *any* of its
 * accepted implements is available. Results put compounds first — those are what
 * a session should be built around.
 */
export function filterExercises(filter: ExerciseFilter = {}): Exercise[] {
  const { bodyPart, equipment, query, compoundOnly } = filter;
  const q = query?.trim().toLowerCase() ?? '';

  return EXERCISES.filter((e) => {
    if (bodyPart && e.bodyPart !== bodyPart) return false;
    if (compoundOnly && !e.compound) return false;
    if (equipment && equipment.length > 0 && !e.equipment.some((x) => equipment.includes(x)))
      return false;
    if (q && !e.name.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => {
    if (a.compound !== b.compound) return a.compound ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Look up a library entry by name, so logged sets can show their rep range. */
export function findExercise(name: string): Exercise | null {
  const n = name.trim().toLowerCase();
  return EXERCISES.find((e) => e.name.toLowerCase() === n) ?? null;
}

/**
 * Movement patterns covered by a set of exercise names.
 *
 * A session that is three horizontal pushes and nothing else is a gap, not a
 * plan. This is what the balance hint on the workout screen reads.
 */
export function patternsCovered(names: string[]): Set<Pattern> {
  const out = new Set<Pattern>();
  for (const n of names) {
    const e = findExercise(n);
    if (e) out.add(e.pattern);
  }
  return out;
}

/** Push/pull balance within a session — the imbalance that actually causes trouble. */
export function pushPullBalance(names: string[]): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const n of names) {
    const e = findExercise(n);
    if (!e) continue;
    if (e.pattern === 'horizontal_push' || e.pattern === 'vertical_push') push++;
    if (e.pattern === 'horizontal_pull' || e.pattern === 'vertical_pull') pull++;
  }
  return { push, pull };
}
