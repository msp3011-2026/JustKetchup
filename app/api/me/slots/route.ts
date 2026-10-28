import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { accessTokenForUser, busyTimes, listEvents, type CalEvent, type Interval } from '@/lib/justketchup/google';
import { candidateSlots, removeBusy } from '@/lib/justketchup/slots';

export const dynamic = 'force-dynamic';

type Slot = Interval & { friendBusy?: boolean };

/**
 * Everything the app needs to pick times:
 *  - slots: suggested times for the next two weeks where you're free
 *  - events: your own Google Calendar events, for the week view
 *  - friend: if the contact also uses JustKetchup with Google Calendar
 *    connected, each slot says whether they're busy then (free/busy only —
 *    their event details are never read)
 *
 * GET /api/me/slots?contactId=<id>
 */
export async function GET(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const contactId = new URL(req.url).searchParams.get('contactId');

  const { data: user } = await supabaseAdmin.from('users').select('timezone').eq('id', userId).maybeSingle();
  const tz = user?.timezone || 'America/New_York';

  const candidates = candidateSlots(tz);
  const timeMin = candidates[0]?.start;
  const timeMax = candidates[candidates.length - 1]?.end;

  // --- You -------------------------------------------------------------
  let accessToken: string | null = null;
  let tokenError: string | null = null;
  try {
    accessToken = await accessTokenForUser(userId);
  } catch (e: any) {
    tokenError = String(e?.message ?? e);
  }

  let slots: Slot[] = candidates;
  let events: CalEvent[] = [];
  if (accessToken) {
    try {
      const [busy, evs] = await Promise.all([
        busyTimes(accessToken, timeMin, timeMax),
        listEvents(accessToken, timeMin, timeMax),
      ]);
      slots = removeBusy(candidates, busy);
      events = evs;
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
    }
  }

  // --- Your friend, if they use JustKetchup too -----------------------
  let friend: { usesApp: boolean; calendarChecked: boolean } = { usesApp: false, calendarChecked: false };
  if (contactId) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('phone')
      .eq('id', contactId)
      .eq('user_id', userId)
      .maybeSingle();
    if (contact?.phone) {
      const { data: friendUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', contact.phone)
        .neq('id', userId)
        .maybeSingle();
      if (friendUser) {
        friend.usesApp = true;
        try {
          const friendToken = await accessTokenForUser(friendUser.id);
          if (friendToken) {
            const friendBusy = await busyTimes(friendToken, timeMin, timeMax);
            const freeForFriend = new Set(removeBusy(slots, friendBusy).map((x) => x.start));
            slots = slots.map((x) => ({ ...x, friendBusy: !freeForFriend.has(x.start) }));
            friend.calendarChecked = true;
          }
        } catch (e: any) {
          // Their calendar is a bonus; never block your own suggestions on it.
          console.warn('[slots] friend calendar check failed', e?.message ?? e);
        }
      }
    }
  }

  return NextResponse.json({
    connected: Boolean(accessToken),
    error: tokenError ?? undefined,
    timezone: tz,
    slots,
    events,
    friend,
  });
}
