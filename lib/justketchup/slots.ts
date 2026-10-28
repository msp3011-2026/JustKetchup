import type { Interval } from './google';

// Suggested meetup times: weekday evenings and weekend lunch/dinner, in the
// user's own time zone, for the next two weeks starting tomorrow.

const DAY_MS = 86400000;
const LENGTH_MIN = 90;

// Minutes that `tz` is ahead of UTC at the given instant.
function tzOffsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.filter((p) => p.type === t)[0]?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

// The UTC instant for a wall-clock time in `tz`.
export function zonedTime(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  let guess = Date.UTC(y, m, d, h, min);
  guess -= tzOffsetMinutes(guess, tz) * 60000;
  // Second pass corrects for DST changes between the guess and the answer.
  const fixed = Date.UTC(y, m, d, h, min) - tzOffsetMinutes(guess, tz) * 60000;
  return new Date(fixed);
}

function localDate(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => parts.filter((p) => p.type === t)[0]?.value ?? '';
  return { y: Number(get('year')), m: Number(get('month')) - 1, d: Number(get('day')), weekday: get('weekday') };
}

export function candidateSlots(tz: string, now = Date.now(), days = 14): Interval[] {
  const out: Interval[] = [];
  for (let i = 1; i <= days; i++) {
    const day = localDate(now + i * DAY_MS, tz);
    const weekend = day.weekday === 'Sat' || day.weekday === 'Sun';
    const hours = weekend ? [12, 18.5] : [19];
    for (let k = 0; k < hours.length; k++) {
      const h = Math.floor(hours[k]);
      const min = Math.round((hours[k] - h) * 60);
      const start = zonedTime(day.y, day.m, day.d, h, min, tz);
      const end = new Date(start.getTime() + LENGTH_MIN * 60000);
      out.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }
  return out;
}

export function removeBusy(slots: Interval[], busy: Interval[], bufferMin = 30): Interval[] {
  const buf = bufferMin * 60000;
  return slots.filter((s) => {
    const a = new Date(s.start).getTime() - buf;
    const b = new Date(s.end).getTime() + buf;
    return !busy.some((x) => new Date(x.start).getTime() < b && new Date(x.end).getTime() > a);
  });
}
