import { useMemo, useState } from 'react';
import { useSignedPhotoUrl } from '../hooks/usePhotos';
import { shortLabel } from '../lib/dates';
import type { Photo, Pose } from '../lib/types';

const POSES: Pose[] = ['front', 'side', 'back'];

/** One side of the comparison. Signs its own URL so each pane refreshes alone. */
function Pane({ photo, caption }: { photo: Photo | null; caption: string }) {
  const { data: url, isLoading } = useSignedPhotoUrl(photo?.storage_path ?? null);

  return (
    <figure className="min-w-0 flex-1">
      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700">
        {photo && url ? (
          <img src={url} alt={caption} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs muted">
            {!photo ? 'No photo for this pose' : isLoading ? 'Loading…' : 'Unavailable'}
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-center text-xs muted">{caption}</figcaption>
    </figure>
  );
}

/**
 * Side-by-side comparison of two dates.
 *
 * Photos are the slowest-moving and most honest signal in the whole app — the
 * scale lies for a week, the mirror lies daily, but eight weeks apart at the
 * same pose does not. Files stay private; each pane fetches a short-lived signed
 * URL rather than anything permanent.
 */
export function PhotoCompare({ photos }: { photos: Photo[] }) {
  const dates = useMemo(
    () => [...new Set(photos.map((p) => p.taken_on))].sort(),
    [photos],
  );

  const [pose, setPose] = useState<Pose>('front');
  const [leftDate, setLeftDate] = useState<string>('');
  const [rightDate, setRightDate] = useState<string>('');

  const left = leftDate || dates[0] || '';
  const right = rightDate || dates[dates.length - 1] || '';

  const find = (d: string): Photo | null =>
    photos.find((p) => p.taken_on === d && p.pose === pose) ?? null;

  if (dates.length === 0) {
    return (
      <section className="card">
        <h2 className="font-medium">Compare</h2>
        <p className="mt-1 text-sm muted">
          Add photos on two different dates to compare them side by side.
        </p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Photo comparison">
      <h2 className="font-medium">Compare</h2>

      <div className="mt-3 flex gap-2">
        {POSES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pose === p}
            onClick={() => setPose(p)}
            className={`h-9 flex-1 rounded-lg text-sm font-medium capitalize transition ${
              pose === p ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <DateSelect label="From" value={left} dates={dates} onChange={setLeftDate} />
        <DateSelect label="To" value={right} dates={dates} onChange={setRightDate} />
      </div>

      <div className="mt-3 flex gap-3">
        <Pane photo={find(left)} caption={left ? shortLabel(left) : '—'} />
        <Pane photo={find(right)} caption={right ? shortLabel(right) : '—'} />
      </div>
    </section>
  );
}

function DateSelect({
  label,
  value,
  dates,
  onChange,
}: {
  label: string;
  value: string;
  dates: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1 text-xs muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-ink-900 px-2 py-2 text-sm text-slate-100 ring-1 ring-ink-700"
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {shortLabel(d)}
          </option>
        ))}
      </select>
    </label>
  );
}
