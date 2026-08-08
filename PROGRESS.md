# PROGRESS

Running log of what is built, what was decided, and what is deliberately left.

---

## Status

| Phase | State |
|---|---|
| 0 — Scaffold, auth, migrations, PWA | ✅ Built and deployed |
| 1 — MVP: weight trend + verdict | ✅ Built |
| 2 — Full daily log, readiness, adaptive TDEE | ✅ Built |
| 3 — Workouts + PR detection | ✅ Built |
| 4 — Measurements, photos, aesthetics | ✅ Built |
| 5 — Full engine + Weekly Review | ✅ Built |
| 6 — Weight-derived targets, rotary dials, exercise library | ✅ Built |

Live at `physique-green.vercel.app`, backed by Supabase project `Vector`
(`esfxrnqwkulqhxwgyezb`).

**Verified here:** `npm run build` passes (typecheck + bundle + service worker),
`npm test` passes 77/77, and every screen's components were rendered and driven
in a headless browser against mock data — including scripted drags, keypresses
and rapid input on the dial.

**Backend is live.** Supabase project `Vector` (ref `esfxrnqwkulqhxwgyezb`,
`ap-south-1`), migrated. Verified by querying `pg_class`: all nine tables have
`relrowsecurity = true` with one owner-only policy each. Security advisor: clean.

**Still unverified: sign-in and real sync.** This container's network policy
denies outbound HTTPS to `*.supabase.co` and `*.vercel.app` (403 at the gateway —
the MCP tools reach both over a different path, which is why migrations and
deploys work). No end-to-end auth, write round-trip, or photo upload has been
exercised from here.

---

## Weight-derived targets (Phase 6)

Nothing about the plan is a constant any more. `lib/targets.ts` derives:

- **Rate bands as % of bodyweight.** A 0.5 kg/week loss is gentle at 100 kg and
  aggressive at 60 kg; the rate that actually protects muscle is proportional.
  The percentages reproduce the blueprint's original kg figures at ~82 kg and
  then keep pace as the weight moves.
- **Calories as an offset from measured expenditure.** Target rate × 7,700 ÷ 7
  gives the daily deficit or surplus, applied to the adaptive TDEE (or Mifflin
  until that exists). Two people at the same weight with different metabolisms
  get different targets — which is the whole point of learning TDEE.
- **Protein as g/kg**, capped at 2.4 g/kg.
- A **`MIN_SAFE_KCAL` floor of 1,500**, whatever the arithmetic asks for.

`evaluateWeekly` now takes the derived band as an argument; the config constants
are only the fallback for before any weight is logged.

**A `recomp` phase was added** — holding scale weight while trading fat for
muscle. It is not a flavour of maintenance: it carries its own protein target
(2.2 g/kg) and is explicitly judged by the tape rather than the scale, so a
steady week returns "Weight steady — exactly right for a recomp." Needed a
migration, since the DB constraint only allowed four phase types.

**Height is now a real input** on the Settings screen, stored in `profiles`, and
waist-to-height reads it instead of the config constant.

---

## Input: rotary dial (Phase 6)

`RotaryDial` replaces the stepper for every numeric measurement. Three ways in,
because each is fastest for a different job: drag the ring for relative
adjustment, type in the centre when you know the number, tap ± for one exact
step. The drag tracks *accumulated angle*, not absolute position, so grabbing it
anywhere never jumps the value — it behaves like a jog wheel, and sub-step
rotation is carried rather than discarded so slow drags still register.

---

## Exercise library (Phase 6)

`lib/exerciseLibrary.ts` holds ~60 curated exercises indexed by body part,
equipment and movement pattern. Equipment is the load-bearing filter: the
question in the gym is rarely "what hits back" and almost always "what hits back
with what is in this room". The selection persists in localStorage, because your
gym changes far less often than your session does.

The workout screen uses it for a Browse picker, a typical-rep-range hint that
flags entries outside it, and a push/pull balance warning.

---

## Screen map

Four tabs, per the spec. Workout and Measure are entered from Today and Progress
rather than taking tab slots — they are weekly-or-less actions, and a tab bar
that needs a second row stops being a tab bar.

| Route | What it does |
|---|---|
| `/` Today | Trend, readiness, verdicts, learned TDEE, entry points |
| `/log` Log | The 30-second daily entry |
| `/workout` | Session logging with live PR badges |
| `/measure` | Tape, body fat, photos, benchmarks |
| `/progress` | Long trend, proportions, sparklines, photo compare, PRs |
| `/review` | Week aggregates, all verdicts, acknowledge-and-file |
| `/settings` | Phase, export, sign out |

---

## Decisions made without asking

**Compliance %** is not defined in the spec, so: the share of days that hit the
calorie target, over the same seven days as the trend delta. An explicit
`calories_on_target` toggle wins; failing that, exact `kcal_intake` within
±150 kcal of the phase target counts. Days with neither are excluded rather than
counted as failures — no calorie data is not evidence of a miss.

**The two calorie/protein toggles shipped in Phase 1**, ahead of the rest of the
daily fields. Phase 1's headline feature is the weekly verdict, and without
compliance data `evaluateWeekly` would take the adherence branch on every stall —
giving a confidently wrong instruction. Weight plus two taps is still well inside
the 30-second budget.

**All rate bands are now %BW** (Phase 6), resolving the original conflict between
§4.4 (which described the gain target as +0.15–0.25 %BW/week) and §7 config
(which gave `[0.12, 0.25]` kg). The spec's percentages won, and the kg constants
survive only as the pre-first-weigh-in fallback.

**Adaptive TDEE window is inclusive of both endpoints.** A change "over 14 days"
needs two samples 14 days apart, so a 14-day window spans 15 calendar days. The
rate divides by *actual* elapsed days between the EMA endpoints, which keeps the
estimate correct when logging is sparse. This reproduces the spec's worked
example exactly (2,300 intake, −0.50 kg → 2,575 kcal).

**Fatigue baselines exclude the window they judge.** `computePriorBaseline` builds
the 30-day RHR/HRV reference from the days *before* the evaluation window. Using a
trailing average that includes the elevated stretch lets a sustained elevation
quietly redefine "normal" and hides the exact signal the rule exists to catch —
with the naive version, RHR +6 for 8 days fails to fire.

**Deload flag 1 requires consecutive days** (the spec says so); flags 2, 3 and 5
count days within a 14-day window, since broken sleep and low mood do not arrive
in a tidy run.

**Readiness scores baseline as 0.75, not 1.0**, leaving headroom for a genuinely
good day, and drops components with missing inputs while renormalising the
remaining weights — so a morning without an HRV reading still scores. The curve
tunables live in `config.READINESS` alongside the spec's values.

**Adonis ratio rounds rather than truncates**: 120/84 = 1.4286 → **1.429**. The
spec quotes 1.428, which is the truncated form. The test asserts closeness to the
true value so both readings are satisfied.

**One active phase at a time**, enforced by a partial unique index
(`phases_one_active_per_user`), so starting a phase closes the previous one.

**Supabase URL and publishable key are baked into the source, not env-only.**
Vite inlines `import.meta.env.*` at build time, so an unset or wrongly-scoped
variable yields a bundle with no backend — a build that succeeds cleanly and then
boots to the setup card, with nothing in the logs pointing at the cause. This bit
the first Vercel deploy. Both values are public by design (the key is readable in
devtools on the deployed site regardless), and RLS is the actual security
boundary, so the configurability was not worth the silent-failure mode. Env vars
still take precedence when set.

**PR detection uses three criteria, and matches reps on the *exact* load.**
Total work (load × reps) beating the previous best, more reps at exactly this
load, or a heavier load than ever lifted. Volume alone misses real progress —
5 reps at 100 kg is a PR even though its volume trails 12 reps at 60 kg. The
exact-load match matters: comparing against "this load or heavier" flags 12 reps
at 40 kg as a record when 10 reps at 60 kg is already on file, which is strictly
easier work. A test caught this. A first-ever set is never a PR.

**Within a session, a later set must beat the earlier ones too.** Sets fold into
the running history as they are evaluated, so three sets over an old record
produce one or two badges rather than three.

**Workouts are not queued offline.** The daily log is a single-row upsert, which
the IndexedDB queue replays safely. A workout is many rows across two tables with
a foreign key between them, and replaying that correctly needs more than the
queue provides. The screen says so rather than silently losing a session.

**Recommendations are written only on acknowledgement.** The table is a record of
decisions taken, not a log of everything the engine ever computed. Filing a
deload is also what restarts the 42/56-day clock — that is the source for
`daysSinceLastDeload`, which was an open gap after Phase 1.

**`performanceDeclining` is now derived, not passed in.** `computeStrengthTrend`
compares the best set of each of the last three weeks; both recent weeks must sit
below the reference week. One bad session is noise; a two-week slide during a
deficit is the signal.

**The midpoint of a rate band comes from the unrounded percentages.**
`Math.round` breaks symmetry across zero (−20.5 → −20 but 20.5 → 21), so
computing the midpoint from the rounded kg band gave a symmetric maintain band a
phantom +5 kcal surplus. A test caught it.

**The dial reads its latest value from a ref, not the render closure.** Rapid
input — a held arrow key, fast ± taps, a quick spin — fires several times before
React re-renders, and a closure over `value` makes every one of them compute from
the same stale number. Ten rapid presses collapsed into one. Verified fixed by
driving it in a headless browser.

**Sign-in is email + password, with a typed code as the backup.** An emailed link cannot reach an
installed iOS PWA: tapping it opens Safari, a separate browsing context with its
own storage, so the session is created somewhere the app cannot read. PKCE
compounds it, since the code verifier belongs to whichever context began the
sign-in. A 6-digit code is exchanged inside the app, so both halves happen in the
same context. `autocomplete="one-time-code"` lets iOS offer it straight from Mail.

Password is the default: it needs no email round-trip and no Supabase
configuration, and behaves identically in a tab and an installed app. The code
path is kept for a forgotten password, and needs `{{ .Token }}` added to the
Supabase Magic Link email template — the default only carries the link.

Account passwords are **never stored in this repository**. The initial one was
set directly against `auth.users` with bcrypt via pgcrypto and communicated out
of band.

**The app reloads itself when a new service worker takes over.** With no address
bar, an installed PWA can otherwise sit on a stale build indefinitely — which
already happened once during setup.

**Chart colours are identity, not status.** The trend line is blue (`#3987e5`),
not the app's green accent — a green line would imply "good" regardless of what
the data says. Raw daily points are deliberately recessive gray behind it.

---

## Design rules being honoured

- The **7-day EMA is the headline** everywhere. Raw daily weight is one tap
  behind a "Show daily" toggle, rendered faint.
- **No streaks, badges, counters, or push nags.** Today's screen ends with
  "Logged for today. That is everything — close the app."
- **Every verdict card renders its rationale and snapshot.** The "Why?" control
  expands the exact numbers that fired the rule. High-severity verdicts open
  expanded by default.
- **Offline-first writes.** Saving updates the React Query cache immediately and
  queues the row in IndexedDB; the queue flushes on reconnect, on tab focus, and
  on sign-in. Repeated edits to the same day collapse to one row.

---

## Wearables — the honest position

A browser PWA cannot read HealthKit or Google Fit. No integration was attempted,
per the spec. RHR / HRV / sleep / steps are manual entry on the Log screen, with
yesterday's values as placeholders and steppers sized for one thumb.

Future options, **not built**:
1. Wrap with **Capacitor** for native HealthKit / Health Connect access.
2. Import an **Apple Health XML export** and parse it client-side.

A `src/lib/importers/` seam is reserved for option 2 — parsers there should return
`DailyLogInput[]` and go through the same queue as manual entry.

---

**`handle_new_user()` is not callable over REST.** Supabase's security advisor
flagged it: the function must be `SECURITY DEFINER` (it writes a profile row for a
user that does not exist yet), but PostgREST exposes every public function as an
RPC endpoint, so `anon` could have invoked a privileged function at
`/rest/v1/rpc/handle_new_user`. `EXECUTE` is now revoked from `public`, `anon` and
`authenticated`; the trigger still fires because triggers do not check EXECUTE.
The advisor is clean after the fix.

---

## Known gaps

- **Bundle is 938 KB (≈260 KB gzipped)**, mostly Recharts. Fine for a personal
  app on a home-screen icon; code-split the charts if it ever matters.
- **Settings edits height but not date of birth or sex.** Age still comes from
  `config.PROFILE.DOB`, which feeds the Mifflin fallback only — once adaptive
  TDEE kicks in it stops mattering.
- **The config thresholds are not editable in the UI.** They are all in
  `config.ts` as a single source of truth, but changing them needs a code edit.
- **CSV export is not implemented**; JSON is.
- **Workout and Measure are online-only** (see the decision above).
- **Overreaching only runs during `cut` / `mini_cut`.** That matches the
  blueprint, where it is a deficit safety net, but it means a hard gaining block
  gets no equivalent brake.
- **Photos are not compressed before upload.** A modern phone camera file is
  several MB and goes up as-is; a few hundred photos would start to matter on the
  free storage tier.
- **Nothing verifies the deployed app against the real backend.** This
  environment's network policy blocks `*.supabase.co` and `*.vercel.app`, so
  every UI check was done against mock data in a local headless browser. Sign-in,
  RLS behaviour under a real session, photo upload and signed URLs are unexercised
  by me.
