'use client';

import { useEffect, useState } from 'react';

// Sign-in hand-off for the iOS app while it runs in Expo Go.
//
// Supabase rejects Expo Go's exp://<wifi-ip>:8081/... return address even when
// it is on the allow list, and silently falls back to the site root instead.
// So in development the app asks Supabase to return here (an https address
// Supabase accepts), and this page forwards the sign-in straight on to the app.
//
// Only app addresses are allowed as destinations, so this can't be used to
// send a sign-in to some other website.
const ALLOWED = [
  /^justketchup:\/\/auth-callback$/,
  /^exp:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.exp\.direct)(:\d{2,5})?\/--\/auth-callback$/,
];

export default function AppSignInHandoff() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to') ?? '';
    if (!ALLOWED.some((re) => re.test(to))) {
      setFailed(true);
      return;
    }
    // Keep everything Supabase sent: tokens arrive in the #fragment, and a
    // PKCE code or an error arrives in the query string.
    params.delete('to');
    const query = params.toString();
    window.location.replace(to + (query ? `?${query}` : '') + window.location.hash);
  }, []);

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
      <p className="text-sm font-semibold tracking-wide uppercase text-[#EA580C]">JustKetchup</p>
      <h1 className="mt-3 text-2xl font-bold text-[#1C1917]">
        {failed ? 'This sign-in link isn’t for this app.' : 'Taking you back to the app…'}
      </h1>
    </main>
  );
}
