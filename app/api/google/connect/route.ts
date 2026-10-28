import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';

export const dynamic = 'force-dynamic';

// Called by the iOS app right after Google sign-in, with the Google refresh
// token Supabase handed back. Stored server-side only.
export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const refreshToken = body?.refreshToken;
  if (typeof refreshToken !== 'string' || refreshToken.length < 10) {
    return NextResponse.json({ error: 'refresh_token_required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('google_tokens')
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
