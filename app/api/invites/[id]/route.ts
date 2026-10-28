import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { chatgptPrompt, INVITE_COLUMNS } from '@/lib/justketchup/booking';

export const dynamic = 'force-dynamic';

// One invite for the app's ready-to-book screen.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select(INVITE_COLUMNS)
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: contact } = await supabaseAdmin.from('contacts').select('name').eq('id', invite.contact_id).maybeSingle();
  let booked: { id: string; name: string; address: string | null; mapsUri: string | null } | null = null;
  if (invite.chosen_place_id) {
    const { data: v } = await supabaseAdmin
      .from('venue_cache')
      .select('place_id, name, address, maps_uri')
      .eq('place_id', invite.chosen_place_id)
      .maybeSingle();
    booked = v ? { id: v.place_id, name: v.name, address: v.address, mapsUri: v.maps_uri } : null;
  }
  const shortlist = (invite.shortlist as any[]) ?? [];
  return NextResponse.json({
    id: invite.id,
    status: invite.status,
    contactName: contact?.name ?? '',
    slot: invite.chosen_slot,
    shortlist,
    booked,
    friendEmail: invite.friend_email,
    chatgptUrl:
      invite.chosen_slot && shortlist.length
        ? `https://chatgpt.com/?q=${encodeURIComponent(chatgptPrompt(shortlist, invite.chosen_slot as any))}`
        : null,
  });
}
