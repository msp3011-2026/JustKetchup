import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { finalizeBooking, INVITE_COLUMNS } from '@/lib/justketchup/booking';

export const dynamic = 'force-dynamic';

// "Which one did you get?" — for when the booking isn't in the calendar.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select(INVITE_COLUMNS)
    .eq('id', params.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const place = ((invite.shortlist as any[]) ?? []).find((p) => p.id === body?.placeId);
  if (!place) return NextResponse.json({ error: 'place_not_on_shortlist' }, { status: 400 });
  await finalizeBooking(invite as any, place, { origin: new URL(req.url).origin });
  return NextResponse.json({ ok: true });
}
