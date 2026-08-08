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

Live at `physique-green.vercel.app`, backed by Supabase project `Vector`
(`esfxrnqwkulqhxwgyezb`).

**Verified here:** `npm run build` passes (typecheck + bundle + service worker),
`npm test` passes 45/45, and the Today/Log components were rendered in a headless
browser against mock data to check the chart, the verdict cards and the stepper.

**Backend is live.** Supabase project `Vector` (ref `esfxrnqwkulqhxwgyezb`,
`ap-south-1`) is created and migrated. Verified by querying `pg_class`: all nine
tables have `relrowsecurity = true` with one owner-only policy each. The security
advisor returns zero findings.

**Not deployed.** The Vercel token connected to this session lacks
project-creation permission (`403 forbidden`), so the frontend is not hosted yet.
Nothing was created there. Import the repo at
[vercel.com/new](https://vercel.com/new) — `vercel.json` already carries the build
settings; add the two `VITE_` env vars in project settings.

**Still unverified: sign-in and real sync.** This container's network policy
denies outbound HTTPS to `*.supabase.co` (403 at the gateway — the MCP tools
reach Supabase over a different path, which is why the migrations applied), so no
end-to-end auth or write round-trip has been exercised from here.

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

**Gain-phase band uses kg, not %BW.** §4.4 describes the gain target as
+0.15–0.25 %BW/week while §7 config gives `[0.12, 0.25]` kg. Config wins, since it
is declared the single source of truth — and at ~82 kg the two are near-identical
(0.15–0.25 %BW = 0.123–0.205 kg). The rate is *also* expressed as %BW in the
verdict rationale whenever bodyweight is known.

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
- **Settings does not edit profile anthropometrics or the config thresholds** —
  it sets the phase, exports JSON, and signs out. Height falls back to
  `config.PROFILE.HEIGHT_CM`, so a fork with a different height must edit config.
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
