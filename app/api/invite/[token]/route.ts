import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { token } = params;

  const { data: invite, error } = await supabaseAdmin
    .from('invites')
    .select('id, token, status, slots, chosen_slot, chosen_venue_id, expires_at, user_id, contact_id')
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

  const [{ data: profile }, { data: neighborhoods }] = await Promise.all([
    supabaseAdmin
      .from('contact_profiles')
      .select('neighborhood_id, dietary, cuisines')
      .eq('contact_id', invite.contact_id)
      .maybeSingle(),
    supabaseAdmin.from('neighborhoods').select('id, name').eq('city', city).order('name'),
  ]);

  return NextResponse.json({
    status: invite.status,
    inviterName: (inviter?.name ?? 'Your friend').split(' ')[0],
    contactName: (contact?.name ?? '').split(' ')[0],
    city,
    slots: invite.slots ?? [],
    neighborhoods: neighborhoods ?? [],
    // Returned so Sarah sees her previous answers prefilled and can change them,
    // rather than being asked the same questions on every invite.
    savedProfile: profile ?? null,
  });
}
