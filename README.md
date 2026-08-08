# Vector — physique progress PWA

A personal, installable PWA that tracks a strength/physique transformation and
runs the decision logic that turns daily data into one concrete instruction:
*continue · adjust calories · take a diet break · deload · advance phase.*

It is a decision engine, not a logbook. Daily entry takes under 30 seconds, the
7-day trend is the headline (never the raw daily weight), and every verdict shows
the numbers behind it.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in the two values below
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build (emits the service worker) |
| `npm run preview` | Serve the built app — needed to exercise the PWA/offline behaviour |
| `npm test` | Vitest suite for `src/lib` |
| `npm run lint` | `tsc -b --noEmit` |

The service worker is disabled in dev. To test install/offline, run
`npm run build && npm run preview`.

---

## Environment

**Nothing is required to run this app.** The Supabase URL and publishable key are
baked into `src/lib/supabase.ts` as defaults, so a clone builds and runs with no
setup at all.

That is a deliberate trade-off. Vite inlines `import.meta.env.*` at build time, so
an unset or wrongly-scoped variable yields a bundle with no backend — a build that
succeeds and then boots to a setup card, with nothing in the logs to explain it.
For two values that are public by design, that failure mode costs more than the
configurability is worth.

To point a fork at a different project, set either variable and it wins over the
default:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable or anon key>
```

Find them in **Supabase → Project Settings → API**. Note that Vite reads `.env` —
**not** `.env.example`, which is documentation only.

The publishable key is safe in the bundle **only because row-level security stands
behind it** — every table restricts access to `user_id = auth.uid()`. Anyone can
read it from the deployed JS either way; the Postgres policies are the security
boundary, not the secrecy of that string. Never put a service-role key or a
third-party API key in the frontend; those go in Edge Function secrets:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`.env` is gitignored.

---

## Backend setup (Supabase)

> **A project is already provisioned and migrated:** `Vector`, ref
> `esfxrnqwkulqhxwgyezb`, region `ap-south-1`. All nine tables, their RLS
> policies and the private photo bucket are live. Copy the URL and anon key from
> **Project Settings → API** into `.env` and skip to step 3.

To stand up a fresh one instead:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema — either link the CLI and push:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   or paste the files in `supabase/migrations/` into the SQL editor, in filename
   order, and run them.

   This creates all nine tables, their indexes, RLS policies on every one of them,
   the private `progress-photos` bucket with owner-only path policies, and a
   trigger that gives each new auth user a `profiles` row.
3. **Auth → URL Configuration**: set Site URL to your deployed origin and add
   `http://localhost:5173` to Redirect URLs so the emailed link works in dev.
4. Optional, for the emailed-code fallback: **Auth → Emails → Magic Link**, add
   `{{ .Token }}` to the template (see below).
5. Sign in — the first sign-in creates the user and profile row.

### Sign-in and the installed PWA

Sign-in is by **email and password**, with a 6-digit emailed code as the backup.
Password is the default because it needs no email round-trip and behaves
identically in a browser tab and an installed app.

The emailed *link* cannot sign you into an installed iOS PWA. Tapping it opens
Safari, which is a separate browsing context with its own storage, so the session
lands somewhere the app can never read it. PKCE makes it worse: the code verifier
is written by whichever context started the sign-in. A typed code has neither
problem, because the exchange happens inside the app.

For the code to appear in the email, the **Magic Link** template must include the
token. In **Supabase → Authentication → Emails → Magic Link**, add a line:

```html
<p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
```

Supabase's default template only has `{{ .ConfirmationURL }}`, so without this
edit no code is sent.

The password path needs no Supabase configuration at all. Change it from
**Settings → Password** at any time.

---

## Deploying (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new). `vercel.json`
   already sets the framework, build command, SPA rewrites and cache headers.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under
   **Settings → Environment Variables** (all environments).
3. Deploy, then add the production URL to Supabase's Site URL / Redirect URLs.
4. On the phone: open the URL in Safari or Chrome → Share → **Add to Home Screen**.

---

## Architecture

```
src/
  lib/
    config.ts          every threshold — the single source of truth
    analytics.ts       PURE: EMA, adaptive TDEE, readiness, aesthetics, compliance
    decisionEngine.ts  PURE: weekly / phase / deload / overreaching rules
    workouts.ts        PURE: PR detection, strength trend
    targets.ts         PURE: weight-derived calories, protein, rate bands
    exerciseLibrary.ts exercises by body part, equipment and movement pattern
    offlineQueue.ts    IndexedDB write queue + flush on reconnect
    supabase.ts  types.ts  dates.ts
  hooks/               React Query wrappers over the tables
  components/          presentational UI
  routes/              one file per screen
supabase/migrations/   schema + RLS + storage policies
tests/                 Vitest suite for lib/
```

**All decision logic lives in pure functions** in `analytics.ts` and
`decisionEngine.ts`. They take data and return a verdict; they touch no network,
no React, and no clock. That is what makes them testable, and they are the product.

**Server state is the source of truth.** Supabase holds the data, React Query
caches it, and IndexedDB holds only writes that have not landed yet. Saving a log
updates the cache immediately and queues the row, so the entry screen never blocks
on the network and nothing is lost when you log with one bar of signal.

---

## Wearables

A browser PWA **cannot** read Apple Health / HealthKit or watch data. That is an
OS restriction, not an engineering problem, and this app does not pretend
otherwise. RHR, HRV, sleep and steps are entered by hand — they are already on
screen in your watch app each morning, and the dials make it about 15 seconds.

See `PROGRESS.md` for the two future paths (Capacitor wrapper, or Apple Health XML
import) and the `lib/importers/` seam left for them.

---

## Testing

```bash
npm test
```

77 tests cover the pure layer, including all seven worked cases from the spec:
EMA smoothing across a gap, adaptive TDEE (≈2,575 kcal, and `null` below 10 intake
days), the four weekly cut branches, both phase transitions, deload flag counting
and the 42/56-day windows, the overreaching trigger, and the Adonis ratio — plus
PR detection, the strength-decline trend that feeds the overreaching rule, and
the weight-derived targets (which scale calories, protein and rate bands off
current bodyweight and measured expenditure rather than fixed constants).
