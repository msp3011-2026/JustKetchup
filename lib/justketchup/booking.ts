import { supabaseAdmin } from './supabaseAdmin';
import { accessTokenForUser, createEvent, listRawEvents, updateEvent, type RawEvent } from './google';

export type ShortPlace = {
  id: string;
  name: string;
  address: string;
  mapsUri: string | null;
  rating: number;
  reviews: number;
  priceLevel: string | null;
  reservable: boolean | null;
};

export type Slot = { start: string; end?: string };

export const TZ = 'America/New_York';
const HOUR = 3600000;

export function slotEnd(slot: Slot) {
  return slot.end ?? new Date(new Date(slot.start).getTime() + 90 * 60000).toISOString();
}

export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  return `${day} at ${time}`;
}

/** The ChatGPT request: try each place in order for the exact time. */
export function chatgptPrompt(places: ShortPlace[], slot: Slot) {
  const d = new Date(slot.start);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  const list = places.map((p, i) => `${i + 1}. ${p.name}${p.address ? ` (${p.address})` : ''}`).join('\n');
  return (
    `Book a table for 2 on ${day} at ${time}, using Resy or OpenTable. ` +
    `Try these restaurants in this order and book the first one that has ${time} available:\n${list}\n` +
    `If none has ${time}, show me the closest times at each.`
  );
}

// ---- The inviter's Google Calendar event ---------------------------------

function heldDescription(inviteUrl: string) {
  return `Table being booked now. You'll get the restaurant here as soon as it's confirmed.\n\n${inviteUrl}\n\nVia JustKetchup`;
}

/**
 * Holds the time in the inviter's calendar with the friend as a guest. Google
 * emails the friend the invite now and every update later. Creates the event,
 * or moves the existing one if the friend changed the time.
 */
export async function holdTimeWithGuest(invite: {
  id: string;
  user_id: string;
  calendar_event_id: string | null;
}, opts: { contactName: string; inviterName: string; email: string; slot: Slot; inviteUrl: string }) {
  const accessToken = await accessTokenForUser(invite.user_id);
  if (!accessToken) throw new Error('inviter_calendar_not_connected');
  const ev = {
    summary: `Ketchup: ${opts.inviterName} & ${opts.contactName}`,
    location: 'Restaurant being booked',
    description: heldDescription(opts.inviteUrl),
    start: opts.slot.start,
    end: slotEnd(opts.slot),
    attendees: [opts.email],
  };
  if (invite.calendar_event_id) {
    try {
      await updateEvent(accessToken, invite.calendar_event_id, ev);
      return invite.calendar_event_id;
    } catch (e: any) {
      console.warn('[booking] could not update held event, creating a new one', e?.message ?? e);
    }
  }
  const id = await createEvent(accessToken, ev);
  await supabaseAdmin.from('invites').update({ calendar_event_id: id }).eq('id', invite.id);
  return id;
}

// ---- Finding the booking ----------------------------------------------------

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|restaurant|nyc|brooklyn|bar|cafe)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Words that say nothing about which restaurant it is.
const GENERIC = new Set(
  'a an and at for of on in to with by reservation reservations table dinner lunch brunch party guests people resy opentable confirmed nyc ny new york kitchen house grill bistro eatery'.split(' ')
);

function tokens(s: string): string[] {
  return norm(s).split(' ').filter((t) => t && !GENERIC.has(t));
}

/** Does this event look like a restaurant reservation? */
export function looksLikeReservation(ev: RawEvent): boolean {
  return Boolean(ev.fromGmail) || /reservation|resy|opentable|table for \d/i.test(`${ev.summary} ${ev.description}`);
}

/**
 * Which shortlisted place an event is for. Names often differ between Google
 * Maps and Resy/OpenTable ("Top Thai 55 Carmine" vs "Top Thai Vintage"), so
 * this scores shared words rather than requiring the exact name.
 */
export function matchEvent(ev: RawEvent, places: ShortPlace[]): ShortPlace | null {
  const evText = `${ev.summary} ${ev.location}`;
  const evTokens = new Set(tokens(evText));
  let best: { p: ShortPlace; score: number } | null = null;
  for (const p of places) {
    const pt = Array.from(new Set(tokens(p.name)));
    if (pt.length === 0) continue;
    const shared = pt.filter((t) => evTokens.has(t)).length;
    const exact = ` ${norm(evText)} `.includes(` ${norm(p.name)} `);
    const score = exact ? 100 : shared;
    if (score > (best?.score ?? 0)) best = { p, score };
  }
  if (!best) return null;
  // Two shared words ("top thai"), or every word when the name is a single word.
  const needed = Math.min(2, tokens(best.p.name).length);
  return best.score >= needed ? best.p : null;
}

/**
 * Looks in the inviter's Google Calendar for a reservation at one of the
 * shortlisted places on the meetup day (Gmail adds Resy/OpenTable
 * confirmation emails to Google Calendar). Returns the place and the event.
 */
export async function findBooking(invite: {
  user_id: string;
  chosen_slot: Slot;
  shortlist: ShortPlace[];
  calendar_event_id: string | null;
}): Promise<{ place: ShortPlace; event: RawEvent } | null> {
  const accessToken = await accessTokenForUser(invite.user_id);
  if (!accessToken) return null;
  const t = new Date(invite.chosen_slot.start).getTime();
  const events = await listRawEvents(
    accessToken,
    new Date(t - 6 * HOUR).toISOString(),
    new Date(t + 6 * HOUR).toISOString()
  );
  const candidates = events.filter((ev) => ev.id !== invite.calendar_event_id); // skip our own held event
  // 1. A shortlisted place, by name.
  for (const ev of candidates) {
    const place = matchEvent(ev, invite.shortlist ?? []);
    if (place && (looksLikeReservation(ev) || Math.abs(new Date(ev.start).getTime() - t) <= 2 * HOUR)) {
      return { place, event: ev };
    }
  }
  // 2. One reservation within two hours of the time that isn't on the
  //    shortlist (ChatGPT booked somewhere else): use it as it is.
  const resv = candidates.filter(
    (ev) => looksLikeReservation(ev) && Math.abs(new Date(ev.start).getTime() - t) <= 2 * HOUR
  );
  if (resv.length === 1) {
    const ev = resv[0];
    const name = ev.location || ev.summary.replace(/^reservation (at|for)\s+/i, '');
    return {
      place: { id: `gcal:${ev.id}`, name, address: '', mapsUri: null, rating: 0, reviews: 0, priceLevel: null, reservable: true },
      event: ev,
    };
  }
  return null;
}

/**
 * Marks the invite booked and fills in the held calendar event with the
 * restaurant. The friend, as a guest, gets Google's "Updated invitation" email.
 * `atStart` moves the time if the reservation landed at a different time.
 */
export async function finalizeBooking(
  invite: {
    id: string;
    user_id: string;
    contact_id: string;
    token: string;
    chosen_slot: Slot;
    calendar_event_id: string | null;
    friend_email: string | null;
  },
  place: ShortPlace,
  opts: { atStart?: string; origin: string }
) {
  const start = opts.atStart ?? invite.chosen_slot.start;
  const slot = { start, end: new Date(new Date(start).getTime() + 90 * 60000).toISOString() };

  // The restaurant must exist in venue_cache before the invite can point at it.
  const { error: cacheErr } = await supabaseAdmin.from('venue_cache').upsert(
    {
      place_id: place.id,
      name: place.name,
      address: place.address,
      rating: place.rating,
      reviews: place.reviews,
      price_level: place.priceLevel,
      maps_uri: place.mapsUri,
      reservable: place.reservable,
      cached_at: new Date().toISOString(),
    },
    { onConflict: 'place_id' }
  );
  if (cacheErr) throw new Error(`venue_cache: ${cacheErr.message}`);

  const { error: invErr } = await supabaseAdmin
    .from('invites')
    .update({
      status: 'confirmed',
      chosen_place_id: place.id,
      chosen_slot: slot,
      booked_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    })
    .eq('id', invite.id);
  if (invErr) throw new Error(`invite: ${invErr.message}`);

  const [{ data: contact }, { data: inviter }] = await Promise.all([
    supabaseAdmin.from('contacts').select('name, tier').eq('id', invite.contact_id).maybeSingle(),
    supabaseAdmin.from('users').select('name').eq('id', invite.user_id).maybeSingle(),
  ]);

  // Calendar: the held event becomes the real one, and the friend is told.
  try {
    const accessToken = await accessTokenForUser(invite.user_id);
    if (accessToken) {
      const ev = {
        summary: `Ketchup at ${place.name}: ${(inviter?.name ?? '').split(' ')[0]} & ${(contact?.name ?? '').split(' ')[0]}`,
        location: [place.name, place.address].filter(Boolean).join(', '),
        description:
          `Table booked for 2.` +
          (place.mapsUri ? `\n\nDirections: ${place.mapsUri}` : '') +
          `\n\n${opts.origin}/m/${invite.token}\n\nVia JustKetchup`,
        start: slot.start,
        end: slot.end,
        attendees: invite.friend_email ? [invite.friend_email] : undefined,
      };
      if (invite.calendar_event_id) await updateEvent(accessToken, invite.calendar_event_id, ev);
      else {
        const id = await createEvent(accessToken, ev);
        await supabaseAdmin.from('invites').update({ calendar_event_id: id }).eq('id', invite.id);
      }
    }
  } catch (e: any) {
    console.error('[booking] calendar update failed', e?.message ?? e);
  }

  // Restart the nudge clock from the meetup date.
  const days = ({ warm: 30, friendly: 90, keep_warm: 180 } as Record<string, number>)[contact?.tier ?? 'friendly'] ?? 90;
  const meet = new Date(slot.start);
  await supabaseAdmin
    .from('contacts')
    .update({
      last_interaction_date: meet.toISOString().slice(0, 10),
      next_nudge_date: new Date(meet.getTime() + days * 86400000).toISOString().slice(0, 10),
    })
    .eq('id', invite.contact_id);
}

export const INVITE_COLUMNS =
  'id, token, user_id, contact_id, status, slots, chosen_slot, chosen_place_id, calendar_event_id, friend_email, shortlist, expires_at, booked_at';
