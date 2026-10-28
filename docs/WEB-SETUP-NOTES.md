# JustKetchup invite page — step by step

I can't push to GitHub from here, so you'll copy files in by hand. It's repetitive
but not hard: 7 files, same 5 clicks each.

Everything below happens in a browser. Nothing in Terminal.

**Total time:** about 30 minutes.

> **Resolved:** the `contact_profiles` error is fixed. Part 2 now starts with
> `00-fix-contact-profiles.sql`, which drops the empty leftover table from the old
> web app. Run the three SQL files in numbered order.

---

## Part 1 — Get a Google Places API key (10 min)

The page finds restaurants live from Google, so it needs a key.

1. Go to **console.cloud.google.com**
2. Top-left, click the project dropdown → **New Project** → name it `justketchup` → **Create**
3. Wait for it to switch to the new project (check the dropdown says `justketchup`)
4. In the search bar at the top, type **Places API (New)** → click it → click **Enable**
5. Left sidebar → **APIs & Services** → **Credentials**
6. **+ Create Credentials** → **API key**
7. Copy the key it shows you. Keep the tab open.
8. Click **Edit API key** (pencil icon) → under **API restrictions** choose
   **Restrict key** → tick **Places API (New)** → **Save**

> You'll need a billing account if Google asks. There's a free monthly allowance —
> roughly 1,000 of these calls — and this app makes about one call per invite, so
> beta usage should cost nothing. Set a budget alert if you want a safety net:
> **Billing → Budgets & alerts**.

---

## Part 2 — Run the database setup (5 min)

1. Go to **supabase.com/dashboard** → your project
2. Left sidebar → **SQL Editor** → **New query**
3. Open `supabase/00-fix-contact-profiles.sql`, copy all, paste, **Run**
   — this drops the empty leftover table from the old web app
4. **New query**. Open `supabase/01-justketchup-schema.sql`, copy all, paste, **Run**
5. **New query**. Open `supabase/02-seed-neighborhoods.sql`, copy all, paste, **Run**

> Ignore `02-seed-nyc.sql` — it's marked obsolete. Don't run it.

6. **New query** once more. Paste this, change `Williamsburg` to wherever you
   actually live, then **Run**:

```sql
update public.users
set neighborhood_id = (
  select id from public.neighborhoods
  where city = 'New York' and name = 'Williamsburg'
)
where email = 'manasi.iit.madras@gmail.com';
```

This is how the app knows where the midpoint between you and Sarah is. Without it,
suggestions cluster around Sarah instead of between you.

---

## Part 3 — Add the files to GitHub (15 min)

Go to **github.com/msp3011-2026/HelloAgain**

> The repo is still called HelloAgain. Renaming it is optional — Settings →
> General → Repository name. Vercel follows the rename automatically. If you do
> rename it, do it *before* Part 3 so the URLs below match.

For **each** of the 7 files, do exactly this:

1. Click **Add file** (top right) → **Create new file**
2. In the filename box, type the **full path** from the table — including slashes
   and square brackets. GitHub turns slashes into folders as you type.
3. Open the matching file from the ones I shared, select all, copy
4. Paste into the big text area on GitHub
5. Scroll down, click **Commit new file**

The square brackets are intentional — that's how Next.js marks a dynamic URL.
Type them literally.

| # | Type this path into GitHub | Paste contents from |
|---|---|---|
| 1 | `lib/justketchup/supabaseAdmin.ts` | `lib/justketchup/supabaseAdmin.ts` |
| 2 | `lib/justketchup/places.ts` | `lib/justketchup/places.ts` |
| 3 | `app/api/invite/[token]/route.ts` | same path |
| 4 | `app/api/invite/[token]/venues/route.ts` | same path |
| 5 | `app/api/invite/[token]/confirm/route.ts` | same path |
| 6 | `app/m/[token]/page.tsx` | same path |
| 7 | `app/m/[token]/InviteFlow.tsx` | same path |

**Do not** copy `lib/justketchup/recommend.ts` — it's marked obsolete at the top.

---

## Part 4 — Add the API key to Vercel (3 min)

1. Go to **vercel.com** → your project
2. **Settings** → **Environment Variables**
3. Add:
   - Name: `GOOGLE_PLACES_API_KEY`
   - Value: the key from Part 1
   - Environments: tick all three
4. **Save**
5. Check `SUPABASE_SERVICE_ROLE_KEY` is already there. If not: Supabase →
   **Project Settings** → **API Keys** → copy the `service_role` key, add it the same way.
6. **Deployments** tab → newest deployment → **···** → **Redeploy**.
   Environment variables only take effect on a fresh deploy.

> The `service_role` key bypasses all your security rules. It belongs only in
> Vercel — never in the iOS app, never in a `NEXT_PUBLIC_` variable, never in chat.

---

## Part 5 — Test it (5 min)

1. Supabase → **SQL Editor** → **New query** → paste and **Run**:

```sql
insert into public.invites (token, user_id, contact_id, slots)
select
  'test123',
  u.id,
  c.id,
  jsonb_build_array(
    jsonb_build_object('start', to_char(now() + interval '3 days', 'YYYY-MM-DD"T"19:00:00')),
    jsonb_build_object('start', to_char(now() + interval '5 days', 'YYYY-MM-DD"T"19:30:00')),
    jsonb_build_object('start', to_char(now() + interval '8 days', 'YYYY-MM-DD"T"12:00:00'))
  )
from public.users u
join public.contacts c on c.user_id = u.id
where u.email = 'manasi.iit.madras@gmail.com'
limit 1;
```

2. Open on your phone (it's designed for mobile):

```
https://hello-again-pi.vercel.app/m/test123
```

Expect: greeting → neighborhood and food preferences → three times → three real
restaurants with ratings → confirmation with "Add to my calendar".

3. **Test the returning-guest path.** Reset the invite, then open the link again:

```sql
update public.invites set status = 'sent', chosen_slot = null, chosen_place_id = null
where token = 'test123';
```

Second time it should skip the questions and go straight to picking a time, with
your saved details as a small grey line and an **Edit** link.

---

## If something breaks

**"We couldn't find this invite"** — the `insert` in Part 5 didn't run, or you have
no contacts. Check: `select * from invites;`

**"We couldn't load suggestions"** — almost always the Google key. Check it's in
Vercel, that you redeployed after adding it, and that **Places API (New)** is
enabled (not the older "Places API").

**No restaurants appear** — filters are strict by design: rating above 4.5, 500+
reviews, moderate price or cheaper. In a quiet area that can return nothing. Tap
**Edit** and remove some cuisine filters.

**Build fails on Vercel** — check Deployments for the error and send it to me.
Usually a paste that missed the first or last line of a file.

---

## What's deliberately not built yet

- **No reservation is made.** Slated for later; the platforms are partner-gated.
  Confirmation links to Google Maps so either of you can call or book.
- **No notification to you when Sarah confirms.** The invite row flips to
  `confirmed`; wiring that to an iOS push is next.
- **Domain is still hello-again-pi.vercel.app.** `justketchup.at` would need buying.
- **iOS app creates no invites yet.** You make them by hand in SQL for now.
