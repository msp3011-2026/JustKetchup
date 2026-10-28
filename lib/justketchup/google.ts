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



export type CalEvent = {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
  /** Marked 'Show as: Free' in Google, or an invite not yet accepted. Still blocks the time. */
  softBusy: boolean;
};

// The user's own events, so the app can show their week around the free slots.
// Titles never leave the user's own app; friends only ever see free/busy.
export async function listEvents(accessToken: string, timeMin: string, timeMax: string): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    fields: 'items(summary,start,end,status,transparency,attendees(self,responseStatus))',
  });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google_events_failed: ${d.error?.message ?? r.status}`);
  return ((d.items ?? []) as any[])
    .map((e) => ({ e, mine: (e.attendees ?? []).find((a: any) => a.self)?.responseStatus as string | undefined }))
    // Cancelled events and invitations you declined don't count.
    .filter(({ e, mine }) => e.status !== 'cancelled' && mine !== 'declined')
    .map(({ e, mine }) => {
      const allDay = Boolean(e.start?.date && !e.start?.dateTime);
      return {
        start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
        end: e.end?.dateTime ?? `${e.end?.date}T00:00:00`,
        title: e.summary ?? 'Busy',
        allDay,
        softBusy: e.transparency === 'transparent' || mine === 'needsAction' || mine === 'tentative',
      };
    });
}

export type EventInput = {
  summary: string;
  location?: string | null;
  description?: string;
  start: string;
  end: string;
  /** Guests by email. Google emails them the invite and every later change. */
  attendees?: string[];
};

function eventBody(ev: EventInput) {
  return {
    summary: ev.summary,
    location: ev.location ?? null,
    description: ev.description,
    start: { dateTime: ev.start },
    end: { dateTime: ev.end },
    ...(ev.attendees ? { attendees: ev.attendees.map((email) => ({ email })) } : {}),
  };
}

// With guests, sendUpdates=all makes Google email them now and on every change.
export async function createEvent(accessToken: string, ev: EventInput): Promise<string> {
  const q = ev.attendees?.length ? '?sendUpdates=all' : '';
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${q}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventBody(ev)),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google_create_event_failed: ${d.error?.message ?? r.status}`);
  return d.id as string;
}

// Moves or fills in an existing event; guests get Google's "Updated invitation".
export async function updateEvent(accessToken: string, eventId: string, ev: EventInput): Promise<void> {
  const q = ev.attendees?.length ? '?sendUpdates=all' : '';
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}${q}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody(ev)),
    }
  );
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`google_update_event_failed: ${r.status} ${d.error?.message ?? ''}`.trim());
  }
}

export type RawEvent = {
  id: string;
  summary: string;
  location: string;
  description: string;
  start: string;
  end: string;
};

// Events with the fields needed to recognise a restaurant booking.
export async function listRawEvents(accessToken: string, timeMin: string, timeMax: string): Promise<RawEvent[]> {
  const q = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    fields: 'items(id,summary,location,description,start,end,status)',
  });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`google_events_failed: ${d.error?.message ?? r.status}`);
  return ((d.items ?? []) as any[])
    .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? '',
      location: e.location ?? '',
      description: e.description ?? '',
      start: e.start.dateTime,
      end: e.end?.dateTime ?? e.start.dateTime,
    }));
}
