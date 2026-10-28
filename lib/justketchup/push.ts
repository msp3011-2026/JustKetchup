import { supabaseAdmin } from './supabaseAdmin';

// Sends a push notification to a JustKetchup user through Expo's push service.
// Best effort: a missing token or a failed send never breaks the caller.
export async function pushToUser(
  userId: string,
  msg: { title: string; body: string; data?: Record<string, unknown> }
): Promise<boolean> {
  const { data: user } = await supabaseAdmin.from('users').select('push_token').eq('id', userId).maybeSingle();
  const to = user?.push_token;
  if (!to) {
    console.warn('[push] no push token for user', userId);
    return false;
  }
  try {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to, sound: 'default', title: msg.title, body: msg.body, data: msg.data ?? {} }),
    });
    const d = await r.json().catch(() => ({}));
    const ticket = Array.isArray(d.data) ? d.data[0] : d.data;
    if (!r.ok || ticket?.status === 'error') {
      console.error('[push] send failed', r.status, JSON.stringify(ticket ?? d).slice(0, 300));
      return false;
    }
    return true;
  } catch (e: any) {
    console.error('[push] send threw', e?.message ?? e);
    return false;
  }
}
