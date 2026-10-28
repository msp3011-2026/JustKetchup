import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { accessTokenForUser, busyTimes } from '@/lib/justketchup/google';
import { candidateSlots, removeBusy } from '@/lib/justketchup/slots';

export const dynamic = 'force-dynamic';

// Free times for the next two weeks, checked against the user's Google Calendar.
export async function GET(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const { data: user } = await supabaseAdmin.from('users').select('timezone').eq('id', userId).maybeSingle();
  const tz = user?.timezone || 'America/New_York';

  const candidates = candidateSlots(tz);
  const timeMin = candidates[0]?.start;
  const timeMax = candidates[candidates.length - 1]?.end;

  let accessToken: string | null;
  try {
    accessToken = await accessTokenForUser(userId);
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: String(e?.message ?? e), slots: candidates, timezone: tz });
  }
  if (!accessToken) {
    return NextResponse.json({ connected: false, slots: candidates, timezone: tz });
  }

  try {
    const busy = await busyTimes(accessToken, timeMin, timeMax);
    return NextResponse.json({ connected: true, slots: removeBusy(candidates, busy), timezone: tz });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
