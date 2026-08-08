import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotaryDial } from '../components/RotaryDial';
import { ScalePicker } from '../components/ScalePicker';
import { Toggle } from '../components/Toggle';
import { useDailyLogs, useSaveDailyLog } from '../hooks/useDailyLog';
import { useActivePhase } from '../hooks/usePhase';
import { PHASE_TARGETS } from '../lib/config';
import { shortLabel, todayISO } from '../lib/dates';
import type { DailyLog } from '../lib/types';

/**
 * The 30-second entry.
 *
 * Ordered by friction: the numbers already on the watch face first, then the
 * one-tap scales, then the toggles. Everything is optional — a day with only a
 * weight is a perfectly good day, and the analytics handle gaps by design.
 * Exact calorie entry sits behind a disclosure so the fast path stays fast.
 */
export default function Log() {
  const date = todayISO();
  const navigate = useNavigate();
  const { data: logs } = useDailyLogs();
  const { data: phase } = useActivePhase();
  const save = useSaveDailyLog();

  const existing = logs?.find((l) => l.log_date === date) ?? null;

  /** Yesterday's numbers become placeholders, so most days are a tap or two. */
  const previous = useMemo<DailyLog | null>(() => {
    const before = (logs ?? []).filter((l) => l.log_date < date);
    return before.length ? before[before.length - 1]! : null;
  }, [logs, date]);

  const [weight, setWeight] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [rhr, setRhr] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [caloriesOnTarget, setCaloriesOnTarget] = useState<boolean | null>(null);
  const [proteinHit, setProteinHit] = useState<boolean | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [coldHands, setColdHands] = useState<boolean | null>(null);
  const [foodThoughts, setFoodThoughts] = useState<boolean | null>(null);
  const [showExact, setShowExact] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hydrate from the cached row once it arrives, without clobbering live edits.
  useEffect(() => {
    if (!existing) return;
    setWeight((v) => (v === null ? existing.weight_kg : v));
    setSleep((v) => (v === null ? existing.sleep_hours : v));
    setRhr((v) => (v === null ? existing.resting_hr : v));
    setHrv((v) => (v === null ? existing.hrv_ms : v));
    setEnergy((v) => (v === null ? existing.energy_1_10 : v));
    setMood((v) => (v === null ? existing.mood_1_10 : v));
    setSteps((v) => (v === null ? existing.steps : v));
    setCaloriesOnTarget((v) => (v === null ? existing.calories_on_target : v));
    setProteinHit((v) => (v === null ? existing.protein_hit : v));
    setKcal((v) => (v === null ? existing.kcal_intake : v));
    setProtein((v) => (v === null ? existing.protein_g : v));
    setColdHands((v) => (v === null ? existing.cold_hands_feet : v));
    setFoodThoughts((v) => (v === null ? existing.intrusive_food_thoughts : v));
    if (existing.kcal_intake !== null) setShowExact(true);
  }, [existing]);

  const targetKcal = phase ? (phase.target_kcal ?? PHASE_TARGETS[phase.phase_type].kcal) : null;
  const targetProtein = phase
    ? (phase.protein_g ?? PHASE_TARGETS[phase.phase_type].protein_g)
    : null;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await save.mutateAsync({
      log_date: date,
      weight_kg: weight,
      sleep_hours: sleep,
      resting_hr: rhr,
      hrv_ms: hrv,
      energy_1_10: energy,
      mood_1_10: mood,
      steps,
      calories_on_target: caloriesOnTarget,
      protein_hit: proteinHit,
      kcal_intake: kcal,
      protein_g: protein,
      cold_hands_feet: coldHands ?? false,
      intrusive_food_thoughts: foodThoughts ?? false,
    });
    setSaved(true);
    setTimeout(() => navigate('/'), 450);
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      <p className="text-sm muted">{shortLabel(date)}</p>

      <RotaryDial
        label="Weight"
        unit="kg"
        value={weight}
        onChange={setWeight}
        step={0.1}
        decimals={1}
        min={30}
        max={250}
        placeholder={previous?.weight_kg ?? null}
        autoFocus
      />

      <RotaryDial
        label="Sleep"
        unit="hours"
        value={sleep}
        onChange={setSleep}
        step={0.25}
        decimals={2}
        min={0}
        max={16}
        placeholder={previous?.sleep_hours ?? null}
      />

      <RotaryDial
        label="Resting heart rate"
        unit="bpm"
        value={rhr}
        onChange={setRhr}
        step={1}
        decimals={0}
        min={30}
        max={120}
        placeholder={previous?.resting_hr ?? null}
      />

      <RotaryDial
        label="HRV"
        unit="ms"
        value={hrv}
        onChange={setHrv}
        step={1}
        decimals={0}
        min={5}
        max={250}
        placeholder={previous?.hrv_ms ?? null}
      />

      <ScalePicker label="Energy" value={energy} onChange={setEnergy} hint="1–10" />
      <ScalePicker label="Mood" value={mood} onChange={setMood} hint="1–10" />

      <RotaryDial
        label="Steps"
        value={steps}
        onChange={setSteps}
        step={500}
        decimals={0}
        min={0}
        max={80000}
        placeholder={previous?.steps ?? null}
      />

      <Toggle
        label="Calories on target"
        hint={targetKcal ? `${targetKcal} kcal` : undefined}
        value={caloriesOnTarget}
        onChange={setCaloriesOnTarget}
      />

      <Toggle
        label="Protein hit"
        hint={targetProtein ? `${targetProtein} g` : undefined}
        value={proteinHit}
        onChange={setProteinHit}
      />

      {showExact ? (
        <>
          <RotaryDial
            label="Exact intake"
            unit="kcal"
            value={kcal}
            onChange={setKcal}
            step={10}
            degreesPerStep={6}
            decimals={0}
            min={0}
            max={10000}
            placeholder={targetKcal}
          />
          <RotaryDial
            label="Exact protein"
            unit="g"
            value={protein}
            onChange={setProtein}
            step={5}
            decimals={0}
            min={0}
            max={500}
            placeholder={targetProtein}
          />
          <p className="px-1 text-xs muted">
            Logging exact intake on 10+ days lets the app learn your real TDEE.
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowExact(true)}
          className="w-full text-sm font-medium text-sky-300"
        >
          + Log exact calories instead
        </button>
      )}

      <details className="card">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          Anything off today?
        </summary>
        <p className="mt-1 text-xs muted">
          These two feed the overreaching check. They only matter during a deficit.
        </p>
        <div className="mt-3 space-y-3">
          <Toggle
            label="Cold hands or feet"
            value={coldHands}
            onChange={setColdHands}
            yesIsBad
          />
          <Toggle
            label="Intrusive food thoughts"
            value={foodThoughts}
            onChange={setFoodThoughts}
            yesIsBad
          />
        </div>
      </details>

      <button type="submit" disabled={save.isPending} className="btn-primary w-full">
        {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>

      <p className="pb-2 text-center text-xs muted">
        Saves instantly and syncs later — this works with no signal.
      </p>
    </form>
  );
}
