import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useSaveProfile } from '../hooks/useProfile';
import { useDailyLogs } from '../hooks/useDailyLog';
import {
  DAY_LABELS,
  DELOAD_PROTOCOL,
  LADDERS,
  MOBILITY,
  PROGRAM_RULES,
  SAFETY_NOTE,
  SESSIONS,
  WEEK,
  intervalForWeek,
  isHighRiskWindow,
  sessionForDate,
  type LadderKey,
} from '../lib/program';
import { shortLabel, todayISO } from '../lib/dates';
import { programWeeksElapsed } from '../hooks/useProgram';

/**
 * The programme, as reference.
 *
 * Today answers "what am I doing now"; this screen answers everything else —
 * the shape of the week, how each movement gets harder, what a deload actually
 * means. Reference material, not a daily destination.
 */
export default function Program() {
  const { data: profile } = useProfile();
  const { data: logs } = useDailyLogs();
  const saveProfile = useSaveProfile();
  const [openLadder, setOpenLadder] = useState<LadderKey | null>(null);

  const weeks = programWeeksElapsed(profile, logs);
  const interval = intervalForWeek(weeks);
  const todaysId = sessionForDate(todayISO()).id;

  return (
    <div className="space-y-4 pt-1">
      <section className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">Hybrid Athletic</h2>
          {weeks !== null ? (
            <span className="chip bg-ink-700 text-slate-300">Week {weeks + 1}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs muted">
          Upper/Lower + Power. Home-first: pull-up bar, kettlebell, light dumbbells, bands,
          backpack, mat.
        </p>
        {profile?.program_start ? (
          <p className="mt-2 text-xs muted">Started {shortLabel(profile.program_start)}.</p>
        ) : (
          <button
            type="button"
            onClick={() => saveProfile.mutate({ program_start: todayISO() })}
            className="btn-ghost mt-3 w-full text-sm"
          >
            {saveProfile.isPending ? 'Saving…' : 'Start the programme today'}
          </button>
        )}
        {isHighRiskWindow(weeks) ? (
          <p className="mt-2 text-xs text-amber-300">
            Months 5–9 — the highest-risk window. Do not skip deloads here.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium muted">The week</h2>
        {WEEK.map((id, dow) => {
          const s = SESSIONS[id];
          const isToday = id === todaysId;
          return (
            <div
              key={dow}
              className={`rounded-xl px-3 py-2.5 ${
                isToday ? 'bg-accent/10 ring-1 ring-accent/40' : 'bg-ink-800 ring-1 ring-ink-700'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  <span className="mr-2 text-xs muted">{DAY_LABELS[dow]}</span>
                  {s.label}
                </span>
                <span className="shrink-0 text-xs muted">{s.focus}</span>
              </div>
              <p className="mt-0.5 text-xs muted">
                {s.cardio} · {s.mobilityMin} min mobility
              </p>
            </div>
          );
        })}
        <p className="px-1 pt-1 text-xs muted">
          Every day: {PROGRAM_RULES.STEPS_MIN.toLocaleString()}–
          {PROGRAM_RULES.STEPS_MAX.toLocaleString()} steps.
        </p>
      </section>

      <section className="card">
        <h2 className="font-medium">The two rules</h2>
        <ol className="mt-2 space-y-2 text-sm text-slate-300">
          <li>
            <span className="font-medium">Effort = RPE {PROGRAM_RULES.RPE_MIN}–
            {PROGRAM_RULES.RPE_MAX}.</span>{' '}
            Leave 1–3 reps in the tank. Only lateral raises, calves and small isolations go to
            RPE 9. You almost never train to failure.
          </li>
          <li>
            <span className="font-medium">Double progression.</span> Work at the bottom of the
            range, add reps weekly until you hit the top on <em>all</em> sets, then make it harder
            and start again. The app computes this per exercise from what you logged.
          </li>
        </ol>
        <p className="mt-2 text-xs muted">
          If nothing improves for {PROGRAM_RULES.STALL_WEEKS} weeks straight, that counts as a
          fatigue flag toward a deload — not a reason to try harder.
        </p>
      </section>

      {interval ? (
        <section className="card">
          <h2 className="font-medium">Thursday intervals</h2>
          <p className="mt-1 text-lg font-semibold">{interval.protocol}</p>
          <p className="mt-0.5 text-sm muted">{interval.title}</p>
          {interval.note ? <p className="mt-1 text-xs muted">{interval.note}</p> : null}
          <p className="mt-2 text-xs muted">
            Keep hard intervals to this one slot. Diet creates the fat-loss deficit — cardio builds
            the engine.
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium muted">Progression ladders</h2>
        {(Object.keys(LADDERS) as LadderKey[]).map((k) => {
          const l = LADDERS[k];
          const open = openLadder === k;
          return (
            <div key={k} className="card">
              <button
                type="button"
                onClick={() => setOpenLadder(open ? null : k)}
                aria-expanded={open}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium">{l.label}</span>
                <span className="text-xs muted">{open ? 'Hide' : `${l.steps.length} steps`}</span>
              </button>
              {open ? (
                <ol className="mt-2 space-y-1 border-t border-ink-700 pt-2">
                  {l.steps.map((step, i) => (
                    <li key={step} className="flex gap-2 text-sm text-slate-300">
                      <span className="w-4 shrink-0 text-xs muted tabular-nums">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2 className="font-medium">Daily mobility</h2>
        <p className="mt-1 text-xs muted">
          15 min every day, 30 min Thursday and Sunday. 30–60 s per position.
        </p>
        <ul className="mt-2 space-y-1">
          {MOBILITY.map((m) => (
            <li key={m.name} className="flex items-baseline gap-2 text-sm">
              <span className={m.key ? 'font-medium text-slate-100' : 'text-slate-300'}>
                {m.name}
              </span>
              <span className="ml-auto shrink-0 text-xs muted tabular-nums">{m.seconds}s</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="font-medium">Deload</h2>
        <p className="mt-1 text-xs muted">
          Every 6–8 weeks, or when three fatigue signs stack. Vector watches those signs for you and
          says so on Today.
        </p>
        <ul className="mt-2 space-y-1">
          {DELOAD_PROTOCOL.map((d) => (
            <li key={d} className="flex gap-2 text-sm text-slate-300">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs muted">
          Fatigue lets adaptation catch up — deloading is progress, not a step back.
        </p>
      </section>

      <section className="card border border-amber-500/30">
        <p className="text-sm text-amber-200">{SAFETY_NOTE}</p>
      </section>

      <Link to="/workout" className="btn-primary block w-full text-center">
        Log a session
      </Link>
    </div>
  );
}
