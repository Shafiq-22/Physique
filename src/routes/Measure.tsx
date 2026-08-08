import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NumberStepper } from '../components/NumberStepper';
import { useMeasurements, useSaveMeasurement, useSaveBenchmark } from '../hooks/useMeasurements';
import { useUploadPhoto } from '../hooks/usePhotos';
import { shortLabel, todayISO } from '../lib/dates';
import type { Measurement, Pose } from '../lib/types';

/** Waist leads: it is the master metric for both phase transitions and the Adonis ratio. */
const FIELDS: { key: keyof Measurement; label: string }[] = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'arm_l_cm', label: 'Arm (left)' },
  { key: 'arm_r_cm', label: 'Arm (right)' },
  { key: 'forearm_cm', label: 'Forearm' },
  { key: 'neck_cm', label: 'Neck' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'calf_cm', label: 'Calf' },
  { key: 'hip_cm', label: 'Hip' },
];

const BENCHMARKS: { metric: string; label: string; unit: string }[] = [
  { metric: 'pushups_max', label: 'Push-ups (max)', unit: 'reps' },
  { metric: 'pullups_max', label: 'Pull-ups (max)', unit: 'reps' },
  { metric: 'plank_sec', label: 'Plank', unit: 'sec' },
  { metric: 'deadhang_sec', label: 'Dead hang', unit: 'sec' },
  { metric: 'hollow_sec', label: 'Hollow hold', unit: 'sec' },
  { metric: 'run_5k_sec', label: '5k run', unit: 'sec' },
];

const POSES: Pose[] = ['front', 'side', 'back'];

export default function Measure() {
  const navigate = useNavigate();
  const date = todayISO();
  const { data: measurements } = useMeasurements();
  const saveMeasurement = useSaveMeasurement();
  const saveBenchmark = useSaveBenchmark();
  const uploadPhoto = useUploadPhoto();

  const [values, setValues] = useState<Record<string, number | null>>({});
  const [bodyfat, setBodyfat] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState<{ metric: string; value: number | null }>({
    metric: BENCHMARKS[0]!.metric,
    value: null,
  });

  /** Last tape reading becomes the placeholder — most numbers barely move week to week. */
  const previous = useMemo<Measurement | null>(() => {
    const before = (measurements ?? []).filter((m) => m.measured_on <= date);
    return before.length ? before[before.length - 1]! : null;
  }, [measurements, date]);

  const todayRow = useMemo(
    () => (measurements ?? []).find((m) => m.measured_on === date) ?? null,
    [measurements, date],
  );

  useEffect(() => {
    if (!todayRow) return;
    setValues((v) => {
      if (Object.keys(v).length > 0) return v;
      const next: Record<string, number | null> = {};
      for (const f of FIELDS) next[f.key as string] = todayRow[f.key] as number | null;
      return next;
    });
    setBodyfat((b) => (b === null ? todayRow.bodyfat_pct : b));
  }, [todayRow]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await saveMeasurement.mutateAsync({
      measured_on: date,
      ...(values as Partial<Measurement>),
      bodyfat_pct: bodyfat,
    });
    navigate('/progress');
  };

  return (
    <div className="space-y-4 pt-1">
      <p className="text-sm muted">{shortLabel(date)}</p>

      <form onSubmit={submit} className="space-y-4">
        {FIELDS.map((f) => (
          <NumberStepper
            key={f.key as string}
            label={f.label}
            unit="cm"
            value={values[f.key as string] ?? null}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key as string]: v }))}
            step={0.1}
            coarseStep={0.5}
            decimals={1}
            min={10}
            max={250}
            placeholder={(previous?.[f.key] as number | null) ?? null}
          />
        ))}

        <NumberStepper
          label="Body fat"
          unit="%"
          value={bodyfat}
          onChange={setBodyfat}
          step={0.1}
          coarseStep={0.5}
          decimals={1}
          min={3}
          max={60}
          placeholder={previous?.bodyfat_pct ?? null}
        />

        <button type="submit" disabled={saveMeasurement.isPending} className="btn-primary w-full">
          {saveMeasurement.isPending ? 'Saving…' : 'Save measurements'}
        </button>
      </form>

      <section className="card">
        <h2 className="font-medium">Photos</h2>
        <p className="mt-1 text-xs muted">
          Private to your account. Stored in a locked bucket and only ever shown through a
          short-lived signed link.
        </p>
        <div className="mt-3 flex gap-2">
          {POSES.map((pose) => (
            <label
              key={pose}
              className="flex-1 cursor-pointer rounded-xl bg-ink-700 py-3 text-center text-sm font-medium capitalize"
            >
              {pose}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPhoto.mutateAsync({ file, taken_on: date, pose });
                  e.target.value = '';
                }}
              />
            </label>
          ))}
        </div>
        {uploadPhoto.isPending ? <p className="mt-2 text-xs muted">Uploading…</p> : null}
        {uploadPhoto.isSuccess ? <p className="mt-2 text-xs text-accent">Photo saved.</p> : null}
        {uploadPhoto.error ? (
          <p className="mt-2 text-xs text-danger">{(uploadPhoto.error as Error).message}</p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="font-medium">Benchmark test</h2>
        <p className="mt-1 text-xs muted">Monthly capability checks.</p>
        <select
          value={benchmark.metric}
          onChange={(e) => setBenchmark((b) => ({ ...b, metric: e.target.value }))}
          className="mt-3 w-full rounded-xl bg-ink-900 px-3 py-2.5 text-slate-100 ring-1 ring-ink-700"
        >
          {BENCHMARKS.map((b) => (
            <option key={b.metric} value={b.metric}>
              {b.label} ({b.unit})
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={benchmark.value ?? ''}
            onChange={(e) =>
              setBenchmark((b) => ({
                ...b,
                value: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder="Result"
            aria-label="Benchmark result"
            className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 text-center text-lg font-semibold tabular-nums outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
          />
          <button
            type="button"
            disabled={benchmark.value === null || saveBenchmark.isPending}
            onClick={async () => {
              if (benchmark.value === null) return;
              await saveBenchmark.mutateAsync({
                measured_on: date,
                metric: benchmark.metric,
                value: benchmark.value,
              });
              setBenchmark((b) => ({ ...b, value: null }));
            }}
            className="btn-ghost"
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
