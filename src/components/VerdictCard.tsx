import { useState } from 'react';
import type { Verdict } from '../lib/types';

const TONE: Record<Verdict['severity'], { ring: string; chip: string; label: string }> = {
  info: { ring: 'border-ink-700', chip: 'bg-sky-500/15 text-sky-300', label: 'On plan' },
  warn: { ring: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-300', label: 'Adjust' },
  high: { ring: 'border-danger/60', chip: 'bg-danger/20 text-danger', label: 'Act now' },
};

interface Props {
  verdict: Verdict;
  /** Rendered above the instruction, e.g. "This week". */
  eyebrow?: string;
  defaultOpen?: boolean;
}

/**
 * One instruction, plus the numbers that produced it.
 *
 * The rationale and snapshot are always reachable in one tap. Advice the user
 * cannot audit is advice they have to take on faith, which is the opposite of
 * what this app is for.
 */
export function VerdictCard({ verdict, eyebrow, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen || verdict.severity === 'high');
  const tone = TONE[verdict.severity];

  return (
    <section className={`card border ${tone.ring}`} aria-label="Recommendation">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs muted">{eyebrow ?? 'Recommendation'}</span>
        <span className={`chip ${tone.chip}`}>{tone.label}</span>
      </div>

      <p className="mt-2 text-lg font-semibold leading-snug">{verdict.verdict}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 text-sm font-medium text-sky-300"
      >
        {open ? 'Hide the numbers' : 'Why?'}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-ink-700 pt-3">
          <ul className="space-y-1.5">
            {verdict.rationale.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-slate-300">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {Object.entries(verdict.snapshot).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  {humanise(k)}
                </dt>
                {/* Never truncated: the numbers are the reason this card exists. */}
                <dd className="break-words text-sm tabular-nums text-slate-200">{format(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

const humanise = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const format = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) {
    // A two-number array is a target band ("-0.55 to -0.4"); anything else is a
    // plain list and must not be joined as if it were a range.
    return v.length === 2 && v.every((x) => typeof x === 'number')
      ? v.join(' to ')
      : v.map(String).join(', ');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
