/**
 * The diet plan, as data.
 *
 * Three meals, halal, whole-food, no protein powder. Fruit and nuts are folded
 * into meals rather than eaten as separate snacks.
 *
 * The reason this is worth modelling rather than printing: because the plan is
 * *fixed*, "did you eat meal 2 as planned?" is already a complete calorie log.
 * Three taps produce exact kcal and protein — which is what the adaptive TDEE
 * estimator has been waiting for, and it beats weighing food into a database
 * every day on both accuracy and effort.
 */

export type MealId = 'm1' | 'm2' | 'm3';

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealOption {
  id: string;
  label: string;
  /** The actual food, in the order you would assemble it. */
  items: string[];
  macros: Macros;
  /** Minutes of active cooking. Zero means grab-and-go. */
  cookMin: number;
  note?: string;
}

export interface Meal {
  id: MealId;
  label: string;
  time: string;
  role: string;
  /** First entry is the default; the rest are the rotation swaps. */
  options: MealOption[];
  /** What stays constant across every swap for this slot. */
  base?: string;
}

export const DAILY_TARGETS = {
  kcal: 2300,
  protein: 170,
  fat: 70,
  carbs: 250,
  fibreG: [32, 38] as [number, number],
  waterL: [3.5, 4.5] as [number, number],
  sodiumG: [3.5, 5] as [number, number],
} as const;

/**
 * Swaps are macro-equivalent by design — the plan rotates them precisely so the
 * numbers hold while the food changes. Where a swap genuinely shifts the split
 * (more fat, fewer carbs) the note says so.
 */
export const MEALS: Meal[] = [
  {
    id: 'm1',
    label: 'Breakfast',
    time: '06:00',
    role: 'No-cook, eaten before work',
    options: [
      {
        id: 'm1_default',
        label: 'Eggs + overnight oats',
        items: [
          '3 boiled eggs + 3 egg whites (boiled Sunday)',
          'Overnight oats: 50 g oats + 150 g Greek yoghurt + 10 g almonds/flax',
          '1 banana, sliced in',
        ],
        macros: { kcal: 750, protein: 55, fat: 30, carbs: 80 },
        cookMin: 0,
      },
      {
        id: 'm1_bowl',
        label: 'Yoghurt bowl',
        items: [
          '2 boiled eggs',
          'Large yoghurt–oat–nut–fruit bowl',
        ],
        macros: { kcal: 750, protein: 55, fat: 30, carbs: 80 },
        cookMin: 0,
        note: 'Fully no-cook.',
      },
      {
        id: 'm1_omelette',
        label: 'Omelette + toast',
        items: [
          '3-egg + 3-white omelette with onion, tomato, spinach (½ tsp oil)',
          '2 wholegrain toast',
          '150 g yoghurt',
        ],
        macros: { kcal: 750, protein: 55, fat: 30, carbs: 80 },
        cookMin: 5,
      },
    ],
  },
  {
    id: 'm2',
    label: 'Lunch',
    time: '13:00',
    role: 'Prepped Sunday, reheated at work',
    base: 'Rice + dal + kachumber salad + 1 tsp olive oil',
    options: [
      {
        id: 'm2_chicken',
        label: 'Grilled chicken',
        items: [
          '170 g grilled chicken breast (from the batch)',
          '250 g cooked rice',
          '150 g cooked dal (toor/masoor)',
          'Kachumber salad + 1 tsp olive oil',
        ],
        macros: { kcal: 770, protein: 64, fat: 13, carbs: 96 },
        cookMin: 2,
      },
      {
        id: 'm2_tuna',
        label: 'Tinned tuna',
        items: ['Tinned tuna', '250 g cooked rice', '150 g dal', 'Kachumber + 1 tsp oil'],
        macros: { kcal: 770, protein: 64, fat: 13, carbs: 96 },
        cookMin: 0,
      },
      {
        id: 'm2_fish',
        label: 'Grilled fish',
        items: ['Grilled fish', '250 g cooked rice', '150 g dal', 'Kachumber + 1 tsp oil'],
        macros: { kcal: 770, protein: 64, fat: 13, carbs: 96 },
        cookMin: 10,
      },
      {
        id: 'm2_eggs',
        label: 'Eggs + extra dal',
        items: ['6 boiled eggs', '250 g cooked rice', 'Extra dal', 'Kachumber + 1 tsp oil'],
        macros: { kcal: 770, protein: 64, fat: 13, carbs: 96 },
        cookMin: 0,
      },
      {
        id: 'm2_paneer',
        label: 'Paneer',
        items: ['Paneer', '250 g cooked rice', '150 g dal', 'Kachumber + 1 tsp oil'],
        macros: { kcal: 770, protein: 64, fat: 13, carbs: 96 },
        cookMin: 5,
        note: 'Vegetarian option.',
      },
    ],
  },
  {
    id: 'm3',
    label: 'Dinner',
    time: '19:45',
    role: 'Post-training, 10-min cook',
    base: '3 wholewheat chapati + sautéed veg + 100 g curd',
    options: [
      {
        id: 'm3_fish',
        label: 'Grilled fish',
        items: [
          '200 g pan-grilled seer/tilapia, 1 tsp oil',
          '3 wholewheat chapati',
          'Sautéed cabbage/beans/spinach, 1 tsp oil',
          '100 g curd',
        ],
        macros: { kcal: 780, protein: 57, fat: 27, carbs: 69 },
        cookMin: 10,
      },
      {
        id: 'm3_tinned',
        label: 'Tinned mackerel / sardine',
        items: ['2 tins sardines or mackerel', '3 chapati', 'Sautéed veg', '100 g curd'],
        macros: { kcal: 780, protein: 57, fat: 27, carbs: 69 },
        cookMin: 5,
        note: 'Zero-cook protein.',
      },
      {
        id: 'm3_keema',
        label: 'Chicken keema',
        items: ['Chicken keema', '3 chapati', 'Sautéed veg', '100 g curd'],
        macros: { kcal: 780, protein: 57, fat: 27, carbs: 69 },
        cookMin: 7,
      },
      {
        id: 'm3_paneer',
        label: 'Paneer bhurji',
        items: ['Paneer bhurji', '3 chapati', 'Sautéed veg', '100 g curd'],
        macros: { kcal: 780, protein: 57, fat: 27, carbs: 69 },
        cookMin: 7,
        note: 'Vegetarian option.',
      },
      {
        id: 'm3_eggcurry',
        label: 'Egg curry',
        items: ['Egg curry (4 eggs)', '3 chapati', 'Sautéed veg', '100 g curd'],
        macros: { kcal: 780, protein: 57, fat: 27, carbs: 69 },
        cookMin: 10,
      },
    ],
  },
];

export const CARB_SWAPS =
  '250 g rice ↔ 3–4 chapati ↔ 250 g boiled potato or sweet potato. Any fast green counts as veg — frozen steam-in-bag is fine.';

// ---------------------------------------------------------------------------
// What was actually eaten
// ---------------------------------------------------------------------------

/** Per-meal record stored on the daily log. */
export interface MealEntry {
  eaten: boolean;
  /** Which option, when it was not the default. */
  optionId?: string;
}

export type MealSelection = Partial<Record<MealId, MealEntry>>;

const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export function findMeal(id: MealId): Meal | null {
  return MEALS.find((m) => m.id === id) ?? null;
}

export function findOption(mealId: MealId, optionId?: string): MealOption | null {
  const meal = findMeal(mealId);
  if (!meal) return null;
  if (!optionId) return meal.options[0] ?? null;
  return meal.options.find((o) => o.id === optionId) ?? meal.options[0] ?? null;
}

/**
 * Macros for what was actually eaten.
 *
 * Only meals ticked as eaten count. A skipped meal is a real deficit and should
 * show as one — silently assuming the full plan would corrupt the TDEE estimate
 * that everything downstream depends on.
 */
export function totalsFor(selection: MealSelection): Macros & { mealsEaten: number } {
  let out = { ...ZERO };
  let mealsEaten = 0;

  for (const meal of MEALS) {
    const entry = selection[meal.id];
    if (!entry?.eaten) continue;
    const option = findOption(meal.id, entry.optionId);
    if (!option) continue;
    mealsEaten++;
    out = {
      kcal: out.kcal + option.macros.kcal,
      protein: out.protein + option.macros.protein,
      fat: out.fat + option.macros.fat,
      carbs: out.carbs + option.macros.carbs,
    };
  }

  return { ...out, mealsEaten };
}

/** The plan eaten in full — the reference every day is measured against. */
export function planTotals(): Macros {
  return totalsFor({
    m1: { eaten: true },
    m2: { eaten: true },
    m3: { eaten: true },
  });
}

// ---------------------------------------------------------------------------
// The adjustment lever
// ---------------------------------------------------------------------------

export interface FoodAction {
  /** Roughly how many kcal this moves, signed. */
  deltaKcal: number;
  action: string;
}

/**
 * Translate a decision-engine verdict into this plan's food.
 *
 * "Add 200 kcal" is not an instruction you can act on at 19:45 — "add a fourth
 * chapati" is. The engine decides the direction and size; this maps it onto the
 * levers the plan actually has, which is the whole point of the diet document's
 * adjustment section.
 */
export function foodActionsFor(verdictCode: string): FoodAction[] {
  switch (verdictCode) {
    case 'losing_too_fast':
      return [
        { deltaKcal: 120, action: 'Add a 4th chapati at dinner.' },
        { deltaKcal: 115, action: 'Add 30 g oats at breakfast.' },
      ];
    case 'stall':
      return [
        { deltaKcal: -120, action: 'Drop the olive oil to none.' },
        { deltaKcal: -65, action: 'Trim lunch rice from 250 g to 200 g.' },
        { deltaKcal: 0, action: 'Or leave the food alone and add 1,500 steps.' },
      ];
    case 'gain_too_slow':
      return [
        { deltaKcal: 130, action: 'Add 100 g rice at lunch.' },
        { deltaKcal: 120, action: 'Add a chapati at dinner.' },
      ];
    case 'gain_too_fast':
      return [
        { deltaKcal: -130, action: 'Cut lunch rice back by 100 g.' },
        { deltaKcal: -120, action: 'Drop one chapati at dinner.' },
      ];
    case 'maintain_drift':
      return [
        { deltaKcal: 0, action: 'Re-weigh your rice and measure the cooking oil for a week.' },
      ];
    default:
      return [];
  }
}

/** The two places calories hide in this plan. */
export const CALORIE_TRAPS = [
  'Cooking oil — measure it with a spoon. Eyeballing hides 300+ kcal a day.',
  'Rice portions — weigh it cooked for the first 4 weeks, until your eye calibrates.',
];

// ---------------------------------------------------------------------------
// Prep
// ---------------------------------------------------------------------------

export interface PrepTask {
  task: string;
  detail?: string;
}

/** Sunday, ~45 minutes and mostly hands-off. */
export const PREP_SUNDAY: PrepTask[] = [
  { task: 'Boil 12–15 eggs', detail: 'Covers about four breakfasts.' },
  { task: 'Grill ~1.3 kg chicken breast', detail: 'Slice and portion into 6–7 tubs of ~170 g.' },
  { task: 'Cook a big pot of dal', detail: 'Fridge, or freeze half. Reheats all week.' },
  { task: 'Rice', detail: 'Batch-cook 4–5 portions, or run the cooker fresh each evening.' },
  { task: 'Wash and chop salad veg, bag the greens' },
  { task: 'Make 4 jars of overnight oats' },
];

/** Wednesday, ~10 minutes. Chicken keeps best 3–4 days. */
export const PREP_WEDNESDAY: PrepTask[] = [
  { task: 'Re-boil eggs if low' },
  { task: 'Grill a fresh batch of chicken, or thaw fish for the back half of the week' },
];

export const WEEKDAY_COOKING =
  'Breakfast 0 min · lunch 2-min reheat · dinner 10 min.';

export const QUICK_COOK: { protein: string; method: string; time: string }[] = [
  { protein: 'Eggs', method: 'Boil ahead', time: '0 min on the day' },
  { protein: 'Chicken breast', method: 'Batch grill / Foreman', time: '~12 min for a week' },
  { protein: 'Tinned fish', method: 'Open', time: '0 min' },
  { protein: 'Fish fillet', method: 'Pan-grill', time: '~10 min' },
  { protein: 'Paneer / keema', method: 'Quick pan', time: '~7 min' },
];

// ---------------------------------------------------------------------------
// Hydration & sodium — Dubai heat
// ---------------------------------------------------------------------------

export const HYDRATION = {
  targetL: DAILY_TARGETS.waterL,
  check: 'Urine pale straw by mid-morning means you are on track.',
  sodium:
    'Salt your food and add a pinch to the first glass of water. Heavy Gulf sweating drains sodium and causes cramps, headaches and flat workouts — this is correct even though it feels counter-intuitive.',
  potassium: 'Potassium comes free from the plan: banana, dal, curd, spinach, potato.',
} as const;

// ---------------------------------------------------------------------------
// Lean gain (≈ month 10)
// ---------------------------------------------------------------------------

export const LEAN_GAIN = {
  kcal: 3050,
  protein: 165,
  carbs: 375,
  note: 'Same three meals, same structure. Protein stays roughly the same; carbs do the building.',
  additions: [
    '+100 g rice at lunch',
    '+1 chapati at dinner',
    '+30 g oats at breakfast',
    'A second fruit at breakfast',
  ],
} as const;

export const DIET_DISCLAIMER =
  'This plan assumes no food allergies or medical dietary restrictions. Adjust the swaps if you have any.';
