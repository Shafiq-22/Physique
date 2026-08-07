import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useActivePhase, useStartPhase } from '../hooks/usePhase';
import { useDailyLogs } from '../hooks/useDailyLog';
import { PHASE_TARGETS } from '../lib/config';
import { shortLabel } from '../lib/dates';
import type { PhaseType } from '../lib/types';

const PHASES: { key: PhaseType; label: string; blurb: string }[] = [
  { key: 'cut', label: 'Cut', blurb: 'Lose fat at 0.40–0.55 kg/week' },
  { key: 'maintain', label: 'Maintain', blurb: 'Hold weight steady' },
  { key: 'gain', label: 'Lean gain', blurb: 'Add 0.12–0.25 kg/week' },
  { key: 'mini_cut', label: 'Mini-cut', blurb: 'Short, sharper deficit' },
];

export default function Settings() {
  const { data: phase } = useActivePhase();
  const { data: logs } = useDailyLogs();
  const startPhase = useStartPhase();
  const [confirming, setConfirming] = useState<PhaseType | null>(null);

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify({ phase, logs }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pt-1">
      <section className="card">
        <h2 className="font-medium">Current phase</h2>
        {phase ? (
          <p className="mt-1 text-sm muted">
            {phase.phase_type.replace('_', ' ')} since {shortLabel(phase.start_date)} ·{' '}
            {phase.target_kcal} kcal · {phase.protein_g} g protein
          </p>
        ) : (
          <p className="mt-1 text-sm muted">No phase set. Verdicts need one.</p>
        )}

        <div className="mt-3 space-y-2">
          {PHASES.map((p) => {
            const active = phase?.phase_type === p.key;
            const isConfirming = confirming === p.key;
            return (
              <div key={p.key}>
                <button
                  type="button"
                  disabled={active || startPhase.isPending}
                  onClick={() => setConfirming(isConfirming ? null : p.key)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    active ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-ink-700'
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  {active ? <span className="ml-2 text-xs text-accent">current</span> : null}
                  <span className="block text-xs muted">{p.blurb}</span>
                </button>

                {isConfirming && !active ? (
                  <div className="mt-2 rounded-xl bg-ink-900 p-3">
                    <p className="text-sm text-slate-300">
                      Start a {p.label.toLowerCase()} phase at {PHASE_TARGETS[p.key].kcal} kcal and{' '}
                      {PHASE_TARGETS[p.key].protein_g} g protein? This closes the current phase.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        onClick={async () => {
                          await startPhase.mutateAsync({ phase_type: p.key });
                          setConfirming(null);
                        }}
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        className="btn-ghost flex-1"
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {startPhase.error ? (
          <p className="mt-2 text-sm text-danger">{(startPhase.error as Error).message}</p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="font-medium">Your data</h2>
        <p className="mt-1 text-sm muted">{logs?.length ?? 0} daily logs stored.</p>
        <button type="button" onClick={exportJson} className="btn-ghost mt-3 w-full">
          Export as JSON
        </button>
      </section>

      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className="btn-ghost w-full text-danger"
      >
        Sign out
      </button>
    </div>
  );
}
