import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Starts "Check my Google Calendar" for the friend on the invite page.
// Asks Google for free/busy ONLY (when they're busy, never what the events
// are). Google treats that as non-sensitive, so no "unverified app" warning.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const origin = new URL(req.url).origin;
  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id')
    .eq('token', params.token)
    .maybeSingle();
  if (!invite) return NextResponse.redirect(`${origin}/m/${encodeURIComponent(params.token)}`);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID missing' }, { status: 500 });

  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/calendar/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.freebusy',
    access_type: 'online', // one look, no lasting access
    include_granted_scopes: 'false',
    prompt: 'select_account',
    state: params.token,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
