import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { findBooking, finalizeBooking, INVITE_COLUMNS } from '@/lib/justketchup/booking';

export const dynamic = 'force-dynamic';

// Looks for the reservation in the inviter's calendar and, if found, books it in.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select(INVITE_COLUMNS)
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (invite.status === 'confirmed') return NextResponse.json({ found: true, alreadyBooked: true });
  if (invite.status !== 'booking') return NextResponse.json({ found: false });

  try {
    const hit = await findBooking(invite as any);
    if (!hit) return NextResponse.json({ found: false });
    await finalizeBooking(invite as any, hit.place, { atStart: hit.event.start, origin: new URL(req.url).origin });
    return NextResponse.json({ found: true, place: hit.place, start: hit.event.start });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
