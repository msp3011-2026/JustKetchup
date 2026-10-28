import { supabaseAdmin } from './supabaseAdmin';

// Google Calendar, called from the server so it works while the app is closed.
// The refresh token comes from the user's Google sign-in (requested with offline
// access) and lives only in the google_tokens table, which has RLS on and no
// policies — only the service role can read it.

export type Interval = { start: string; end: string };

export async function accessTokenForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('google_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data?.refresh_token) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in Vercel');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    // invalid_grant = the user revoked access or the token expired. Surface it;
    // don't silently pretend the calendar is empty.
    throw new Error(`google_token_refresh_failed: ${d.error ?? r.status} ${d.error_description ?? ''}`.trim());
  }
  return d.access_token as string;
}

export async function busyTimes(accessToken: string, timeMin: string, timeMax: string): Promise<Interval[]> {
  const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google_freebusy_failed: ${d.error?.message ?? r.status}`);
  return (d.calendars?.primary?.busy ?? []) as Interval[];
}

export async function createEvent(
  accessToken: string,
  ev: { summary: string; location?: string; description?: string; start: string; end: string }
): Promise<string> {
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: ev.summary,
      location: ev.location,
      description: ev.description,
      start: { dateTime: ev.start },
      end: { dateTime: ev.end },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google_create_event_failed: ${d.error?.message ?? r.status}`);
  return d.id as string;
}
