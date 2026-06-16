-- ===================================================================
-- Peak Dates — Supabase schema + Row Level Security
-- Run this in the Supabase SQL editor when you're ready to move off
-- local-first mode (see js/config.js → BACKEND = 'supabase').
-- ===================================================================

-- ── profiles ──────────────────────────────────────────────────────
create table if not exists profiles (
  id                   uuid primary key references auth.users on delete cascade,
  username             text,
  display_name         text,
  couple_name          text,                         -- e.g. "The Hendersons"
  partner_id           uuid references profiles(id),
  partner_invite_code  text unique,
  avatar_emoji         text default '🏔️',
  onboarded            boolean default false,
  created_at           timestamptz default now()
);

-- ── partner_surveys ───────────────────────────────────────────────
create table if not exists partner_surveys (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade,
  outdoorsy_score     int,    -- 1=cozy homebody, 10=summit-chaser
  activity_level      int,    -- 1=relaxed, 10=high-energy
  budget_range        int,    -- 1=budget, 10=splurge
  spontaneity         int,    -- 1=planner, 10=spontaneous
  social_vibe         int,    -- 1=just us, 10=love a crowd
  distance_tolerance  int,    -- 1=stay close, 10=road trip ready
  favorite_categories jsonb default '[]',
  dietary_notes       text,
  mobility_notes      text,
  has_car             boolean default true,
  location_pref       text default 'denver',  -- denver|south-denver|university|boulder|address
  distance_miles      int default 60,
  updated_at          timestamptz default now(),
  unique (user_id)
);

-- ── dates_catalog (public read) ───────────────────────────────────
create table if not exists dates_catalog (
  id              text primary key,
  title           text not null,
  description     text,
  category        text,
  subcategory     text,
  location_name   text,
  location_city   text,
  lat             double precision,
  lng             double precision,
  cost_tier       int,        -- 0=free,1=$,2=$$,3=$$$
  estimated_cost  text,
  duration_hours  numeric,
  difficulty      text,
  difficulty_score int,
  seasonal_tags   text[],
  time_sensitive  boolean default false,
  event_start     date,
  event_end       date,
  indoor_outdoor  text,
  distance_miles  int,
  transit         boolean default false,
  website_url     text,
  image_emoji     text,
  tags            text[],
  base_score      numeric default 5,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ── couple_dates (status + reviews) ───────────────────────────────
create table if not exists couple_dates (
  id                    uuid primary key default gen_random_uuid(),
  couple_id             text not null,            -- sorted concat of both profile ids
  date_catalog_id       text references dates_catalog(id),
  status                text,                     -- suggested|pinned|done|maybe|pass
  suggested_at          timestamptz default now(),
  pinned_at             timestamptz,
  completed_at          timestamptz,
  flagged_reason        text,
  review_vibe_rating    int,
  review_cost_vs_expect int,
  review_would_repeat   boolean,
  review_highlight      text,
  review_effort_rating  int,
  review_photo_url      text,
  review_submitted_at   timestamptz,
  unique (couple_id, date_catalog_id)
);

-- ── weekly_rotations ──────────────────────────────────────────────
create table if not exists weekly_rotations (
  id           uuid primary key default gen_random_uuid(),
  couple_id    text not null,
  week_start   date not null,
  date_ids     text[],
  generated_at timestamptz default now(),
  unique (couple_id, week_start)
);

-- ===================================================================
-- Row Level Security
-- ===================================================================
alter table profiles        enable row level security;
alter table partner_surveys enable row level security;
alter table dates_catalog   enable row level security;
alter table couple_dates    enable row level security;
alter table weekly_rotations enable row level security;

-- profiles: read your own + your partner's; write your own
create policy "profiles read self/partner" on profiles for select
  using (id = auth.uid() or partner_id = auth.uid());
create policy "profiles update self" on profiles for update using (id = auth.uid());
create policy "profiles insert self" on profiles for insert with check (id = auth.uid());

-- surveys: read self + partner's, write self
create policy "survey read self/partner" on partner_surveys for select
  using (user_id = auth.uid()
         or user_id in (select partner_id from profiles where id = auth.uid()));
create policy "survey write self" on partner_surveys for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- catalog: public read, no client writes
create policy "catalog public read" on dates_catalog for select using (true);

-- couple_dates + rotations: any member of the couple_id may read/write.
-- couple_id is the sorted concat of the two profile ids; membership is proven
-- by the uid appearing in that string.
create policy "couple_dates member rw" on couple_dates for all
  using (position(auth.uid()::text in couple_id) > 0)
  with check (position(auth.uid()::text in couple_id) > 0);

create policy "rotations member rw" on weekly_rotations for all
  using (position(auth.uid()::text in couple_id) > 0)
  with check (position(auth.uid()::text in couple_id) > 0);
