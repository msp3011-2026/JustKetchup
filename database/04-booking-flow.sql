-- JustKetchup — book-it-yourself-with-ChatGPT flow (28 Oct 2026)
-- Applied to the live database through the Supabase connector. Safe to re-run.
--
-- Invite status now runs:
--   sent       -> friend has the link
--   booking    -> friend picked a time + food + gave email; shortlist ready;
--                 inviter has been notified to book
--   confirmed  -> table booked (chosen_place_id set); friend's calendar invite updated
--   expired

-- Where to send the inviter's push notifications (Expo push token).
alter table public.users add column if not exists push_token text;

-- The friend's email: required so Google can send them the calendar invite
-- and the reservation details. Saved on their profile so they aren't asked twice.
alter table public.contact_profiles add column if not exists email text;
alter table public.invites add column if not exists friend_email text;

-- The 3-4 places, best first, that the inviter will try to book.
alter table public.invites add column if not exists shortlist jsonb;
alter table public.invites add column if not exists booked_at timestamptz;
