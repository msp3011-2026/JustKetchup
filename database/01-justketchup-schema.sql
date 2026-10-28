-- JustKetchup — schema for the invite link flow
-- Paste into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: everything uses "if not exists" / "or replace".

-- ---------------------------------------------------------------
-- 1. Neighborhoods — the unit of location for a city-specific app.
--    Coordinates let us compute a midpoint between two people.
--    This is the ONLY place data we store; actual venues come live
--    from Google Places so people can discover somewhere new.
-- ---------------------------------------------------------------
create table if not exists public.neighborhoods (
  id    uuid primary key default gen_random_uuid(),
  city  text not null,
  name  text not null,
  lat   double precision not null,
  lng   double precision not null,
  unique (city, name)
);

-- Where the app's own user lives, so we can compute the midpoint.
alter table public.users
  add column if not exists neighborhood_id uuid references public.neighborhoods(id);

-- ---------------------------------------------------------------
-- 2. contact_profiles — what we learn about Sarah once and never
--    ask again. She can still change it on any future invite.
--
--    NOTE: if you had the old web app's contact_profiles table
--    (keyed by phone), run 00-fix-contact-profiles.sql FIRST or
--    this section fails with "contact_id does not exist".
-- ---------------------------------------------------------------
create table if not exists public.contact_profiles (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  unique (contact_id)
);

alter table public.contact_profiles
  add column if not exists neighborhood_id   uuid references public.neighborhoods(id),
  add column if not exists dietary           text[] default '{}',
  add column if not exists cuisines          text[] default '{}',
  -- Carried over from the old schema — these were good ideas.
  -- Stored now, not yet surfaced in the invite page UI.
  add column if not exists avoid_cuisine     text[] default '{}',
  add column if not exists vibe              text[] default '{}',
  add column if not exists price_range       text,
  add column if not exists updated_at        timestamptz default now();

-- ---------------------------------------------------------------
-- 3. venue_cache — NOT a curated list. Just a copy of whatever
--    Google returned, so a page reload doesn't bill another
--    Places call and so confirmations can show a name later.
-- ---------------------------------------------------------------
create table if not exists public.venue_cache (
  place_id    text primary key,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  rating      double precision,
  reviews     int,
  price_level text,
  maps_uri    text,
  cached_at   timestamptz default now()
);

-- ---------------------------------------------------------------
-- 4. Invites — one per nudge sent. The token is the thing in
--    justketchup.at/<token>.
-- ---------------------------------------------------------------
create table if not exists public.invites (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique,
  user_id        uuid not null references public.users(id) on delete cascade,
  contact_id     uuid not null references public.contacts(id) on delete cascade,
  slots          jsonb not null default '[]'::jsonb,   -- [{start,end}] ISO strings
  status         text not null default 'sent',         -- sent | confirmed | expired
  chosen_slot    jsonb,
  responded_at   timestamptz,
  expires_at     timestamptz default (now() + interval '14 days'),
  created_at     timestamptz default now()
);

alter table public.invites
  add column if not exists chosen_place_id text references public.venue_cache(place_id);

create index if not exists invites_token_idx on public.invites(token);

-- ---------------------------------------------------------------
-- 5. RLS
--    The app user manages their own rows.
--    Sarah is never signed in — server routes use the service role
--    key and authorize by the unguessable token instead.
-- ---------------------------------------------------------------
alter table public.invites          enable row level security;
alter table public.contact_profiles enable row level security;
alter table public.neighborhoods    enable row level security;
alter table public.venue_cache      enable row level security;

drop policy if exists "invites_own" on public.invites;
create policy "invites_own" on public.invites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "contact_profiles_own" on public.contact_profiles;
create policy "contact_profiles_own" on public.contact_profiles
  for all using (
    exists (select 1 from public.contacts c
            where c.id = contact_profiles.contact_id and c.user_id = auth.uid())
  );

drop policy if exists "neighborhoods_read" on public.neighborhoods;
create policy "neighborhoods_read" on public.neighborhoods for select using (true);

drop policy if exists "venue_cache_read" on public.venue_cache;
create policy "venue_cache_read" on public.venue_cache for select using (true);
