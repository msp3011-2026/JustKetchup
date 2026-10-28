#!/bin/bash
# JustKetchup — one-command dev server start.
# Usage:  cd ~/Documents/justketchup-ios && ./start.sh
#         ./start.sh --lan     (skip tunnel, use local Wi-Fi — faster, no login needed)

cd "$(dirname "$0")" || exit 1

# 0. Warn if the Node version isn't what Expo SDK 51 expects.
#    Node 24 causes native packages (fsevents) to be skipped and produces
#    module-format errors deep in the dependency tree.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "WARNING: running Node $NODE_MAJOR. This project expects Node 22 (Expo SDK 58 needs 22.13+)."
  echo "         Fix with:  nvm install 22 && nvm use 22 && nvm alias default 22"
  echo
fi

# 0b. Ensure fsevents is present.
#     fsevents ships a prebuilt binary but declares `install: node-gyp rebuild`,
#     and no binding.gyp is in the published tarball. That build always fails, and
#     npm silently deletes it because it's an optionalDependency. Without it Metro
#     falls back to NodeWatcher (one file handle per directory) and dies with EMFILE.
#     --ignore-scripts skips the pointless build and keeps the working binary.
if [ ! -d node_modules/fsevents ]; then
  echo "fsevents missing — reinstalling (needed to avoid EMFILE crashes)..."
  npm install --no-save fsevents --ignore-scripts
  if [ -d node_modules/fsevents ]; then
    echo "fsevents restored."
  else
    echo "WARNING: could not restore fsevents. Expect EMFILE crashes."
  fi
  echo
fi

# 1. Raise the open-file limit. Metro watches thousands of files in node_modules
#    and macOS defaults to 256, which crashes it with "EMFILE: too many open files".
ulimit -n 65536 2>/dev/null || ulimit -n 10240 2>/dev/null
echo "open file limit: $(ulimit -n)"

# 2. Load the Expo access token if it hasn't been set already.
#    Tunnel mode requires an Expo login; a token works for Google-SSO accounts
#    that have no password.
if [ -z "$EXPO_TOKEN" ] && [ -f .expo-token ]; then
  EXPO_TOKEN="$(tr -d '[:space:]' < .expo-token)"
  export EXPO_TOKEN
fi

MODE="--tunnel"
if [ "$1" = "--lan" ]; then
  MODE=""
  echo "mode: LAN (phone and Mac must be on the same Wi-Fi)"
else
  echo "mode: tunnel (works across networks)"
  # Tunnel needs an Expo login. A stored login from `npx expo login` is enough;
  # EXPO_TOKEN is only a fallback for accounts without a password.
  if [ -z "$EXPO_TOKEN" ] && ! npx expo whoami >/dev/null 2>&1; then
    echo
    echo "Not logged in to Expo. Run this once, then re-run ./start.sh:"
    echo "    npx expo login"
    echo
    echo "Or skip the tunnel entirely:  ./start.sh --lan"
    echo
    exit 1
  fi
fi

echo
npx expo start $MODE -c
