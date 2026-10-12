# Upload this folder to GitHub — one drag, one commit

All 7 files, type-checked and ready. Nothing obsolete in here.

## Steps

1. Go to **github.com/msp3011-2026/JustKetchup**
2. Click **Add file** (top right) → **Upload files**
3. Open Finder at `~/Documents/JUSTKETCHUP-UPLOAD`
4. Select the **`app`** folder and the **`lib`** folder together (click one, Cmd-click
   the other). Do **not** select this README.
5. Drag them both into the GitHub upload area
6. Wait for the file list to appear — you should see 7 files with their full paths
7. Scroll down → **Commit changes**

GitHub adds and overwrites exactly the paths you uploaded. It does not delete anything
else in the repo, so your existing `app/page.tsx`, `app/home/`, and the rest are safe.

## What's in here

```
app/
├── api/invite/[token]/route.ts            loads an invite by its token
├── api/invite/[token]/venues/route.ts     saves prefs, fetches live Google Places
├── api/invite/[token]/confirm/route.ts    records the chosen time + place
└── m/[token]/
    ├── page.tsx                           the invite page route
    └── InviteFlow.tsx                     the actual multi-step UI

lib/justketchup/
├── places.ts                              venue search + ranking
└── supabaseAdmin.ts                       server-side Supabase client
```

## What was fixed since the last attempt

- **`places.ts`** — `[...map.values()]` replaced with `Array.from(map.values())`.
  Your repo compiles at an older TypeScript target where spreading a Map iterator is
  an error. This was the "MapIterator ... downlevelIteration" build failure.
- **`supabaseAdmin.ts`** — the Supabase client is now created on first use instead of
  at import time, so a missing environment variable produces a clear runtime message
  rather than failing the whole build with a confusing error.
- **`InviteFlow.tsx`** — this is the file that was missing last time, which caused
  `Module not found: Can't resolve './InviteFlow'`. It must sit in the same folder as
  `page.tsx`.

All 7 files were checked with `tsc --noEmit` at `target: es5` with strict mode — the
same settings that produced your error — and came back clean.

## After the upload

Vercel rebuilds automatically, about 2 minutes.

Before testing, make sure this environment variable exists in Vercel with **underscores,
not spaces**:

```
GOOGLE_PLACES_API_KEY
```

Check **Settings → Environment Variables**. There was an entry from Apr 15 that may
already be this name — edit that one rather than adding a duplicate. After adding or
changing it, **Deployments → ··· → Redeploy**, since env vars only apply to new builds.

Then test:

```
https://justketchup.vercel.app/m/test123
```
