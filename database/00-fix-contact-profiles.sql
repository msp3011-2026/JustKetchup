-- JustKetchup — fix the leftover contact_profiles table
-- RUN THIS FIRST, BEFORE 01-justketchup-schema.sql
--
-- WHY: your database has a contact_profiles table from the old web app, keyed by
-- `phone` rather than `contact_id`. The new schema expects contact_id, so
-- "create table if not exists" skipped it and later statements failed with:
--   ERROR: 42703: column contact_profiles.contact_id does not exist
--
-- THIS DROPS THE TABLE. That is safe here and only here, because you confirmed
-- it has 0 rows. If you ever re-run this on a table with data, you will lose it.
--
-- Confirm it's still empty before running (should return 0):
--   select count(*) from public.contact_profiles;

drop table if exists public.contact_profiles cascade;

-- Recreated properly in 01-justketchup-schema.sql, keyed by contact_id.
--
-- Why contact_id and not phone: phone-keying would make one person's profile
-- global, so if another JustKetchup user added Sarah, their invite page would
-- prefill her neighborhood and dietary needs without Sarah ever telling them.
-- contact_id scopes the profile to the friendship it was shared in.
