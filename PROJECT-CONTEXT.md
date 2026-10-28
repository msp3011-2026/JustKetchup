# JustKetchup — full project context

Upload this file at the start of a new chat. It contains everything needed to pick up
the work: what the product is, what exists, how it's built, what's left, and the
decisions already made so they don't get relitigated.

Last updated: 12 October 2026.

---

## 1. What it is

JustKetchup nudges you to reconnect with people you care about, then handles the
coordination so you only have to show up.

The problem: people drift out of touch not because they stop caring but because
scheduling is friction. "We should catch up!" dies in a text thread.

**The name** is a deliberate pun on "catch up" — leaning in rather than avoiding it.
It works as a verb the way "google it" does: *"Let's ketchup"*, *"Ketchup with Sarah"*,
*"She ketchup'd me back"*. The thinking is "just do it, just meet" — the app handles
everything else. Chosen over Meetup (trademark conflict), Catchup, Catch, Cuppa,
Pencil, Slot, Link, Kick, Tag, Loop, Clink, Bump.

**City-specific by design.** NYC first. Venue quality comes from knowing the city.

---

## 2. The user flow (revised 27 Oct — supersedes 11 Oct)

Two people: **Manasi** (has the iOS app) and **Alan** (doesn't, and never needs to).
**No text messages anywhere in the flow.** The full step-by-step version, with what's
built, is published as the "JustKetchup User Flow" page.

1. **Nudge** — push to Manasi: *"It's been 3 months since Alan. Ketchup?"* Tapping opens
   Alan in the app: Ketchup with Alan / Snooze / We already met.
2. **Pick times** — the app shows her free times from **Google Calendar**; she ticks 3–4.
3. **Send on WhatsApp** — the app opens WhatsApp straight into her chat with Alan
   (`wa.me/<phone>?text=…`) with the warm pre-written message and link already typed.
   She reviews and sends it herself. The app then shows "Waiting on Alan".
4. **Alan opens the link** — plain web page, no install. Neighborhood + food prefs
   (saved for next time), then a time (or suggests others), then a venue, then confirm.
5. **Back to Manasi** — on confirmation the server adds the meetup to her **Google
   Calendar automatically**, whether or not she opens anything, then pushes
   "Alan picked Thu 7pm at Ozakaya". Tapping it is optional.
6. **No reply** — reminder after a few days (Remind him / Cancel); expires at 14 days
   and Alan goes back into her nudges.

### Calendar decision (27 Oct, reverses 11 Oct)

**Google Calendar, not the iPhone calendar.** iOS won't let an app write to the calendar
while it's closed, so "added automatically when Alan confirms" is only possible
server-side. Needs Google calendar scope at sign-in with offline access, and the refresh
token stored server-side. Gotcha: while the Google OAuth app is in "Testing" status,
refresh tokens expire after 7 days — publish it (unverified is fine for <100 users, with
a warning screen) before beta.

### Why this shape

**No Twilio in the core loop.** Earlier design had the app texting Alan from an
app-owned number, which requires A2P 10DLC / toll-free verification — a US carrier
requirement every SMS provider passes on, so switching providers wouldn't help. The
hybrid link model avoids it entirely: Manasi's own phone sends the invite, and Alan
replies via a web form rather than a text that needs parsing. **Check whether Twilio is
needed at all before reviving it.**

**Push, not SMS, for the app user.** The nudge goes to Manasi, who has the app.
Free, instant, no carrier registration.

---

## 3. What works today

- iOS app runs on a real iPhone via Expo Go
- **Google sign-in works end to end**
- Contacts: list, add manually, edit, delete, import from iPhone contacts with
  permission prompt and de-duplication by phone number
- Supabase database with row-level security
- **The invite web page works end to end** at `justketchup.vercel.app/m/<token>`:
  greeting → neighborhood + dietary + cuisine → time slots → live Google Places
  venue suggestions → confirmation with "Add to my calendar"
- First real result (Downtown Brooklyn ↔ Bedford-Stuyvesant): Ozakaya, Evelina, Olea —
  all 4.6–4.7 stars, 1500+ reviews, $$, and 0.8–1.2 km from the true midpoint

## 4. What is NOT built

- ~~The iOS app does not create invites.~~ **Built 27 Oct, not yet tested on a phone:**
  contact screen → "Ketchup with X" → free times from Google Calendar → WhatsApp opens
  with the message pre-typed. Confirmation adds the meetup to the inviter's Google
  Calendar and resets the next nudge. Routes: /api/me/slots, /api/invites,
  /api/google/connect. Token table: google_tokens (database/03-google-calendar.sql).
- **No notification when the contact confirms.** The invite row flips to `confirmed`
  and nothing tells the user.
- **No push notifications at all.** Needs a development build (`expo-dev-client`,
  `npx expo run:ios`) plus an APNs key — `expo-notifications` dropped push support in
  Expo Go as of SDK 53. Needs the Apple Developer account.
- Google Calendar read + write: built 27 Oct (see above). Google OAuth app is published (In production), scopes calendar.events + calendar.freebusy.
- **No reservations.** Deliberately deferred — OpenTable and Resy are partner-gated
  (apply, get approved, sign a contract; no self-serve keys). ChatGPT, Gemini, Alexa+
  and Perplexity can book because those companies signed deals, not because the API is
  open. All three major platforms prohibit automation in their ToS and do ban accounts.
  Current approach: confirm time and place, link to Google Maps.
- **No onboarding flow in practice** — Manasi's `users` row already has
  `onboarding_completed = true`, so login goes straight to home. The onboarding screens
  exist and are untested.
- **Nudge engine not deployed.** `/api/cron/nudge` and `vercel.json` were written in an
  earlier session but never added to the repo.

---

## 5. Tech stack (verified working)

| Thing | Version | Notes |
|---|---|---|
| Node | **20.20.2** via nvm | Pinned by `.nvmrc`. `nvm alias default 20` set. **Node 24 breaks everything** — see gotchas. |
| Expo SDK | **54.0.36** | Must match Expo Go on the phone; Apple only allows the latest Expo Go, so you cannot downgrade. |
| React / React DOM | 19.1.0 / 19.1.0 | `react-dom` must be pinned or npm grabs 19.2.x and ERESOLVE fails. |
| React Native | 0.81.5 | |
| expo-router | 6.0.24 | |
| babel-preset-expo | 54.0.12 | Must be an explicit devDependency in SDK 54. |
| Metro | 0.83.3 | |
| Next.js (web) | 14.2.15 | TypeScript target is **es5** — see gotchas. |
| Mac | Darwin 25.5.0, arm64 | Xcode at `/Applications/Xcode.app/Contents/Developer` |

---

## 6. Accounts and configuration

**No secrets are in this file.** Keys live where they belong; this says where.

| Service | Detail |
|---|---|
| Supabase | Project `iekmcconzbnqpwjxotkb.supabase.co`. Anon key in the iOS `.env`; service role key in Vercel only. |
| Vercel | Project `justketchup`, live at `https://justketchup.vercel.app` |
| GitHub | `github.com/msp3011-2026/JustKetchup` |
| Google Cloud | Project `helloagain-490804` (display name JustKetchup). Places API (New) enabled. Key "Maps Platform API Key", restricted to Places API (New), Application restrictions = **None** (required: Vercel's server sends no referrer). |
| Expo | Account `msp3011`, projectId `00c97e1f-d843-4ed3-a210-f762b0476a6d` |
| Apple Developer | Being set up. Bundle ID will be `com.msp3011.justketchup` — not yet registered, so still changeable. |
| Twilio | Toll-free verification was in progress. **May no longer be needed** — see section 2. |

**Vercel environment variables:** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Supabase auth config:**
- Site URL: `https://justketchup.vercel.app`
- Redirect URLs: `justketchup://auth-callback`, `exp://localhost:8081/--/auth-callback`,
  the `exp.direct` tunnel URL, and ideally `exp://192.168.1.*:8081/--/auth-callback`
  (wildcard, because the Mac's LAN IP changes)
- Google Cloud authorized redirect URI is Supabase's callback
  (`https://iekmcconzbnqpwjxotkb.supabase.co/auth/v1/callback`) — unaffected by any
  app or domain rename.

**Security note:** an old GitHub personal access token was pasted into a chat early on.
It should be rotated if it hasn't been.

---

## 7. Database schema (Supabase / Postgres)

Run order: `00-fix-contact-profiles.sql` → `01-justketchup-schema.sql` →
`02-seed-neighborhoods.sql`. All three are in `database/`.

**Pre-existing tables:** `users`, `contacts`, `meetups`, `blocked_windows`, `nudge_log`

- `users` — id, email, name, phone, city, onboarding_completed, **neighborhood_id**
- `contacts` — id, user_id, name, phone, tier, next_nudge_date

**Added for the invite flow:**

- `neighborhoods` — id, city, name, lat, lng. 36 NYC neighborhoods seeded. The only
  location data stored.
- `contact_profiles` — contact_id (unique), neighborhood_id, dietary[], cuisines[],
  avoid_cuisine[], vibe[], price_range, updated_at.
  **Keyed by contact_id, not phone.** Phone-keying would make a profile global, so
  another user adding Alan would see his details without him telling them.
  (`avoid_cuisine`, `vibe`, `price_range` are stored but not yet used in the UI —
  `avoid_cuisine` is arguably more useful than `cuisines`.)
- `venue_cache` — place_id (pk), name, address, lat, lng, rating, reviews, price_level,
  maps_uri, cached_at. Not a curated list — just a copy of Google's response so a reload
  doesn't bill another API call.
- `invites` — id, token (unique), user_id, contact_id, slots jsonb, status
  (sent|confirmed|expired), chosen_slot, **chosen_place_id**, responded_at, expires_at
  (14 days), created_at

**RLS:** the app user manages their own rows. The contact is never signed in — server
routes use the service role key and authorize by the unguessable invite token.

### Tier system

| DB value | Shown to users | Interval |
|---|---|---|
| `warm` | Monthly | 30 days |
| `friendly` | Quarterly | 90 days |
| `keep_warm` | Twice a year | 180 days |

Internal values stay `warm`/`friendly`/`keep_warm`; users only ever see the plain
English. New contacts get a first nudge ~2 days out rather than a full tier interval,
so beta testers experience the product immediately.

---

## 8. Code map

### `ios-app/` — Expo / React Native

```
app/
├── _layout.tsx            auth listener + routing guard
├── index.tsx              login (Google OAuth via expo-web-browser)
├── home.tsx               nudge list, "Manage contacts" button
├── contacts/
│   ├── index.tsx          list with edit/remove
│   ├── new.tsx            add manually
│   ├── [id].tsx           edit + delete
│   ├── import.tsx         iPhone contacts import
│   └── _layout.tsx
└── onboarding/            info, contacts, tiers (built, untested)
lib/
├── supabase.ts            AsyncStorage-backed client
├── contacts.ts            CRUD + bulk import with de-duplication
├── tiers.ts               tier definitions, phasedNudgeDate, normalizePhone
├── store.ts               in-memory handoff between onboarding screens
└── theme.ts               colors + spacing
components/TierPicker.tsx  shared frequency selector
```

### `web/` — Next.js, goes into the GitHub repo at these paths

```
app/api/invite/[token]/route.ts          GET invite by token
app/api/invite/[token]/venues/route.ts   POST prefs, returns live Places results
app/api/invite/[token]/confirm/route.ts  POST chosen time + place
app/m/[token]/page.tsx                   route wrapper
app/m/[token]/InviteFlow.tsx             the whole multi-step UI
lib/justketchup/places.ts                Google Places search + ranking
lib/justketchup/supabaseAdmin.ts         service-role client (lazy-initialised)
```

### Venue selection criteria (Manasi's spec)

1. Roughly midway between both people
2. Google rating above 4.5
3. More than 500 Google reviews
4. Matches cuisine and dietary preferences
5. Under roughly $50 per person

**Dietary is a hard filter** — vegan means vegan, not "mostly". Implemented by asking
Google for `vegan_restaurant` / `vegetarian_restaurant` types directly.

**Google's `priceLevel` is a relative band** (`INEXPENSIVE`/`MODERATE`/...), not dollars,
so "$50" maps to the bottom two bands. Approximate by necessity.

**Billing:** `rating`, `userRatingCount` and `priceLevel` put the call in Google's
Enterprise tier, ~$35 per 1,000 calls, 1,000 free monthly. One call per invite, cached.

**Known tuning issue:** the ranking weights distance-to-midpoint more heavily than
fairness between the two people. In the first real test, Evelina ranked above Ozakaya
despite being ~2 km lopsided (12-minute walk for one, 35 for the other) because it was
0.2 km nearer the midpoint. Raising the imbalance weight in `findSpots` would reorder
these.

---

## 9. How to run

```
cd ~/Documents/justketchup-ios      (or wherever this folder lives)
./start.sh --lan
```

Scan the QR with the iPhone **Camera** app. Force-quit Expo Go first — it caches dead
URLs and shows stale errors. `Ctrl` + `C` to stop.

`start.sh` handles the rest: warns if Node isn't 20, reinstalls `fsevents` if missing,
raises the open-file limit, loads `.env`.

- `./start.sh --lan` — local Wi-Fi. **Preferred.** Faster, no Expo login.
- `./start.sh` — ngrok tunnel. Only if LAN fails. Needs `npx expo login`.

**Note:** this folder has no `node_modules`. Run `npm install` once before first use,
then `npm install fsevents --ignore-scripts`.

---

## 10. Gotchas that cost real time

**Check `node -v` before diagnosing anything.** Node 24 with Expo produced
`tslib.__assign is not a function` inside @expo/cli and made npm silently skip native
packages. Node 20 fixed all of it.

**`EMFILE: too many open files` means `fsevents` is missing, not that `ulimit` is low.**
Metro picks a watcher: Watchman > FSEventsWatcher (needs the `fsevents` npm package) >
NodeWatcher (one file handle per directory — always dies). `fsevents` ships a prebuilt
binary but declares `install: node-gyp rebuild`, and **no `binding.gyp` is in the
published tarball**, so the build always fails and npm silently deletes it because it's
an optionalDependency. Fix: `npm install fsevents --ignore-scripts`. Raising `ulimit` to
65536 does not help. Homebrew/Watchman is unnecessary.

**Expo Go's version dictates the SDK.** Apple only allows the latest Expo Go, so you
cannot downgrade it. The project must match.

**The web repo's TypeScript target is es5.** `[...map.values()]` is a compile error
(`MapIterator can only be iterated through when using --downlevelIteration`). Use
`Array.from(map.values())`. Check `tsconfig.json` before writing anything touching Maps
or Sets.

**A `catch` that swallows the first failure turns every error into a silent empty
state.** This hid a Google 403 behind "no restaurants found" for an hour.

**"Endpoint offline" / "could not connect" usually means the server died**, not a
network problem. Expo prints "Tunnel ready" once and never updates it, so the screen
lies. A phone that reaches the Mac and returns *any* error proves the network is fine.

**Google Places 403 `PERMISSION_DENIED`** had billing disabled on the Cloud project as
the root cause — API, key restrictions and application restrictions were all already
correct. Also: a key with **Application restrictions = Websites** can never work from a
server, because there's no referrer header.

**Vercel: renaming a project does not move its `.vercel.app` domain.** Add the new
domain manually under Settings → Domains.

**GitHub uploads:** drag the folders *inside* the upload folder (`app`, `lib`), not the
folder itself. Dragging the parent creates a nested copy the build ignores while the
real files stay stale. Always read the file list GitHub shows before committing.

---

## 11. How to work with Manasi

- **Don't guess.** Build a test, ask for the specific error, or look at her screen. She
  will grant screen access. Several hours were lost to confident theories about
  Anaconda, router client isolation and the macOS firewall — all wrong.
- **Diagnose before proposing fixes.** Give one command that produces evidence, say what
  each outcome would mean, then act on what comes back.
- **Verify with real tool runs** — a scratch `tsc --noEmit` against the target repo's
  config catches build errors before deploying. Install typescript + next + react +
  @supabase/supabase-js in a temp dir, copy the source in, run it.
- **She is non-technical and needs handholding for GitHub** — exact clicks, exact paths.
- **Deliver one clean folder** she can upload in a single go, never file-by-file
  commits. If several files must change together, say so explicitly — a partial upload
  breaks the build.
- **She says "see terminal" or "see"** as the signal to screenshot her screen.
- Her phone screenshots sometimes don't come through; ask her to type the error instead.

### Copy rules

- **WhatsApp messages from the user to their friend must be long and warm, with niceties.** "Real
  people talk with more words, not efficiency." Short, efficient copy was rejected twice.
- **The invite web page is playful and leans on the name.** *"You and Manasi are overdue
  a ketchup."*
- **Never attribute feelings or intent to the inviter.** No "Manasi would love to see
  you", no "Manasi has been meaning to". Frame it as mutual and overdue. Factual
  statements are fine: "Manasi is free at these times", "Manasi has been told".
- American, not British. No "fancy", no "lovely".

---

## 12. What to build next, in order

1. **iOS app creates invites.** Generate a token, pick slots, write the `invites` row,
   draft the message, open WhatsApp to Alan's chat with it pre-filled so she sends it herself.
   This closes the loop.
2. **Google Calendar** — read free times for the slots; write the meetup on confirmation.
3. **Notify the user when the contact confirms.** Needs push, needs a development build,
   needs the Apple Developer account.
4. **Deploy the nudge engine** — the daily cron that decides who's due and sends the
   push.
5. **Tune venue fairness weighting** once there are more real neighborhood pairs.
6. Use `avoid_cuisine` — knowing what someone doesn't want is more useful than what they do.
7. TestFlight build.
