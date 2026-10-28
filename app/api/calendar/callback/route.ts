import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { busyTimes, type Interval } from '@/lib/justketchup/google';
import { removeBusy } from '@/lib/justketchup/slots';

export const dynamic = 'force-dynamic';

// Google sends the friend back here after they allow free/busy access.
// We look once at the offered times, store only which of them clash, and
// throw the access away — nothing about their calendar is kept.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const token = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const back = (status: string) =>
    NextResponse.redirect(`${origin}/m/${encodeURIComponent(token)}?calendar=${status}`);

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, slots')
    .eq('token', token)
    .maybeSingle();
  if (!invite) return NextResponse.redirect(origin);
  if (!code) return back('skipped'); // they pressed Cancel on Google's screen

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${origin}/api/calendar/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) throw new Error(`token_exchange_failed: ${t.error ?? r.status}`);

    const slots = ((invite.slots as Interval[]) ?? []).map((s) => ({
      start: s.start,
      end: s.end ?? new Date(new Date(s.start).getTime() + 90 * 60000).toISOString(),
    }));
    if (slots.length === 0) return back('checked');

    const timeMin = slots.reduce((m, s) => (s.start < m ? s.start : m), slots[0].start);
    const timeMax = slots.reduce((m, s) => (s.end > m ? s.end : m), slots[0].end);
    const busy = await busyTimes(t.access_token, timeMin, timeMax);
    const free = new Set(removeBusy(slots, busy, 0).map((s) => s.start));

    await supabaseAdmin
      .from('invites')
      .update({
        friend_busy: {
          checkedAt: new Date().toISOString(),
          busy: slots.filter((s) => !free.has(s.start)).map((s) => s.start),
        },
      })
      .eq('id', invite.id);

    // Best effort: tell Google we're done with the access.
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.access_token)}`, {
      method: 'POST',
    }).catch(() => {});

    return back('checked');
  } catch (e: any) {
    console.error('[calendar/callback]', e?.message ?? e);
    return back('error');
  }
}
