# JustKetchup iOS — Start Here

Everything lives in `~/Documents/justketchup-ios`. No spaces in the path, so Terminal
commands just work.

---

## Running the app

Open Terminal and paste:

```
cd ~/Documents/justketchup-ios
./start.sh --lan
```

Wait for the QR code, then scan it with your iPhone **Camera** app. Force-quit Expo Go
first if it's already open — it caches old URLs and shows stale errors.

Stop the server with `Ctrl` + `C`.

`start.sh` handles the rest: it checks you're on Node 22, reinstalls `fsevents` if it
went missing, raises the open-file limit, and loads `.env`.

- `./start.sh --lan` — local Wi-Fi. **Use this.** Faster, no login needed.
- `./start.sh` — tunnel via ngrok. Only if LAN fails. Needs `npx expo login`.

---

## Setup (already done, for reference)

**Supabase keys** live in `.env` in this folder — the `anon` key only, never
`service_role`. `.env` is gitignored.

**Supabase redirect URLs** — Authentication → URL Configuration → Redirect URLs:

- `justketchup://auth-callback`  ← updated for the rename
- `exp://192.168.1.153:8081/--/auth-callback`  ← what Expo Go uses on your Wi-Fi

**Site URL** stays `https://hello-again-pi.vercel.app`.

**Google Cloud Console** authorized redirect URI is Supabase's callback —
`https://iekmcconzbnqpwjxotkb.supabase.co/auth/v1/callback` — and does not change.

---

## After the rename to JustKetchup

Two things changed that matter:

1. **URL scheme** is now `justketchup://` instead of `helloagain://`. This does *not*
   affect Expo Go (it uses `exp://` URLs), so sign-in keeps working today. But add
   `justketchup://auth-callback` to Supabase before you ever make a TestFlight build.

2. **Bundle identifier** is now `com.msp3011.justketchup`. If you'd already registered
   `com.msp3011.helloagain` with Apple, you'll register this one instead. Since your
   Apple Developer account is still being set up, this is the right moment to change it.

The Expo project ID (`00c97e1f-...`) is unchanged, so your Expo account still owns it.

---

## Troubleshooting

**`command not found: npm`** — paste `export PATH="/usr/local/bin:$PATH"` and retry.

**`EMFILE: too many open files`** — `fsevents` went missing. Run:
```
npm install fsevents --ignore-scripts
```

**Wrong Node version** — `start.sh` warns you. Fix with `nvm install 22 && nvm use 22`.

**"Project is incompatible with this version of Expo Go"** — Expo Go updated to a newer
SDK than the project. The project is on SDK 54.

**Blank screen / missing env vars** — stop the server and restart; `-c` clears the cache.

---

## What's in here

```
justketchup-ios/
├── .env                      Supabase keys (never commit)
├── .nvmrc                    pins Node 22
├── start.sh                  one-command start
├── app.json                  Expo config
├── lib/
│   ├── supabase.ts           Supabase client
│   ├── contacts.ts           contact CRUD
│   ├── tiers.ts              Monthly / Quarterly / Twice a year
│   ├── store.ts              passes picked contacts between screens
│   └── theme.ts              colors and spacing
├── components/
│   └── TierPicker.tsx        shared frequency selector
└── app/
    ├── _layout.tsx           auth listener + routing
    ├── index.tsx             login
    ├── home.tsx              your nudge list
    ├── contacts/             list, add, edit, import from iPhone
    └── onboarding/           info, contacts, tiers
```
