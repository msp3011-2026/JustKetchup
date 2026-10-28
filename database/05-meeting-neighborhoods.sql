-- JustKetchup — the inviter chooses where they're happy to meet (28 Oct 2026)
-- Applied through the Supabase connector. Safe to re-run.
--
-- Replaces "find the midpoint between two homes": the app user picks the
-- neighborhoods they're open to meeting in; the friend picks one of those;
-- restaurants are searched inside that neighborhood.
alter table public.users
  add column if not exists meet_neighborhood_ids uuid[] not null default '{}';
