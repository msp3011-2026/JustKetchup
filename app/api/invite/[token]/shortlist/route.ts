import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { findSpots } from '@/lib/justketchup/places';
import { slotEnd, TZ, type ShortPlace } from '@/lib/justketchup/booking';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The friend's last step: time + neighborhood + food + email.
 * Builds the shortlist of places open at that time, holds the time in the
 * inviter's Google Calendar with the friend as a guest (Google emails them),
 * and tells the inviter it's ready to book.
 */
/**
 * Step 2 of the friend's page: time + where to meet + food.
 * Saves their preferences and finds 3-4 places open at that time in the
 * neighborhood they picked. Stores the list on the invite so the email step reuses it.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => null);
  const neighborhoodId = body?.neighborhoodId;
  const dietary: string[] = Array.isArray(body?.dietary) ? body.dietary : [];
  const cuisines: string[] = Array.isArray(body?.cuisines) ? body.cuisines : [];
  if (!neighborhoodId) return NextResponse.json({ error: 'neighborhood_required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, user_id, contact_id, status, slots, expires_at')
    .eq('token', params.token)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if (invite.status === 'confirmed') return NextResponse.json({ error: 'already_booked' }, { status: 409 });

  const offered = ((invite.slots as any[]) ?? []).find((x) => x.start === body?.slot?.start);
  if (!offered) return NextResponse.json({ error: 'slot_not_offered' }, { status: 400 });
  const slot = { start: offered.start as string, end: slotEnd(offered) };

  await supabaseAdmin.from('contact_profiles').upsert(
    { contact_id: invite.contact_id, neighborhood_id: neighborhoodId, dietary, cuisines, updated_at: new Date().toISOString() },
    { onConflict: 'contact_id' }
  );

  // The friend picks one of the inviter's meeting neighborhoods; restaurants
  // are searched inside it.
  const { data: inviter } = await supabaseAdmin
    .from('users')
    .select('meet_neighborhood_ids')
    .eq('id', invite.user_id)
    .maybeSingle();
  const allowed: string[] = (inviter as any)?.meet_neighborhood_ids ?? [];
  if (allowed.length > 0 && !allowed.includes(neighborhoodId)) {
    return NextResponse.json({ error: 'neighborhood_not_offered' }, { status: 400 });
  }
  const { data: hood } = await supabaseAdmin.from('neighborhoods').select('id, lat, lng').eq('id', neighborhoodId).maybeSingle();
  if (!hood) return NextResponse.json({ error: 'bad_neighborhood' }, { status: 400 });
  const theirs = hood;
  const mine = hood;

  let shortlist: ShortPlace[] = [];
  try {
    const result = await findSpots(
      { lat: mine.lat, lng: mine.lng },
      { lat: theirs.lat, lng: theirs.lng },
      { dietary, cuisines, limit: 4, at: { start: slot.start, end: slot.end, tz: TZ } }
    );
    shortlist = result.places.map((p) => ({
      id: p.id, name: p.name, address: p.address, mapsUri: p.mapsUri,
      rating: p.rating, reviews: p.reviews, priceLevel: p.priceLevel, reservable: p.reservable,
    }));
  } catch (e: any) {
    return NextResponse.json({ error: 'places_failed', detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
  if (shortlist.length === 0) {
    return NextResponse.json({ error: 'no_places' }, { status: 422 });
  }

  // Remember the list and the time it was built for; status stays as it is.
  await supabaseAdmin.from('invites').update({ shortlist, chosen_slot: slot }).eq('id', invite.id);
  return NextResponse.json({ shortlist, slot });
}
