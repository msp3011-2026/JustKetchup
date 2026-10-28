-- JustKetchup — Google Calendar connection (27 Oct 2026)
-- Applied to the live database through the Supabase connector.
-- Safe to re-run.

-- The Google refresh token lets the server read free/busy and add the
-- confirmed meetup to the user's calendar while the app is closed.
-- RLS is on with NO policies: only the service role (server routes) can
-- read or write it. It never reaches the app or the browser.
create table if not exists public.google_tokens (
  user_id        uuid primary key references public.users(id) on delete cascade,
  refresh_token  text not null,
  updated_at     timestamptz not null default now()
);
alter table public.google_tokens enable row level security;

-- The user's time zone, so suggested slots land at sensible local times.
alter table public.users
  add column if not exists timezone text default 'America/New_York';

-- Remember which calendar event belongs to an invite (for later edits/cancels).
alter table public.invites
  add column if not exists calendar_event_id text;
