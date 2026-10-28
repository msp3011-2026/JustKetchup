import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { findSpots } from '@/lib/justketchup/places';
import { holdTimeWithGuest, fmtWhen, slotEnd, TZ, type ShortPlace } from '@/lib/justketchup/booking';
import { pushToUser } from '@/lib/justketchup/push';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The friend's last step: time + neighborhood + food + email.
 * Builds the shortlist of places open at that time, holds the time in the
 * inviter's Google Calendar with the friend as a guest (Google emails them),
 * and tells the inviter it's ready to book.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const origin = new URL(req.url).origin;
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const neighborhoodId = body?.neighborhoodId;
  const dietary: string[] = Array.isArray(body?.dietary) ? body.dietary : [];
  const cuisines: string[] = Array.isArray(body?.cuisines) ? body.cuisines : [];

  if (!EMAIL.test(email)) return NextResponse.json({ error: 'email_required' }, { status: 400 });
  if (!neighborhoodId) return NextResponse.json({ error: 'neighborhood_required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, token, user_id, contact_id, status, slots, calendar_event_id, expires_at')
    .eq('token', params.token)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if (invite.status === 'confirmed') return NextResponse.json({ error: 'already_booked' }, { status: 409 });

  // The token is public: only accept a time that was actually offered.
  const offered = ((invite.slots as any[]) ?? []).find((s) => s.start === body?.slot?.start);
  if (!offered) return NextResponse.json({ error: 'slot_not_offered' }, { status: 400 });
  const slot = { start: offered.start as string, end: slotEnd(offered) };

  await supabaseAdmin.from('contact_profiles').upsert(
    { contact_id: invite.contact_id, neighborhood_id: neighborhoodId, dietary, cuisines, email, updated_at: new Date().toISOString() },
    { onConflict: 'contact_id' }
  );

  const [{ data: inviter }, { data: contact }] = await Promise.all([
    supabaseAdmin.from('users').select('name, neighborhood_id').eq('id', invite.user_id).maybeSingle(),
    supabaseAdmin.from('contacts').select('name').eq('id', invite.contact_id).maybeSingle(),
  ]);
  const ids = [neighborhoodId, inviter?.neighborhood_id].filter(Boolean) as string[];
  const { data: hoods } = await supabaseAdmin.from('neighborhoods').select('id, lat, lng').in('id', ids);
  const theirs = hoods?.find((h) => h.id === neighborhoodId);
  if (!theirs) return NextResponse.json({ error: 'bad_neighborhood' }, { status: 400 });
  const mine = hoods?.find((h) => h.id === inviter?.neighborhood_id) ?? theirs;

  // Shortlist: 4 well-reviewed places, open at that time, that take reservations.
  let shortlist: ShortPlace[] = [];
  try {
    const result = await findSpots(
      { lat: mine.lat, lng: mine.lng },
      { lat: theirs.lat, lng: theirs.lng },
      { dietary, cuisines, limit: 4, at: { start: slot.start, end: slot.end, tz: TZ } }
    );
    shortlist = result.places.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      mapsUri: p.mapsUri,
      rating: p.rating,
      reviews: p.reviews,
      priceLevel: p.priceLevel,
      reservable: p.reservable,
    }));
  } catch (e: any) {
    return NextResponse.json({ error: 'places_failed', detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
  if (shortlist.length === 0) {
    return NextResponse.json({ error: 'no_places', detail: 'Nothing matched everything. Try fewer food filters.' }, { status: 422 });
  }

  await supabaseAdmin
    .from('invites')
    .update({
      status: 'booking',
      chosen_slot: slot,
      friend_email: email,
      shortlist,
      responded_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  const inviterFirst = (inviter?.name ?? 'Your friend').split(' ')[0];
  const contactFirst = (contact?.name ?? 'Your friend').split(' ')[0];

  // Hold the time and send the friend the calendar invite.
  let calendarSent = false;
  try {
    await holdTimeWithGuest(invite, {
      contactName: contactFirst,
      inviterName: inviterFirst,
      email,
      slot,
      inviteUrl: `${origin}/m/${invite.token}`,
    });
    calendarSent = true;
  } catch (e: any) {
    console.error('[request] calendar hold failed', e?.message ?? e);
  }

  await pushToUser(invite.user_id, {
    title: `${contactFirst} picked ${fmtWhen(slot.start)}`,
    body: 'Ready to book. Tap to reserve a table with ChatGPT.',
    data: { inviteId: invite.id },
  });

  return NextResponse.json({ ok: true, inviterName: inviterFirst, slot, shortlist, calendarSent });
}
