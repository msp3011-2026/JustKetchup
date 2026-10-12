import { createClient } from '@supabase/supabase-js';

// Sarah is never signed in. The invite token is the only credential she has,
// so these routes run server-side with the service role key and authorize by
// looking the token up. The service role key must NEVER reach the browser —
// it has no NEXT_PUBLIC_ prefix for exactly that reason.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
