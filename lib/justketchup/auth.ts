import { supabaseAdmin } from './supabaseAdmin';

// The iOS app calls these routes with the signed-in user's Supabase access
// token in the Authorization header. We ask Supabase who that token belongs to
// rather than trusting anything the app says about itself.
export async function userIdFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
