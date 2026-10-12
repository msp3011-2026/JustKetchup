import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { token } = params;
  const body = await req.json().catch(() => null);

  if (!body?.slot || !body?.placeId) {
    return NextResponse.json({ error: 'slot_and_place_required' }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, slots, contact_id, user_id, expires_at')
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

  return NextResponse.json({
    ok: true,
    slot: match,
    inviterName: (inviter?.name ?? 'Your friend').split(' ')[0],
  });
}
