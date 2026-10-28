// Live venue discovery via Google Places API (New).
//
// Deliberately NOT a curated list: in a city like New York the whole appeal is
// trying somewhere new, and a hand-maintained table goes stale immediately.
//
// Billing note: rating, userRatingCount and priceLevel all sit in Google's
// Enterprise field group, so every call here bills at the Enterprise rate
// (~$35/1000, 1000 free per month). Results are cached by the caller so a
// page reload doesn't spend another call.

export type Coords = { lat: number; lng: number };

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviews: number;
  priceLevel: string | null;
  types: string[];
  mapsUri: string | null;
  /** Google's "takes reservations" flag. null = Google doesn't know. */
  reservable: boolean | null;
  /** Weekly opening hours from Google; empty when Google has none. */
  periods: Period[];
};

type HM = { day: number; hour: number; minute: number };
export type Period = { open: HM; close?: HM };


const MIN_RATING = 4.5;
const MIN_REVIEWS = 500;

// Google gives relative bands, not per-person dollars. These two are the
// practical stand-in for "under about $50 a head" in a US city.
const AFFORDABLE = new Set(['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE']);

const CUISINE_TYPES: Record<string, string> = {
  italian: 'italian_restaurant',
  japanese: 'japanese_restaurant',
  indian: 'indian_restaurant',
  mexican: 'mexican_restaurant',
  middle_eastern: 'middle_eastern_restaurant',
  mediterranean: 'mediterranean_restaurant',
  french: 'french_restaurant',
  american: 'american_restaurant',
  thai: 'thai_restaurant',
  chinese: 'chinese_restaurant',
  korean: 'korean_restaurant',
  greek: 'greek_restaurant',
  spanish: 'spanish_restaurant',
  vietnamese: 'vietnamese_restaurant',
  cafe: 'cafe',
};

const DIETARY_TYPES: Record<string, string> = {
  vegan: 'vegan_restaurant',
  vegetarian: 'vegetarian_restaurant',
};

// "No pork" / "No shellfish": Google has no menu data, so we leave out places
// whose type or name shows they're built around it (seafood restaurants,
// oyster bars, BBQ and pork spots). It can't catch one dish on a menu.
const NO_SHELLFISH_TYPES = ['seafood_restaurant'];
const NO_SHELLFISH_NAME = /\b(oysters?|lobsters?|crabs?|clams?|shrimp|seafood|shellfish|mussels?|crawfish|fish market|raw bar|poke)\b/i;
const NO_PORK_TYPES = ['barbecue_restaurant'];
const NO_PORK_NAME = /\b(bbq|barbecue|barbeque|pork|porchetta|bacon|carnitas|al pastor|charcuterie|salumeria|smokehouse|lechon)\b/i;

export function excludedFor(p: { name: string; types: string[] }, dietary: string[]): boolean {
  const noPork = dietary.includes('no_pork') || dietary.includes('halal');
  const noShellfish = dietary.includes('no_shellfish');
  if (noShellfish && (p.types.some((t) => NO_SHELLFISH_TYPES.includes(t)) || NO_SHELLFISH_NAME.test(p.name))) return true;
  if (noPork && (p.types.some((t) => NO_PORK_TYPES.includes(t)) || NO_PORK_NAME.test(p.name))) return true;
  return false;
}

export function midpoint(a: Coords, b: Coords): Coords {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function kmBetween(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// Google's Places API occasionally answers 500/503 ("Internal server error.
// Please retry") or 429; the identical request succeeds moments later. Retry
// those a couple of times before giving up. Other errors (400, 403) are real
// problems with the request or key and fail immediately.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let res = await fetch(url, init);
  for (let i = 1; i < attempts && (res.status >= 500 || res.status === 429); i++) {
    await new Promise((r) => setTimeout(r, 400 * i));
    res = await fetch(url, init);
  }
  return res;
}

async function nearby(centre: Coords, radiusM: number, includedTypes: string[]): Promise<Place[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');

  const res = await fetchWithRetry('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.types',
        'places.googleMapsUri',
        'places.reservable',
        'places.regularOpeningHours.periods',
      ].join(','),
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: { center: { latitude: centre.lat, longitude: centre.lng }, radius: radiusM },
      },
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text ?? 'Unnamed',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? 0,
    reviews: p.userRatingCount ?? 0,
    priceLevel: p.priceLevel ?? null,
    types: p.types ?? [],
    mapsUri: p.googleMapsUri ?? null,
    reservable: typeof p.reservable === 'boolean' ? p.reservable : null,
    periods: (p.regularOpeningHours?.periods ?? []) as Period[],
  }));
}

const WEEK = 7 * 1440;

// Minute of the week (Sunday 00:00 = 0) for an instant, in the city's time zone.
function minuteOfWeek(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.filter((x) => x.type === t)[0]?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return day * 1440 + Number(get('hour')) * 60 + Number(get('minute'));
}

/**
 * Is the place open for the whole meetup? true / false, or null when Google
 * has no hours for it (unknown places are kept rather than dropped).
 */
export function openDuring(periods: Period[], startIso: string, endIso: string, tz: string): boolean | null {
  if (!periods || periods.length === 0) return null;
  // A single period with no close time means open 24/7.
  if (periods.length === 1 && !periods[0].close) return true;
  const s = minuteOfWeek(startIso, tz);
  let e = minuteOfWeek(endIso, tz);
  if (e < s) e += WEEK;
  for (const p of periods) {
    if (!p.close) continue;
    const o = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let c = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
    if (c <= o) c += WEEK; // closes after midnight Saturday → wraps the week
    for (const shift of [0, WEEK, -WEEK]) {
      if (s + shift >= o && e + shift <= c) return true;
    }
  }
  return false;
}

/**
 * Find spots between two people.
 *
 * Criteria, in Manasi's words:
 *  1. roughly midway between both
 *  2. Google rating above 4.5
 *  3. more than 500 reviews
 *  4. matches cuisine and dietary preferences
 *  5. under roughly $50 a head
 *
 * Dietary is a hard filter — vegan means vegan, not "mostly vegan".
 * Cuisine is used to pick which Google types we ask for, then to rank.
 * The radius widens if strict filtering leaves too little to choose from.
 */
export type SpotResult = {
  places: Place[];
  /** How many distinct places Google returned before any filtering. */
  fetched: number;
  /** How many survived the rating / reviews / price filters. */
  qualifying: number;
};

export async function findSpots(
  a: Coords,
  b: Coords,
  opts: {
    dietary?: string[];
    cuisines?: string[];
    limit?: number;
    /** The meetup time: only places open for all of it are suggested. */
    at?: { start: string; end: string; tz: string };
  } = {}
): Promise<SpotResult> {
  const dietary = opts.dietary ?? [];
  const cuisines = opts.cuisines ?? [];
  const limit = opts.limit ?? 3;

  const centre = midpoint(a, b);

  const dietaryTypes = dietary.map((d) => DIETARY_TYPES[d]).filter(Boolean);
  const cuisineTypes = cuisines.map((c) => CUISINE_TYPES[c]).filter(Boolean);

  const includedTypes =
    dietaryTypes.length > 0
      ? dietaryTypes
      : cuisineTypes.length > 0
        ? cuisineTypes
        : ['restaurant', 'cafe'];

  const seen = new Map<string, Place>();

  // Hard filters on top of the quality bar:
  //  - open for the whole meetup, if Google has hours for the place
  //  - not a walk-in-only place (Google says it doesn't take reservations)
  const at = opts.at;
  const usable = (p: Place) =>
    p.reservable !== false &&
    !excludedFor(p, dietary) &&
    (!at || openDuring(p.periods, at.start, at.end, at.tz) !== false);

  const RADII = [1500, 3000, 5000];
  for (let i = 0; i < RADII.length; i++) {
    let batch: Place[] = [];
    try {
      batch = await nearby(centre, RADII[i], includedTypes);
    } catch (e) {
      // The FIRST call failing means the request itself is broken — bad key,
      // API not enabled, billing off. That must surface, not masquerade as
      // "no restaurants nearby". Widening afterwards is best-effort.
      if (i === 0) throw e;
      break;
    }
    for (const p of batch) seen.set(p.id, p);

    const qualifying = Array.from(seen.values()).filter(
      (p) =>
        usable(p) &&
        p.rating >= MIN_RATING &&
        p.reviews >= MIN_REVIEWS &&
        (p.priceLevel === null || AFFORDABLE.has(p.priceLevel))
    );
    if (qualifying.length >= limit) break;
  }

  let pool = Array.from(seen.values()).filter(
    (p) =>
      usable(p) &&
      p.rating >= MIN_RATING &&
      p.reviews >= MIN_REVIEWS &&
      (p.priceLevel === null || AFFORDABLE.has(p.priceLevel))
  );

  // If strict criteria leave nothing, relax review count before rating —
  // a 4.7 with 300 reviews is a better suggestion than a 4.2 with 2000.
  if (pool.length === 0) {
    pool = Array.from(seen.values()).filter(
      (p) => usable(p) && p.rating >= MIN_RATING && (p.priceLevel === null || AFFORDABLE.has(p.priceLevel))
    );
  }

  const scored = pool.map((p) => {
    const dA = kmBetween(a, p);
    const dB = kmBetween(b, p);
    // Fairness matters as much as proximity: 5km each beats 1km and 9km.
    const imbalance = Math.abs(dA - dB);
    const cuisineHit = cuisineTypes.some((t) => p.types.includes(t)) ? 1 : 0;

    const score =
      kmBetween(centre, p) * 1.0 +
      imbalance * 0.8 -
      (p.rating - MIN_RATING) * 4 -
      Math.min(p.reviews / 2000, 1) * 1.5 -
      cuisineHit * 2 -
      // Confirmed bookable beats "Google doesn't know".
      (p.reservable === true ? 1.5 : 0);

    return { p, score };
  });

  scored.sort((x, y) => x.score - y.score);

  return {
    places: scored.slice(0, limit).map((x) => x.p),
    fetched: seen.size,
    qualifying: pool.length,
  };
}
