import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { holdTimeWithGuest, fmtWhen, slotEnd, TZ, type ShortPlace } from '@/lib/justketchup/booking';
import { pushToUser } from '@/lib/justketchup/push';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The friend's last step: their email. Uses the shortlist from the previous
 * step, holds the time in the inviter's Google Calendar with the friend as a
 * guest (Google emails them), and tells the inviter it's ready to book.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const origin = new URL(req.url).origin;
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!EMAIL.test(email)) return NextResponse.json({ error: 'email_required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('invites')
    .select('id, token, user_id, contact_id, status, slots, calendar_event_id, expires_at, shortlist, chosen_slot')
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

  await supabaseAdmin
    .from('contact_profiles')
    .upsert({ contact_id: invite.contact_id, email, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });

  const [{ data: inviter }, { data: contact }] = await Promise.all([
    supabaseAdmin.from('users').select('name').eq('id', invite.user_id).maybeSingle(),
    supabaseAdmin.from('contacts').select('name').eq('id', invite.contact_id).maybeSingle(),
  ]);

  // The list shown on the previous step, built for this exact time.
  const shortlist = (invite.shortlist as ShortPlace[] | null) ?? [];
  if (shortlist.length === 0 || (invite.chosen_slot as any)?.start !== slot.start) {
    return NextResponse.json({ error: 'shortlist_missing', detail: 'Go back a step and pick your food again.' }, { status: 409 });
  }

  await supabaseAdmin
    .from('invites')
    .update({
      status: 'booking',
      chosen_slot: slot,
      friend_email: email,
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
