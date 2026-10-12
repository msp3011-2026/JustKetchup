import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Sarah is never signed in. The invite token is the only credential she has, so
// these routes run server-side with the service role key and authorize by
// looking the token up. The service role key must NEVER reach the browser —
// it has no NEXT_PUBLIC_ prefix for exactly that reason.
//
// Created lazily, on first use, rather than at module load. Building the client
// at import time means a missing or misnamed environment variable throws during
// `next build` and fails the whole deployment, with an error that points at
// Supabase rather than at the real problem. This way a bad env var surfaces as a
// clear runtime message from the one route that needed it.

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// A proxy so call sites can keep using `supabaseAdmin.from(...)` unchanged,
// while the real client is only built when a request actually touches it.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const real = getClient() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
