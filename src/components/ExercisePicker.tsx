import { useMemo, useState } from 'react';
import {
  BODY_PARTS,
  EQUIPMENT,
  filterExercises,
  type BodyPart,
  type Equipment,
  type Exercise,
} from '../lib/exerciseLibrary';

interface Props {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  /** Equipment the user last filtered by, so the choice persists across sessions. */
  equipment: Equipment[];
  onEquipmentChange: (next: Equipment[]) => void;
}

/**
 * Pick an exercise by body part and by what is actually available.
 *
 * Equipment is the load-bearing filter: the question in the gym is rarely "what
 * hits back" and almost always "what hits back with what is in this room". The
 * selection is remembered, because it changes when your gym does — not per set.
 */
export function ExercisePicker({ onPick, onClose, equipment, onEquipmentChange }: Props) {
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [query, setQuery] = useState('');
  const [compoundOnly, setCompoundOnly] = useState(false);

  const results = useMemo(
    () => filterExercises({ bodyPart, equipment, query, compoundOnly }),
    [bodyPart, equipment, query, compoundOnly],
  );

  const toggleEquipment = (k: Equipment): void => {
    onEquipmentChange(
      equipment.includes(k) ? equipment.filter((x) => x !== k) : [...equipment, k],
    );
  };

  return (
    // Fully opaque: at 98% the page beneath still bled through the long list.
    <div className="fixed inset-0 z-30 flex flex-col bg-ink-900">
      <div
        className="flex items-center justify-between border-b border-ink-700 px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <h2 className="text-lg font-semibold">Choose exercise</h2>
        <button type="button" onClick={onClose} className="chip bg-ink-700 text-slate-300">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search exercises"
          className="w-full rounded-xl bg-ink-800 px-3 py-2.5 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
        />

        <div>
          <p className="mb-1.5 text-xs muted">Body part</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={bodyPart === null} onClick={() => setBodyPart(null)}>
              All
            </Chip>
            {BODY_PARTS.map((b) => (
              <Chip
                key={b.key}
                active={bodyPart === b.key}
                onClick={() => setBodyPart(bodyPart === b.key ? null : b.key)}
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs muted">
            What you have {equipment.length === 0 ? '· showing everything' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map((e) => (
              <Chip
                key={e.key}
                active={equipment.includes(e.key)}
                onClick={() => toggleEquipment(e.key)}
              >
                {e.label}
              </Chip>
            ))}
          </div>
        </div>

        <Chip active={compoundOnly} onClick={() => setCompoundOnly((v) => !v)}>
          Compounds only
        </Chip>

        <p className="pt-1 text-xs muted">
          {results.length} exercise{results.length === 1 ? '' : 's'}
        </p>

        <ul className="space-y-2 pb-6">
          {results.map((e) => (
            <li key={e.name}>
              <button
                type="button"
                onClick={() => onPick(e)}
                className="w-full rounded-xl bg-ink-800 px-3 py-3 text-left ring-1 ring-ink-700 transition active:scale-[0.99]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{e.name}</span>
                  <span className="shrink-0 text-xs muted tabular-nums">
                    {e.repRange[0] === e.repRange[1]
                      ? 'timed'
                      : `${e.repRange[0]}–${e.repRange[1]} reps`}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {e.compound ? (
                    <span className="chip bg-accent/15 text-accent">compound</span>
                  ) : null}
                  {e.equipment.map((k) => (
                    <span key={k} className="chip bg-ink-700 text-slate-400">
                      {EQUIPMENT.find((x) => x.key === k)?.label ?? k}
                    </span>
                  ))}
                </div>
                {e.note ? <p className="mt-1 text-xs muted">{e.note}</p> : null}
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="card">
              <p className="text-sm muted">
                Nothing matches. Try removing an equipment filter — or just type the exercise name
                directly into the set.
              </p>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-accent text-ink-900' : 'bg-ink-700 text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}
