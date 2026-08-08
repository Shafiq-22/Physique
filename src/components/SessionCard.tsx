import { Link } from 'react-router-dom';
import type { IntervalBlock, ProgramSession } from '../lib/program';
import { PROGRAM_RULES } from '../lib/program';

interface Props {
  session: ProgramSession;
  /** Already logged a workout today. */
  done: boolean;
  /** Thursday's protocol, when today is the conditioning day. */
  interval: IntervalBlock | null;
  weeksElapsed: number | null;
  highRisk: boolean;
}

const ZONE_HINT: Record<ProgramSession['cardioZone'], string> = {
  zone2: 'Conversational — you could talk but would rather not.',
  easy: 'Easy. Recovery, not training.',
  intervals: 'Hard. The only hard cardio slot in the week.',
  none: '',
};

/**
 * What today asks of you: the session, the cardio, the mobility block.
 *
 * The programme is a week-shaped thing, but the only question that matters each
 * morning is "what am I doing today" — so the week lives on the Programme screen
 * and this card answers just that one question.
 */
export function SessionCard({ session, done, interval, weeksElapsed, highRisk }: Props) {
  const lifting = session.exercises.length > 0 && session.id !== 'conditioning';

  return (
    <section className="card" aria-label="Today's session">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium muted">
            Today{weeksElapsed !== null ? ` · week ${weeksElapsed + 1}` : ''}
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold leading-tight">{session.label}</h2>
          <p className="text-sm muted">{session.focus}</p>
        </div>
        {done ? (
          <span className="chip shrink-0 bg-accent/15 text-accent">Logged</span>
        ) : session.id === 'rest' ? (
          <span className="chip shrink-0 bg-ink-700 text-slate-300">Rest</span>
        ) : null}
      </div>

      {session.note ? <p className="mt-2 text-xs muted">{session.note}</p> : null}

      <dl className="mt-3 space-y-1.5 border-t border-ink-700 pt-3 text-sm">
        <Row label="Cardio" value={session.cardio} hint={ZONE_HINT[session.cardioZone]} />
        {interval ? <Row label="Intervals" value={interval.protocol} hint={interval.note} /> : null}
        <Row label="Mobility" value={`${session.mobilityMin} min`} />
        <Row
          label="Steps"
          value={`${PROGRAM_RULES.STEPS_MIN.toLocaleString()}–${PROGRAM_RULES.STEPS_MAX.toLocaleString()}`}
        />
      </dl>

      {highRisk ? (
        <p className="mt-3 text-xs text-amber-300">
          Months 5–9: deepest deficit and highest volume at once. This is the window where skipped
          deloads turn into injuries.
        </p>
      ) : null}

      {lifting && !done ? (
        <Link to="/workout" className="btn-primary mt-3 block w-full text-center">
          Start {session.label}
        </Link>
      ) : null}

      {session.id === 'conditioning' && !done ? (
        <Link to="/workout" className="btn-ghost mt-3 block w-full text-center">
          Log the core circuit
        </Link>
      ) : null}
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1">
        <span className="text-slate-200">{value}</span>
        {hint ? <span className="block text-xs muted">{hint}</span> : null}
      </dd>
    </div>
  );
}
