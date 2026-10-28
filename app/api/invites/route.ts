import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/justketchup/supabaseAdmin';
import { userIdFromRequest } from '@/lib/justketchup/auth';

export const dynamic = 'force-dynamic';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function newToken(len = 10) {
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

// Creates an invite from the iOS app: the chosen times plus a private link token.
export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const contactId = body?.contactId;
  const slots = Array.isArray(body?.slots) ? body.slots : [];
  if (typeof contactId !== 'string') return NextResponse.json({ error: 'contact_required' }, { status: 400 });

  const clean = slots
    .filter((s: any) => s && typeof s.start === 'string' && !isNaN(Date.parse(s.start)))
    .map((s: any) => ({ start: s.start, end: typeof s.end === 'string' ? s.end : undefined }));
  if (clean.length === 0) return NextResponse.json({ error: 'pick_at_least_one_time' }, { status: 400 });
  if (clean.length > 8) return NextResponse.json({ error: 'too_many_times' }, { status: 400 });

  // The contact must belong to this user.
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, name, phone')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: 'contact_not_found' }, { status: 404 });

  const token = newToken();
  const { error } = await supabaseAdmin
    .from('invites')
    .insert({ token, user_id: userId, contact_id: contactId, slots: clean, status: 'sent' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  return NextResponse.json({ token, url: `${origin}/m/${token}` });
}
