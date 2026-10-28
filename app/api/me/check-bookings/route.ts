import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';
import { findBooking, finalizeBooking, INVITE_COLUMNS } from '@/lib/justketchup/booking';

export const dynamic = 'force-dynamic';

// Called when the app opens: checks every invite waiting on a booking.
export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const { data: waiting } = await supabaseAdmin
    .from('invites')
    .select(INVITE_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'booking');
  const booked: string[] = [];
  for (const invite of waiting ?? []) {
    try {
      const hit = await findBooking(invite as any);
      if (hit) {
        await finalizeBooking(invite as any, hit.place, { atStart: hit.event.start, origin: new URL(req.url).origin });
        booked.push(invite.id);
      }
    } catch (e: any) {
      console.error('[check-bookings]', invite.id, e?.message ?? e);
    }
  }
  return NextResponse.json({ checked: (waiting ?? []).length, booked });
}
