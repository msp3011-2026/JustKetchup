import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { token } = params;

  const { data: invite, error } = await supabaseAdmin
    .from('invites')
    .select('id, token, status, slots, chosen_slot, chosen_place_id, expires_at, user_id, contact_id, friend_busy')
    .eq('token', token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const [{ data: inviter }, { data: contact }] = await Promise.all([
    supabaseAdmin.from('users').select('name, city').eq('id', invite.user_id).maybeSingle(),
    supabaseAdmin.from('contacts').select('name').eq('id', invite.contact_id).maybeSingle(),
  ]);

  const city = inviter?.city ?? 'New York';

  const [{ data: profile }, { data: cityHoods }] = await Promise.all([
    supabaseAdmin
      .from('contact_profiles')
      .select('neighborhood_id, dietary, cuisines')
      .eq('contact_id', invite.contact_id)
      .maybeSingle(),
    supabaseAdmin.from('neighborhoods').select('id, name').eq('city', city).order('name'),
  ]);

  // The user's city is free text ("nyc", "New York", "New York City"), so an exact
  // match can easily miss and leave the picker empty with no visible error. This is
  // a single-city app for now, so falling back to every neighborhood is both correct
  // and far better than showing Sarah an empty dropdown.
  let neighborhoods = cityHoods ?? [];
  if (neighborhoods.length === 0) {
    const { data: allHoods } = await supabaseAdmin
      .from('neighborhoods')
      .select('id, name')
      .order('name');
    neighborhoods = allHoods ?? [];
  }

  // Once confirmed, send back what was chosen so a refresh shows the
  // confirmation instead of starting over.
  let chosen: { slot: unknown; place: Record<string, unknown> | null } | null = null;
  if (invite.status === 'confirmed' && invite.chosen_slot) {
    const { data: v } = invite.chosen_place_id
      ? await supabaseAdmin
          .from('venue_cache')
          .select('place_id, name, address, rating, reviews, price_level, maps_uri, reservable')
          .eq('place_id', invite.chosen_place_id)
          .maybeSingle()
      : { data: null };
    chosen = {
      slot: invite.chosen_slot,
      place: v
        ? {
            id: v.place_id,
            name: v.name,
            address: v.address ?? '',
            rating: v.rating ?? 0,
            reviews: v.reviews ?? 0,
            priceLevel: v.price_level ?? null,
            mapsUri: v.maps_uri ?? null,
            reservable: v.reservable ?? null,
          }
        : null,
    };
  }

  return NextResponse.json({
    status: invite.status,
    chosen,
    // Which offered times clash with the friend's Google Calendar, if they checked.
    friendCalendar: invite.friend_busy ?? null,
    inviterName: (inviter?.name ?? 'Your friend').split(' ')[0],
    contactName: (contact?.name ?? '').split(' ')[0],
    city,
    slots: invite.slots ?? [],
    neighborhoods,
    // Returned so Sarah sees her previous answers prefilled and can change them,
    // rather than being asked the same questions on every invite.
    savedProfile: profile ?? null,
  });
}
