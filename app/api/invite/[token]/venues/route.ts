import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { findSpots } from '@/lib/justketchup/places';

export const dynamic = 'force-dynamic';

/**
 * Saves Sarah's neighborhood + preferences (so we never ask again), then
 * returns live suggestions between her and the inviter.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { token } = params;
  const body = await req.json().catch(() => null);
  if (!body?.neighborhoodId) {
    return NextResponse.json({ error: 'neighborhood_required' }, { status: 400 });
  }

  const dietary: string[] = Array.isArray(body.dietary) ? body.dietary : [];
  const cuisines: string[] = Array.isArray(body.cuisines) ? body.cuisines : [];
  const slot = body.slot && typeof body.slot.start === 'string' ? body.slot : null;

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, user_id, contact_id, expires_at, slots')
    .eq('token', token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  await supabaseAdmin.from('contact_profiles').upsert(
    {
      contact_id: invite.contact_id,
      neighborhood_id: body.neighborhoodId,
      dietary,
      cuisines,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'contact_id' }
  );

  const { data: inviter } = await supabaseAdmin
    .from('users')
    .select('neighborhood_id')
    .eq('id', invite.user_id)
    .maybeSingle();

  const ids = [body.neighborhoodId, inviter?.neighborhood_id].filter(Boolean) as string[];
  const { data: hoods } = await supabaseAdmin
    .from('neighborhoods')
    .select('id, name, lat, lng')
    .in('id', ids);

  const sarahHood = hoods?.find((h) => h.id === body.neighborhoodId);
  if (!sarahHood) return NextResponse.json({ error: 'bad_neighborhood' }, { status: 400 });

  const inviterHood = hoods?.find((h) => h.id === inviter?.neighborhood_id) ?? sarahHood;

  try {
    const result = await findSpots(
      { lat: inviterHood.lat, lng: inviterHood.lng },
      { lat: sarahHood.lat, lng: sarahHood.lng },
      {
        dietary,
        cuisines,
        limit: 3,
        // Only places open for the chosen time. Must be one of the offered slots.
        at: (() => {
          const offered = ((invite.slots as any[]) ?? []).find((x) => slot && x.start === slot.start);
          if (!offered) return undefined;
          const end = offered.end ?? new Date(new Date(offered.start).getTime() + 90 * 60000).toISOString();
          return { start: offered.start, end, tz: 'America/New_York' };
        })(),
      }
    );
    const spots = result.places;

    // Cache so a reload or a second look doesn't bill another Places call.
    if (spots.length > 0) {
      await supabaseAdmin.from('venue_cache').upsert(
        spots.map((p) => ({
          place_id: p.id,
          name: p.name,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
          rating: p.rating,
          reviews: p.reviews,
          price_level: p.priceLevel,
          maps_uri: p.mapsUri,
          reservable: p.reservable,
          cached_at: new Date().toISOString(),
        })),
        { onConflict: 'place_id' }
      );
    }

    return NextResponse.json({
      // Opening hours stay on the server; the page doesn't need them.
      venues: spots.map(({ periods, ...rest }) => rest),
      debug: { fetched: result.fetched, qualifying: result.qualifying },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'places_failed', detail: String(e?.message ?? e).slice(0, 200) },
      { status: 502 }
    );
  }
}
