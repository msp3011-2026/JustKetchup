import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';

export const dynamic = 'force-dynamic';

// The app registers its Expo push token here after the user allows notifications.
export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== 'string' || !/^(Exponent|Expo)PushToken\[.+\]$/.test(token)) {
    return NextResponse.json({ error: 'bad_push_token' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('users').update({ push_token: token }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
