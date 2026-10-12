'use client';

import { useEffect, useState } from 'react';

type Slot = { start: string; end?: string };
type Hood = { id: string; name: string };
type Place = {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviews: number;
  priceLevel: string | null;
  mapsUri: string | null;
};

const DIETARY = [
  { v: 'vegetarian', label: 'Vegetarian' },
  { v: 'vegan', label: 'Vegan' },
  { v: 'halal', label: 'Halal' },
  { v: 'gluten_free', label: 'Gluten free' },
];

const CUISINES = [
  { v: 'italian', label: 'Italian' },
  { v: 'japanese', label: 'Japanese' },
  { v: 'indian', label: 'Indian' },
  { v: 'mexican', label: 'Mexican' },
  { v: 'thai', label: 'Thai' },
  { v: 'chinese', label: 'Chinese' },
  { v: 'korean', label: 'Korean' },
  { v: 'middle_eastern', label: 'Middle Eastern' },
  { v: 'mediterranean', label: 'Mediterranean' },
  { v: 'french', label: 'French' },
  { v: 'american', label: 'American' },
  { v: 'cafe', label: 'Coffee / cafe' },
];

const PRICE_LABEL: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

function fmtSlot(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function icsFor(slot: Slot, placeName: string, withWhom: string) {
  const start = new Date(slot.start);
  const end = slot.end ? new Date(slot.end) : new Date(start.getTime() + 90 * 60000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JustKetchup//EN', 'BEGIN:VEVENT',
    `UID:${Date.now()}@justketchup`, `DTSTAMP:${z(new Date())}`,
    `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
    `SUMMARY:Catching up with ${withWhom}`, `LOCATION:${placeName}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export default function InviteFlow({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'hello' | 'details' | 'time' | 'place' | 'done'>('hello');

  const [inviterName, setInviterName] = useState('');
  const [contactName, setContactName] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hoods, setHoods] = useState<Hood[]>([]);

  const [hoodId, setHoodId] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [known, setKnown] = useState(false);

  const [places, setPlaces] = useState<Place[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/invite/${token}`);
        const d = await r.json();
        if (!r.ok) {
          setErr(
            d.error === 'expired'
              ? 'This invite has expired — ask your friend to send a new one.'
              : "We couldn't find this invite. Check the link and try again."
          );
          return;
        }
        setInviterName(d.inviterName);
        setContactName(d.contactName);
        setSlots(d.slots ?? []);
        setHoods(d.neighborhoods ?? []);
        if (d.savedProfile?.neighborhood_id) {
          setKnown(true);
          setHoodId(d.savedProfile.neighborhood_id);
          setDietary(d.savedProfile.dietary ?? []);
          setCuisines(d.savedProfile.cuisines ?? []);
        }
      } catch {
        setErr('Something went wrong loading this invite.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  // Returning guests skip straight to picking a time — their saved details
  // show as an editable summary rather than a question they must re-answer.
  function start() {
    setStep(known ? 'time' : 'details');
  }

  async function loadPlaces(next: Slot) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/invite/${token}/venues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neighborhoodId: hoodId, dietary, cuisines }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr("We couldn't load suggestions just now. Please try again in a moment.");
        return;
      }
      setPlaces(d.venues ?? []);
      setSlot(next);
      setStep('place');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(p: Place) {
    if (!slot) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/invite/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, placeId: p.id }),
      });
      if (r.ok) {
        setPlace(p);
        setStep('done');
      } else {
        setErr("We couldn't confirm that. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function downloadIcs() {
    if (!slot || !place) return;
    const blob = new Blob([icsFor(slot, place.name, inviterName)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'justketchup.ics';
    a.click();
  }

  const hoodName = hoods.find((h) => h.id === hoodId)?.name;

  const summary = [
    hoodName,
    ...dietary.map((d) => DIETARY.find((x) => x.v === d)?.label),
    ...cuisines.map((c) => CUISINES.find((x) => x.v === c)?.label),
  ].filter(Boolean).join(' · ');

  if (loading) return <Shell><p style={s.muted}>One moment…</p></Shell>;
  if (err && step === 'hello') return <Shell><h1 style={s.h1}>Hmm.</h1><p style={s.body}>{err}</p></Shell>;

  return (
    <Shell>
      {step === 'hello' && (
        <>
          <p style={s.kicker}>JustKetchup</p>
          <h1 style={s.h1}>
            {contactName ? `Hi ${contactName}! ` : 'Hi! '}{inviterName} would love to see you.
          </h1>
          <p style={s.body}>
            It&apos;s been a while, and {inviterName} wants to properly catch up — not a quick
            text, an actual sit-down. Pick a time that suits you and somewhere you&apos;d like
            to go, and we&apos;ll sort out the rest.
          </p>
          <p style={s.body}>Takes about thirty seconds.</p>
          <button style={s.btn} onClick={start}>Let&apos;s do it</button>
        </>
      )}

      {step === 'details' && (
        <>
          <h2 style={s.h2}>Where are you these days?</h2>
          <p style={s.body}>
            So we can suggest somewhere roughly midway between you both, rather than making one
            of you trek across town.
          </p>
          <select style={s.select} value={hoodId} onChange={(e) => setHoodId(e.target.value)}>
            <option value="">Choose your neighborhood…</option>
            {hoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <h3 style={s.h3}>Anything we should know about food?</h3>
          <div style={s.chips}>
            {DIETARY.map((d) => (
              <Chip key={d.v} on={dietary.includes(d.v)} onClick={() => toggle(dietary, setDietary, d.v)}>{d.label}</Chip>
            ))}
          </div>

          <h3 style={s.h3}>Anything you particularly fancy?</h3>
          <div style={s.chips}>
            {CUISINES.map((c) => (
              <Chip key={c.v} on={cuisines.includes(c.v)} onClick={() => toggle(cuisines, setCuisines, c.v)}>{c.label}</Chip>
            ))}
          </div>

          <button
            style={{ ...s.btn, opacity: hoodId ? 1 : 0.5 }}
            disabled={!hoodId}
            onClick={() => setStep('time')}
          >
            Next
          </button>
        </>
      )}

      {step === 'time' && (
        <>
          <h2 style={s.h2}>When works for you?</h2>
          <p style={s.body}>These are the times {inviterName} is free.</p>

          {summary && (
            <div style={s.summary}>
              <span style={s.summaryText}>{summary}</span>
              <button style={s.editLink} onClick={() => setStep('details')}>Edit</button>
            </div>
          )}

          {slots.map((sl) => {
            const f = fmtSlot(sl.start);
            return (
              <button key={sl.start} style={s.option} disabled={busy} onClick={() => loadPlaces(sl)}>
                <span style={s.optionMain}>{f.day}</span>
                <span style={s.optionSub}>{f.time}</span>
              </button>
            );
          })}
          {busy && <p style={s.muted}>Finding places you&apos;ll both like…</p>}
          {err && <p style={s.error}>{err}</p>}
          <p style={s.fine}>None of these work? Reply to {inviterName}&apos;s message and say so.</p>
        </>
      )}

      {step === 'place' && (
        <>
          <h2 style={s.h2}>Where would you like to go?</h2>
          <p style={s.body}>
            Well-reviewed spots roughly between you and {inviterName}
            {dietary.length > 0 && ', that work with what you eat'}.
          </p>
          {places.map((p) => (
            <button key={p.id} style={s.option} disabled={busy} onClick={() => confirm(p)}>
              <span style={s.optionMain}>{p.name}</span>
              <span style={s.optionSub}>
                ★ {p.rating} · {p.reviews.toLocaleString()} reviews
                {p.priceLevel && ` · ${PRICE_LABEL[p.priceLevel] ?? ''}`}
              </span>
              <span style={s.optionAddr}>{p.address}</span>
            </button>
          ))}
          {places.length === 0 && (
            <>
              <p style={s.muted}>Nothing matched all your filters nearby.</p>
              <button style={s.btnGhost} onClick={() => setStep('details')}>Try fewer filters</button>
            </>
          )}
          {err && <p style={s.error}>{err}</p>}
        </>
      )}

      {step === 'done' && slot && place && (
        <>
          <p style={s.kicker}>You&apos;re all set</p>
          <h1 style={s.h1}>See you at {place.name}.</h1>
          <p style={s.body}>
            {fmtSlot(slot.start).day} at {fmtSlot(slot.start).time}. We&apos;ve let {inviterName} know.
          </p>
          <p style={s.muted}>{place.address}</p>
          <button style={s.btn} onClick={downloadIcs}>Add to my calendar</button>
          {place.mapsUri && (
            <a style={s.btnGhost} href={place.mapsUri} target="_blank" rel="noreferrer">
              View on Google Maps
            </a>
          )}
          <p style={s.fine}>Have a lovely time.</p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={s.page}><div style={s.card}>{children}</div></div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ ...s.chip, background: on ? '#EA580C' : '#fff', color: on ? '#fff' : '#1C1917', borderColor: on ? '#EA580C' : '#E7E5E4' }}
    >
      {children}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#FFF7ED', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  card: { maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #E7E5E4', padding: '28px 24px' },
  kicker: { fontSize: 13, fontWeight: 600, color: '#EA580C', margin: '0 0 12px', letterSpacing: 0.3 },
  h1: { fontSize: 26, lineHeight: 1.25, margin: '0 0 16px', color: '#1C1917' },
  h2: { fontSize: 22, lineHeight: 1.3, margin: '0 0 12px', color: '#1C1917' },
  h3: { fontSize: 15, margin: '24px 0 10px', color: '#1C1917' },
  body: { fontSize: 16, lineHeight: 1.6, color: '#57534E', margin: '0 0 16px' },
  muted: { fontSize: 14, color: '#78716C', margin: '8px 0' },
  error: { fontSize: 14, color: '#DC2626', margin: '8px 0' },
  summary: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFF7ED', border: '1px solid #E7E5E4', borderRadius: 10, padding: '10px 12px', marginBottom: 18 },
  summaryText: { flex: 1, fontSize: 13, color: '#57534E', lineHeight: 1.4 },
  editLink: { background: 'none', border: 'none', color: '#EA580C', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 },
  fine: { fontSize: 13, color: '#78716C', marginTop: 16, textAlign: 'center' },
  select: { width: '100%', padding: '13px 12px', fontSize: 16, borderRadius: 10, border: '1px solid #E7E5E4', background: '#fff', color: '#1C1917' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '9px 14px', borderRadius: 999, border: '1px solid', fontSize: 14, cursor: 'pointer' },
  option: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10, borderRadius: 12, border: '1px solid #E7E5E4', background: '#fff', cursor: 'pointer' },
  optionMain: { fontSize: 16, fontWeight: 600, color: '#1C1917' },
  optionSub: { fontSize: 13, color: '#78716C', marginTop: 3 },
  optionAddr: { fontSize: 12, color: '#A8A29E', marginTop: 4 },
  btn: { width: '100%', padding: '15px', fontSize: 16, fontWeight: 600, color: '#fff', background: '#EA580C', border: 'none', borderRadius: 12, cursor: 'pointer', marginTop: 20 },
  btnGhost: { display: 'block', width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, color: '#57534E', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 8, textAlign: 'center', textDecoration: 'none' },
};
