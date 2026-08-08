/**
 * The training programme, as data.
 *
 * Hybrid Athletic (Upper/Lower + Power), home-first: pull-up bar, kettlebell,
 * light dumbbells, bands, backpack, mat.
 *
 * This file is the plan; `progression.ts` is what decides what to do with it.
 * Keeping them apart means the schedule can be edited without touching a single
 * rule, and every rule stays unit-testable against a fixed programme.
 */

import type { ISODate } from './types';

export type SessionId =
  | 'upper_a'
  | 'lower_a'
  | 'upper_b'
  | 'conditioning'
  | 'power'
  | 'upper_c'
  | 'rest';

export type ExerciseKind = 'power' | 'primary' | 'secondary' | 'accessory' | 'finisher';

export interface ProgramExercise {
  name: string;
  sets: number;
  /** Working rep range. Null when the set is timed instead. */
  repRange: [number, number] | null;
  /** Seconds per set, for holds and carries. */
  timeSec?: [number, number];
  /** Logged per side, so the set count doubles in practice. */
  perSide?: boolean;
  /** Metres, for loaded carries. */
  distanceM?: number;
  rpe: number | [number, number];
  restSec: number;
  kind: ExerciseKind;
  /** 1 = priority muscle (★), 2 = top priority (★★). */
  priority?: 1 | 2;
  /** Performed back-to-back with the exercise above. */
  superset?: boolean;
  /** Key into LADDERS — how this movement gets harder once reps top out. */
  ladder?: LadderKey;
  note?: string;
}

export interface ProgramSession {
  id: SessionId;
  label: string;
  focus: string;
  /** Empty for rest and conditioning days. */
  exercises: ProgramExercise[];
  cardio: string;
  cardioZone: 'easy' | 'zone2' | 'intervals' | 'none';
  mobilityMin: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Governing rules
// ---------------------------------------------------------------------------

export const PROGRAM_RULES = {
  /** Leave 1–3 reps in the tank. Only small isolations go to RPE 9. */
  RPE_MIN: 7,
  RPE_MAX: 9,
  /** Weeks with nothing improving before a deload is mandatory. */
  STALL_WEEKS: 3,
  /** Steps every day, regardless of session. */
  STEPS_MIN: 8000,
  STEPS_MAX: 10000,
  /** Plyometric volume ceiling on the power day. */
  MAX_FOOT_CONTACTS: 80,
} as const;

export type LadderKey =
  | 'pushup'
  | 'pullup'
  | 'pike'
  | 'split_squat'
  | 'rdl'
  | 'lateral_raise'
  | 'core_compression';

/** How each key movement gets harder once the top of the rep range is reached. */
export const LADDERS: Record<LadderKey, { label: string; steps: string[] }> = {
  pushup: {
    label: 'Push-up',
    steps: [
      'Wall',
      'Counter',
      'Table',
      'Chair',
      'Step',
      'Floor',
      'Feet elevated',
      'Backpack loaded',
      'Archer',
      'Ring / deficit',
    ],
  },
  pullup: {
    label: 'Pull-up',
    steps: [
      'Dead hang 45 s',
      'Scapular pull-up 3×8',
      '5-second negatives 5×3',
      'Band-assisted (thinner over time)',
      'Full pull-up',
      'Weighted',
      'L-sit / archer',
    ],
  },
  pike: {
    label: 'Pike / overhead',
    steps: [
      'Pike on floor',
      'Feet on chair',
      'Feet higher',
      'Wall handstand hold',
      'Wall handstand push-up',
    ],
  },
  split_squat: {
    label: 'Split squat',
    steps: [
      'Bodyweight',
      'Rear foot elevated',
      'Holding KB/DBs',
      'Backpack loaded',
      'Deficit front foot',
      '4-second eccentric',
    ],
  },
  rdl: {
    label: 'RDL',
    steps: [
      'Bodyweight hinge',
      'KB RDL',
      'Single-leg RDL',
      'Deficit',
      'Tempo',
      'Nordic curl negatives',
    ],
  },
  lateral_raise: {
    label: 'Lateral raise',
    steps: [
      'More reps',
      'Slower eccentric',
      '1.5-reps',
      'Post-failure partials (myo-reps)',
      'Lean-away',
      'Heavier',
    ],
  },
  core_compression: {
    label: 'Core compression',
    steps: [
      'Plank / hollow',
      'Dead bug',
      'Kneeling ab wheel',
      'Hanging knee raise',
      'Straight-leg raise',
      'Tuck L-sit',
      'Full L-sit',
      'Toes-to-bar',
    ],
  },
};

// ---------------------------------------------------------------------------
// Warm-ups
// ---------------------------------------------------------------------------

export const WARMUP_GENERAL = [
  'Skipping / marching — 90 s',
  'Arm circles front & back ×10, band or towel dislocates ×10',
  'Cat–cow ×8, thoracic rotations ×6/side',
  "World's greatest stretch ×5/side",
  'Bodyweight squats ×10, hip circles ×8/side',
];

export const WARMUP_UPPER = [
  'Scapular push-up 2×12',
  'Scapular pull-up (dead-hang shrug down) 2×8',
  'Band external rotation 2×15',
  'Prone Y-raise 2×12',
];

export const WARMUP_LOWER = [
  'Glute bridge ×15',
  'Side-lying clam ×15/side',
  'Ankle rocks ×15/side',
  'Bodyweight RDL ×10',
];

/** Dynamic only before lifting — long static holds temporarily cut force output. */
export const WARMUP_NOTE =
  'All dynamic. No long static holds before lifting — they temporarily reduce force output.';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const SESSIONS: Record<SessionId, ProgramSession> = {
  upper_a: {
    id: 'upper_a',
    label: 'Upper A',
    focus: 'Push',
    cardio: '30 min Zone 2 (evening)',
    cardioZone: 'zone2',
    mobilityMin: 30,
    exercises: [
      { name: 'Explosive incline push-up', sets: 3, repRange: [3, 3], rpe: 6, restSec: 60, kind: 'power', note: 'Power, not fatigue.' },
      { name: 'Incline push-up', sets: 4, repRange: [6, 12], rpe: [7, 8], restSec: 120, kind: 'primary', ladder: 'pushup' },
      { name: 'Pike push-up', sets: 3, repRange: [6, 10], rpe: 8, restSec: 90, kind: 'secondary', ladder: 'pike' },
      { name: 'Lateral raise', sets: 4, repRange: [15, 25], rpe: 9, restSec: 45, kind: 'accessory', priority: 1, ladder: 'lateral_raise' },
      { name: 'Band external rotation', sets: 3, repRange: [15, 15], rpe: 7, restSec: 30, kind: 'accessory', superset: true },
      { name: 'Overhead triceps extension', sets: 3, repRange: [12, 15], rpe: 8, restSec: 45, kind: 'accessory' },
      { name: 'Serratus scap push-up', sets: 2, repRange: [12, 12], rpe: 7, restSec: 30, kind: 'finisher' },
      { name: 'Hollow hold', sets: 2, repRange: null, timeSec: [30, 30], rpe: 7, restSec: 30, kind: 'finisher', ladder: 'core_compression' },
      { name: 'Neck isometrics', sets: 2, repRange: null, timeSec: [20, 20], rpe: 6, restSec: 30, kind: 'finisher', note: 'Four directions, 20 s each.' },
    ],
  },

  lower_a: {
    id: 'lower_a',
    label: 'Lower A',
    focus: 'Hinge',
    cardio: '20 min brisk walk',
    cardioZone: 'easy',
    mobilityMin: 30,
    exercises: [
      { name: 'Romanian deadlift', sets: 4, repRange: [8, 12], rpe: 8, restSec: 120, kind: 'primary', priority: 1, ladder: 'rdl', note: 'KB or backpack.' },
      { name: 'Bulgarian split squat', sets: 3, repRange: [8, 12], perSide: true, rpe: 8, restSec: 90, kind: 'secondary', ladder: 'split_squat' },
      { name: 'Hip thrust', sets: 3, repRange: [12, 15], rpe: 8, restSec: 60, kind: 'accessory', note: 'Or single-leg glute bridge.' },
      { name: 'Copenhagen plank', sets: 3, repRange: null, timeSec: [20, 20], perSide: true, rpe: 7, restSec: 30, kind: 'accessory', superset: true },
      { name: 'Single-leg standing calf raise', sets: 4, repRange: [12, 20], perSide: true, rpe: 9, restSec: 45, kind: 'accessory' },
      { name: 'Tibialis raise', sets: 3, repRange: [15, 15], rpe: 7, restSec: 30, kind: 'accessory', superset: true },
      { name: 'Suitcase hold', sets: 2, repRange: null, timeSec: [45, 45], perSide: true, rpe: 8, restSec: 45, kind: 'finisher' },
    ],
  },

  upper_b: {
    id: 'upper_b',
    label: 'Upper B',
    focus: 'Pull',
    cardio: '30 min Zone 2',
    cardioZone: 'zone2',
    mobilityMin: 30,
    exercises: [
      { name: 'Pull-up progression', sets: 5, repRange: [3, 6], rpe: 8, restSec: 150, kind: 'primary', priority: 2, ladder: 'pullup', note: 'Stage-appropriate.' },
      { name: 'Inverted row', sets: 4, repRange: [8, 15], rpe: 8, restSec: 90, kind: 'secondary', priority: 1, note: 'Table or bar. Raise or lower the bar to change difficulty.' },
      { name: 'Single-arm KB row', sets: 3, repRange: [10, 15], perSide: true, rpe: 8, restSec: 60, kind: 'accessory' },
      { name: 'Face pull', sets: 4, repRange: [15, 20], rpe: 8, restSec: 45, kind: 'accessory', priority: 1, note: 'Or band pull-apart.' },
      { name: 'Prone Y–T–W raise', sets: 3, repRange: [10, 10], rpe: 7, restSec: 45, kind: 'accessory', note: '10 of each.' },
      { name: 'Biceps curl', sets: 3, repRange: [10, 15], rpe: 8, restSec: 45, kind: 'accessory' },
      { name: 'Wrist curl + reverse curl', sets: 2, repRange: [15, 20], rpe: 8, restSec: 30, kind: 'finisher', superset: true },
      { name: 'Dead hang', sets: 2, repRange: null, timeSec: [30, 60], rpe: 8, restSec: 60, kind: 'finisher', note: 'To max.' },
    ],
  },

  conditioning: {
    id: 'conditioning',
    label: 'Conditioning + Core',
    focus: 'No lifting',
    cardio: '25–30 min intervals',
    cardioZone: 'intervals',
    mobilityMin: 30,
    note: 'Intervals, then a 15 min core circuit: 2–3 rounds, pick 5–6 movements.',
    exercises: [
      { name: 'Hollow body hold', sets: 3, repRange: null, timeSec: [20, 45], rpe: 8, restSec: 45, kind: 'accessory', ladder: 'core_compression' },
      { name: 'Dead bug', sets: 3, repRange: [8, 8], perSide: true, rpe: 7, restSec: 45, kind: 'accessory' },
      { name: 'RKC plank', sets: 3, repRange: null, timeSec: [20, 20], rpe: 9, restSec: 45, kind: 'accessory', note: 'Maximum tension.' },
      { name: 'Ab wheel rollout', sets: 3, repRange: [6, 12], rpe: 8, restSec: 45, kind: 'accessory' },
      { name: 'Pallof press', sets: 3, repRange: [10, 10], perSide: true, rpe: 7, restSec: 45, kind: 'accessory' },
      { name: 'Bird dog', sets: 3, repRange: [8, 8], perSide: true, rpe: 7, restSec: 30, kind: 'accessory' },
      { name: 'Side plank', sets: 3, repRange: null, timeSec: [25, 45], perSide: true, rpe: 8, restSec: 45, kind: 'accessory' },
      { name: 'Hanging knee raise', sets: 4, repRange: [8, 15], rpe: 8, restSec: 60, kind: 'accessory', ladder: 'core_compression' },
      { name: 'Hanging L-sit hold', sets: 3, repRange: null, timeSec: [10, 20], rpe: 8, restSec: 60, kind: 'accessory', ladder: 'core_compression' },
      { name: 'Rotational throw', sets: 3, repRange: [6, 6], perSide: true, rpe: 7, restSec: 45, kind: 'accessory' },
    ],
  },

  power: {
    id: 'power',
    label: 'Power',
    focus: 'Full-body athletic',
    cardio: '15 min easy walk',
    cardioZone: 'easy',
    mobilityMin: 30,
    note: 'Extended 10-min warm-up. Plyos are for quality, never fatigue — full rest, and stop the set the moment jump height drops. 80 foot-contacts maximum.',
    exercises: [
      { name: 'Pogo hops', sets: 3, repRange: [15, 15], rpe: 6, restSec: 45, kind: 'power', note: 'Springy ankles.' },
      { name: 'Countermovement jump', sets: 4, repRange: [4, 4], rpe: 6, restSec: 90, kind: 'power', note: 'Maximum intent.' },
      { name: 'Broad jump', sets: 3, repRange: [3, 3], rpe: 6, restSec: 90, kind: 'power', note: 'Maximum intent.' },
      { name: 'Depth drop to landing hold', sets: 3, repRange: [4, 4], rpe: 6, restSec: 60, kind: 'power', note: '30 cm box. Soft landing.' },
      { name: 'Kettlebell swing', sets: 4, repRange: [12, 12], rpe: 8, restSec: 75, kind: 'primary' },
      { name: 'Bulgarian split squat', sets: 3, repRange: [10, 10], perSide: true, rpe: 7, restSec: 60, kind: 'secondary', ladder: 'split_squat', note: 'Or step-up.' },
      { name: 'Push-up', sets: 3, repRange: [8, 30], rpe: 8, restSec: 90, kind: 'secondary', ladder: 'pushup', note: 'Max quality reps, minus 2.' },
      { name: 'Loaded carry', sets: 4, repRange: null, distanceM: 40, rpe: 8, restSec: 60, kind: 'accessory', note: 'Suitcase or farmer.' },
      { name: 'Turkish get-up', sets: 2, repRange: [3, 3], perSide: true, rpe: 7, restSec: 60, kind: 'finisher', note: 'Light.' },
    ],
  },

  upper_c: {
    id: 'upper_c',
    label: 'Upper C',
    focus: 'Delts, back, upper chest',
    cardio: '30 min Zone 2',
    cardioZone: 'zone2',
    mobilityMin: 30,
    note: 'The weak-point session. Side delts and lats build the silhouette.',
    exercises: [
      { name: 'Incline push-up', sets: 4, repRange: [8, 15], rpe: 8, restSec: 90, kind: 'primary', ladder: 'pushup', note: 'Lower surface than Monday.' },
      { name: 'Pull-up progression', sets: 4, repRange: [4, 8], rpe: 7, restSec: 120, kind: 'primary', ladder: 'pullup', note: 'Volume version.' },
      { name: 'Lateral raise', sets: 5, repRange: [12, 20], rpe: 9, restSec: 45, kind: 'accessory', priority: 2, ladder: 'lateral_raise', note: 'Myo-reps or drop sets.' },
      { name: 'Inverted row', sets: 4, repRange: [10, 15], rpe: 8, restSec: 60, kind: 'secondary', superset: true, note: 'Wide, high elbow.' },
      { name: 'Bench dip', sets: 3, repRange: [8, 12], rpe: 8, restSec: 60, kind: 'accessory', note: 'Or dips between chairs.' },
      { name: 'Biceps curl', sets: 3, repRange: [12, 12], rpe: 8, restSec: 45, kind: 'accessory', superset: true },
      { name: 'Serratus wall slide', sets: 3, repRange: [12, 12], rpe: 7, restSec: 30, kind: 'finisher' },
      { name: 'Neck isometrics', sets: 2, repRange: null, timeSec: [20, 20], rpe: 7, restSec: 30, kind: 'finisher', note: 'Plus grip work.' },
    ],
  },

  rest: {
    id: 'rest',
    label: 'Rest',
    focus: 'Recovery',
    cardio: '45–60 min long walk or easy swim',
    cardioZone: 'easy',
    mobilityMin: 30,
    exercises: [],
    note: 'No lifting. Recovery is when the adaptation actually happens.',
  },
};

/** Day of week → session. Index 0 is Sunday, matching `Date.getDay()`. */
export const WEEK: SessionId[] = [
  'rest', // Sun
  'upper_a', // Mon
  'lower_a', // Tue
  'upper_b', // Wed
  'conditioning', // Thu
  'power', // Fri
  'upper_c', // Sat
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Which session falls on a given date. */
export function sessionForDate(date: ISODate): ProgramSession {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return SESSIONS[WEEK[dow]!];
}

export function sessionById(id: string | null | undefined): ProgramSession | null {
  if (!id) return null;
  return (SESSIONS as Record<string, ProgramSession | undefined>)[id] ?? null;
}

/** Match a stored `workouts.session_type` label back to a programme session. */
export function sessionByLabel(label: string | null | undefined): ProgramSession | null {
  if (!label) return null;
  const l = label.trim().toLowerCase();
  return Object.values(SESSIONS).find((s) => s.label.toLowerCase() === l) ?? null;
}

// ---------------------------------------------------------------------------
// Conditioning — interval protocol by month
// ---------------------------------------------------------------------------

export interface IntervalBlock {
  fromMonth: number;
  toMonth: number | null;
  title: string;
  protocol: string;
  note?: string;
}

export const INTERVAL_BLOCKS: IntervalBlock[] = [
  { fromMonth: 1, toMonth: 3, title: 'Skipping ladder', protocol: '10 × (20 s skip / 60 s rest)', note: 'Weeks 1–2.' },
  { fromMonth: 1, toMonth: 3, title: 'Skipping ladder', protocol: '10 × (30 s / 60 s)', note: 'Weeks 3–4.' },
  { fromMonth: 1, toMonth: 3, title: 'Skipping ladder', protocol: '8 × (45 s / 60 s)', note: 'Weeks 5–8.' },
  { fromMonth: 1, toMonth: 3, title: 'Skipping ladder', protocol: '6 × (60 s / 60 s) + 3 × 30 s fast', note: 'Weeks 9–12.' },
  { fromMonth: 4, toMonth: 9, title: 'Hill sprints', protocol: '6 × 15 s uphill at 90%, walk down — build to 10 × 15 s', note: 'Hills first: far safer for hamstrings than flat sprints.' },
  { fromMonth: 10, toMonth: null, title: 'Flat sprints & VO₂', protocol: '6 × 30 s at 90% / 90 s rest, or Norwegian 4×4', note: '4 × 4 min at ~90% HRmax / 3 min easy.' },
];

/**
 * The interval protocol for a given week of the programme.
 *
 * Weeks 1–12 step through the skipping ladder; after that the block is chosen by
 * month. Returns null before the programme has a start date.
 */
export function intervalForWeek(weeksElapsed: number | null): IntervalBlock | null {
  if (weeksElapsed === null || weeksElapsed < 0) return null;
  const week = weeksElapsed + 1;
  if (week <= 2) return INTERVAL_BLOCKS[0]!;
  if (week <= 4) return INTERVAL_BLOCKS[1]!;
  if (week <= 8) return INTERVAL_BLOCKS[2]!;
  if (week <= 12) return INTERVAL_BLOCKS[3]!;
  const month = Math.floor(weeksElapsed / 4.345) + 1;
  if (month <= 9) return INTERVAL_BLOCKS[4]!;
  return INTERVAL_BLOCKS[5]!;
}

/**
 * Months 5–9 are the highest-risk window: deepest deficit, highest volume.
 * Deloads are not optional here.
 */
export function isHighRiskWindow(weeksElapsed: number | null): boolean {
  if (weeksElapsed === null) return false;
  const month = Math.floor(weeksElapsed / 4.345) + 1;
  return month >= 5 && month <= 9;
}

// ---------------------------------------------------------------------------
// Daily mobility
// ---------------------------------------------------------------------------

export interface MobilityDrill {
  name: string;
  seconds: number;
  /** The highest-value drills, called out in the source programme. */
  key?: boolean;
  note?: string;
}

export const MOBILITY: MobilityDrill[] = [
  { name: 'Neck CARs + chin tucks', seconds: 60 },
  { name: 'Thoracic extension over roller', seconds: 90, key: true, note: 'Highest-value drill.' },
  { name: 'Open book / thoracic rotation', seconds: 60 },
  { name: 'Wall slide (shoulder flexion)', seconds: 60 },
  { name: 'Shoulder dislocates (band/towel)', seconds: 60 },
  { name: 'Wrist rocks + finger extensions', seconds: 60 },
  { name: 'Elbow CARs + pronation/supination', seconds: 45 },
  { name: '90/90 hip switches', seconds: 90 },
  { name: 'Couch stretch / half-kneeling hip flexor', seconds: 90, note: 'Squeeze the glute.' },
  { name: 'Jefferson curl / seated hamstring (light)', seconds: 90 },
  { name: 'Adductor rock-back', seconds: 60 },
  { name: 'Glute figure-4 / pigeon', seconds: 90 },
  { name: 'Ankle knee-to-wall dorsiflexion', seconds: 60, key: true, note: 'Gates squat depth.' },
  { name: 'Toe/foot spreading + short-foot', seconds: 45 },
  { name: 'Deep squat hold', seconds: 90 },
];

/** Deload prescription, per the programme. */
export const DELOAD_PROTOCOL = [
  'Keep the same exercises and the same intensity.',
  'Halve the number of sets.',
  'Stop 4 reps from failure.',
  'Skip plyometrics entirely.',
  'Keep Zone 2 cardio and mobility as normal.',
  'Run it for 5–7 days.',
];

export const SAFETY_NOTE =
  'Sharp joint pain, nerve symptoms, chest pain or dizziness is a stop signal. Modify or see a physician — do not train through it.';
