-- Vector — initial schema.
--
-- Every table carries user_id and is protected by row-level security so the app
-- is multi-user-ready even though it has one user in practice. `profiles` is the
-- exception in shape only: its primary key *is* the auth user id.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  dob date,
  sex text default 'male',
  height_cm numeric default 180,
  created_at timestamptz default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_type text not null check (phase_type in ('cut','maintain','gain','mini_cut')),
  start_date date not null,
  end_date date,
  target_kcal integer,
  protein_g integer,
  target_weekly_change_kg numeric,
  notes text,
  created_at timestamptz default now()
);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric,
  resting_hr integer,
  hrv_ms integer,
  sleep_hours numeric,
  energy_1_10 integer,
  mood_1_10 integer,
  steps integer,
  kcal_intake integer,
  protein_g integer,
  calories_on_target boolean,
  protein_hit boolean,
  intrusive_food_thoughts boolean default false,
  cold_hands_feet boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, log_date)
);

create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  waist_cm numeric,
  chest_cm numeric,
  shoulders_cm numeric,
  arm_l_cm numeric,
  arm_r_cm numeric,
  forearm_cm numeric,
  neck_cm numeric,
  thigh_cm numeric,
  calf_cm numeric,
  hip_cm numeric,
  bodyfat_pct numeric,
  created_at timestamptz default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  session_type text,
  session_rpe integer,
  notes text
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_name text not null,
  set_index integer not null,
  load_kg numeric,
  leverage text,
  reps integer,
  rpe numeric,
  is_pr boolean default false
);

create table if not exists benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  metric text not null,
  value numeric not null
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  pose text check (pose in ('front','side','back')),
  storage_path text not null,
  created_at timestamptz default now()
);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_on date not null,
  scope text check (scope in ('weekly','monthly','deload','alert')),
  verdict text not null,
  rationale jsonb,
  data_snapshot jsonb,
  acknowledged boolean default false
);

-- ---------------------------------------------------------------------------
-- Indexes — every read is "my rows, newest first"
-- ---------------------------------------------------------------------------

create index if not exists daily_logs_user_date_idx on daily_logs (user_id, log_date desc);
create index if not exists measurements_user_date_idx on measurements (user_id, measured_on desc);
create index if not exists phases_user_start_idx on phases (user_id, start_date desc);
create index if not exists workouts_user_perf_idx on workouts (user_id, performed_at desc);
create index if not exists workout_sets_workout_idx on workout_sets (workout_id);
create index if not exists workout_sets_user_exercise_idx on workout_sets (user_id, exercise_name);
create index if not exists benchmarks_user_metric_idx on benchmarks (user_id, metric, measured_on desc);
create index if not exists photos_user_taken_idx on photos (user_id, taken_on desc);
create index if not exists recommendations_user_gen_idx on recommendations (user_id, generated_on desc);

-- Only one active phase at a time.
create unique index if not exists phases_one_active_per_user
  on phases (user_id) where end_date is null;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table phases enable row level security;
alter table daily_logs enable row level security;
alter table measurements enable row level security;
alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table benchmarks enable row level security;
alter table photos enable row level security;
alter table recommendations enable row level security;

-- profiles keys off `id` rather than `user_id`.
drop policy if exists "profiles are self-service" on profiles;
create policy "profiles are self-service" on profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'phases','daily_logs','measurements','workouts','workout_sets',
    'benchmarks','photos','recommendations'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_owner_all', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Profile bootstrap: every new auth user gets a profile row.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- This is a trigger function and must never be reachable through the REST API.
-- It has to run as SECURITY DEFINER (it writes a profile for a user that does not
-- exist yet), so leaving EXECUTE open would expose a privileged function at
-- /rest/v1/rpc/handle_new_user.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private photo storage. Files live at {user_id}/{yyyy-mm-dd}-{pose}.jpg and are
-- only ever served through short-lived signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "own progress photos" on storage.objects;
create policy "own progress photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
