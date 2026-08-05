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

Two variables, both client-side and both publishable:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Find them in **Supabase → Project Settings → API**. Without them the app renders a
setup card rather than failing blank.

The anon key is safe in the bundle **only because row-level security stands behind
it** — every table restricts access to `user_id = auth.uid()`. Never put a
service-role key or a third-party API key in `.env`; those go in Edge Function
secrets:

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

   or paste `supabase/migrations/20260804000000_init.sql` into the SQL editor and run it.

   This creates all nine tables, their indexes, RLS policies on every one of them,
   the private `progress-photos` bucket with owner-only path policies, and a
   trigger that gives each new auth user a `profiles` row.
3. **Auth → URL Configuration**: set Site URL to your deployed origin and add
   `http://localhost:5173` to Redirect URLs so magic links work in dev.
4. Sign in with your email — the link creates the user and the profile row.

Sign-in is a passwordless magic link, so no password is ever stored or typed.

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
screen in your watch app each morning, and the steppers make it about 15 seconds.

See `PROGRESS.md` for the two future paths (Capacitor wrapper, or Apple Health XML
import) and the `lib/importers/` seam left for them.

---

## Testing

```bash
npm test
```

45 tests cover the pure layer, including all seven worked cases from the spec:
EMA smoothing across a gap, adaptive TDEE (≈2,575 kcal, and `null` below 10 intake
days), the four weekly cut branches, both phase transitions, deload flag counting
and the 42/56-day windows, the overreaching trigger, and the Adonis ratio.
