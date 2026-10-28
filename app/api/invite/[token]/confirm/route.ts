import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { accessTokenForUser, createEvent, updateEvent } from '@/lib/justketchup/google';

const TIER_DAYS: Record<string, number> = { warm: 30, friendly: 90, keep_warm: 180 };

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { token } = params;
  const body = await req.json().catch(() => null);

  if (!body?.slot || !body?.placeId) {
    return NextResponse.json({ error: 'slot_and_place_required' }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, slots, contact_id, user_id, expires_at, calendar_event_id')
    .eq('token', token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  // The token is public, so never trust the body to name a time that wasn't offered.
  const offered = (invite.slots as any[]) ?? [];
  const match = offered.find((s) => s.start === body.slot.start);
  if (!match) return NextResponse.json({ error: 'slot_not_offered' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('invites')
    .update({
      status: 'confirmed',
      chosen_slot: match,
      chosen_place_id: body.placeId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: inviter } = await supabaseAdmin
    .from('users')
    .select('name')
    .eq('id', invite.user_id)
    .maybeSingle();

  // Follow-ups. Each is best-effort: the confirmation above already succeeded,
  // and Alan must not see an error because the inviter's calendar hiccupped.
  // Failures are logged so they show up in Vercel's runtime logs.
  const [{ data: contact }, { data: venue }] = await Promise.all([
    supabaseAdmin.from('contacts').select('name, tier').eq('id', invite.contact_id).maybeSingle(),
    supabaseAdmin.from('venue_cache').select('name, address, maps_uri').eq('place_id', body.placeId).maybeSingle(),
  ]);

  // 1. Put the meetup in the inviter's Google Calendar, whether or not they open the app.
  try {
    const accessToken = await accessTokenForUser(invite.user_id);
    if (accessToken) {
      const start = match.start as string;
      const end = (match.end as string | undefined) ?? new Date(new Date(start).getTime() + 90 * 60000).toISOString();
      const event = {
        summary: `Ketchup with ${contact?.name ?? 'a friend'}`,
        location: [venue?.name, venue?.address].filter(Boolean).join(', ') || undefined,
        description: venue?.maps_uri ? `Directions: ${venue.maps_uri}\n\nBooked with JustKetchup` : 'Booked with JustKetchup',
        start,
        end,
      };
      // A changed time or place moves the existing event instead of adding a second one.
      let updated = false;
      if (invite.calendar_event_id) {
        try {
          await updateEvent(accessToken, invite.calendar_event_id, event);
          updated = true;
        } catch (e: any) {
          console.warn('[confirm] could not move existing event, creating a new one', e?.message ?? e);
        }
      }
      if (!updated) {
        const eventId = await createEvent(accessToken, event);
        await supabaseAdmin.from('invites').update({ calendar_event_id: eventId }).eq('id', invite.id);
      }
    } else {
      console.warn('[confirm] inviter has no Google Calendar connection', invite.user_id);
    }
  } catch (e: any) {
    console.error('[confirm] calendar event failed', e?.message ?? e);
  }

  // 2. Restart the nudge clock from the meetup date, by the contact's frequency.
  try {
    const days = TIER_DAYS[contact?.tier ?? 'friendly'] ?? 90;
    const meetDate = new Date(match.start as string);
    const next = new Date(meetDate.getTime() + days * 86400000);
    await supabaseAdmin
      .from('contacts')
      .update({
        last_interaction_date: meetDate.toISOString().slice(0, 10),
        next_nudge_date: next.toISOString().slice(0, 10),
      })
      .eq('id', invite.contact_id);
  } catch (e: any) {
    console.error('[confirm] nudge reset failed', e?.message ?? e);
  }

  return NextResponse.json({
    ok: true,
    slot: match,
    inviterName: (inviter?.name ?? 'Your friend').split(' ')[0],
  });
}
