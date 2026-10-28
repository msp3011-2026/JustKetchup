# JustKetchup

Everything for the project lives in this repo.

```
justketchup/
├── PROJECT-CONTEXT.md   ← attach this at the start of a new chat
├── app/, lib/, components/, middleware.ts, …   the Next.js web app (Vercel deploys this)
├── ios-app/             the Expo / React Native app
├── database/            SQL to run in Supabase, in numbered order
└── docs/                setup notes
```

The web app sits at the repo root because that's where Vercel builds from.
`ios-app/` is excluded from the web build in `tsconfig.json`.

## Starting a new chat

Attach **`PROJECT-CONTEXT.md`**. It covers the product, the user flow and why it's
shaped that way, what works, what doesn't, the stack and versions, accounts and config,
the database schema, the code map, the gotchas that cost hours, and what to build next.

## Making changes

Changes are committed straight to `main`. Every push to `main` makes Vercel rebuild
https://justketchup.vercel.app automatically.

## Running the iOS app

Get the code onto your Mac once:

```
cd ~/Documents
git clone https://github.com/msp3011-2026/JustKetchup.git justketchup
cd justketchup/ios-app
cp ~/Desktop/JustKetchup/ios-app/.env .env
npm install
npm install fsevents --ignore-scripts
./start.sh --lan
```

After that, `git pull` in `~/Documents/justketchup` to get the latest, then
`./start.sh --lan` from `ios-app/`. See `ios-app/START-HERE.md` for troubleshooting.

The `fsevents` line is not optional — without it Metro crashes with
`EMFILE: too many open files`. The reason is in PROJECT-CONTEXT.md section 10.

## Running the database setup

Supabase → SQL Editor → New query. Run in order:

1. `database/00-fix-contact-profiles.sql`
2. `database/01-justketchup-schema.sql`
3. `database/02-seed-neighborhoods.sql`

Already run against the live database — these are here for reference or a rebuild.

## Secrets

`ios-app/.env` holds the Supabase anon key. It is **not** in this repo (the repo is
public) — copy it in from your Mac as shown above; `ios-app/.env.example` shows the
variable names. The service role key lives only in Vercel and must never appear in
the app or in a `NEXT_PUBLIC_` variable.

An old GitHub personal access token was pasted into a chat early in the project. Rotate
it if you haven't.
