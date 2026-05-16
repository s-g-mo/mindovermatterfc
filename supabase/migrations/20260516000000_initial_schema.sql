-- Mind Over Matter FC — initial schema
-- game_stats: one row per individual match played (since 2024, granular tracking)
-- seasonal_stats: one row per season/organisation/game-type aggregate (since 2018)

-- ─────────────────────────────────────────
-- game_stats
-- ─────────────────────────────────────────
create table if not exists public.game_stats (
  id              bigint generated always as identity primary key,
  date            date        not null,
  season_code     text,
  season_name     text,
  year            integer,
  organization    text,
  game_type       text        not null,   -- '11v11' | '7v7' | '5v5'
  outcome         integer,                -- 1 = win, 0 = loss/draw
  goals           integer     not null default 0,
  goal_body_part  text,                   -- 'Foot' | 'Header' | etc.
  assists         integer,
  notes           text,
  youtube_url     text,                   -- link to match footage on YouTube
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- seasonal_stats
-- ─────────────────────────────────────────
create table if not exists public.seasonal_stats (
  id           bigint generated always as identity primary key,
  season_code  text,
  season_name  text,
  year         integer,
  organization text,
  game_type    text     not null,   -- '11v11' | '7v7' | '5v5' | '11v11/7v7'
  games_played integer  not null default 0,
  goals        integer  not null default 0,
  assists      numeric,             -- nullable; tracking started May 2023
  notes        text,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Row Level Security — public read, no public write
-- ─────────────────────────────────────────
alter table public.game_stats    enable row level security;
alter table public.seasonal_stats enable row level security;

create policy "Public read access"
  on public.game_stats for select using (true);

create policy "Public read access"
  on public.seasonal_stats for select using (true);
