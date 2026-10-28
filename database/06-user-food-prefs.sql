-- JustKetchup — your own food preferences, on your profile (28 Oct 2026)
-- Applied through the Supabase connector. Safe to re-run.
-- dietary: hard filter for every invite (combined with the friend's).
-- cuisines: used when the friend says "I don't mind".
alter table public.users add column if not exists dietary text[] not null default '{}';
alter table public.users add column if not exists cuisines text[] not null default '{}';
