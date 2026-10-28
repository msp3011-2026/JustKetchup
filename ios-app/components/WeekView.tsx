import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export type Slot = { start: string; end: string; friendBusy?: boolean };
export type CalEvent = { start: string; end: string; title: string; allDay: boolean };

type Props = {
  slots: Slot[];
  events: CalEvent[];
  picked: string[];
  onToggle: (start: string) => void;
  friendName: string;
  /** Monday of this week, YYYY-MM-DD, from the server (user's time zone). */
  firstDay?: string;
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function dayLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// All-day events arrive as a date with no time zone ("2026-11-02T00:00:00");
// treat them as local dates, and timed events as instants.
function eventDays(e: CalEvent): string[] {
  const start = new Date(e.start);
  const end = new Date(e.end);
  const keys: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  // An all-day event's end date is exclusive; a timed event counts on the day it starts.
  const last = e.allDay ? new Date(end.getTime() - 1) : start;
  while (d <= last && keys.length < 14) {
    keys.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

/**
 * Two weeks, one at a time, laid out day by day: your existing events in grey
 * and the suggested free times you can tick, in time order. Seeing the whole
 * week makes it easier to judge which evenings you'd actually want to give up.
 */
export default function WeekView({ slots, events, picked, onToggle, friendName, firstDay }: Props) {
  const [week, setWeek] = useState(0);

  // Calendar weeks, Monday to Sunday: this week and next.
  const days = useMemo(() => {
    let monday: Date;
    if (firstDay) {
      const [y, m, d] = firstDay.split('-').map(Number);
      monday = new Date(y, m - 1, d);
    } else {
      const t = new Date();
      monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
    }
    return Array.from(
      { length: 14 },
      (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    );
  }, [firstDay]);

  const todayKey = dayKey(new Date());
  const todayStart = (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  })();

  const byDay = useMemo(() => {
    const map: Record<string, { allDay: CalEvent[]; items: ({ kind: 'event'; e: CalEvent } | { kind: 'slot'; s: Slot })[] }> = {};
    for (const d of days) map[dayKey(d)] = { allDay: [], items: [] };
    for (const e of events) {
      for (const k of eventDays(e)) {
        if (!map[k]) continue;
        if (e.allDay) map[k].allDay.push(e);
        else map[k].items.push({ kind: 'event', e });
      }
    }
    for (const s of slots) {
      const k = dayKey(new Date(s.start));
      if (map[k]) map[k].items.push({ kind: 'slot', s });
    }
    for (const k of Object.keys(map)) {
      map[k].items.sort((a, b) => {
        const ta = new Date(a.kind === 'event' ? a.e.start : a.s.start).getTime();
        const tb = new Date(b.kind === 'event' ? b.e.start : b.s.start).getTime();
        return ta - tb;
      });
    }
    return map;
  }, [days, events, slots]);

  const shown = days.slice(week * 7, week * 7 + 7);

  return (
    <View>
      <View style={styles.tabs}>
        {['This week', 'Next week'].map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.tab, week === i && styles.tabOn]}
            onPress={() => setWeek(i)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, week === i && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {shown.map((d) => {
        const day = byDay[dayKey(d)];
        const empty = day.items.length === 0 && day.allDay.length === 0;
        return (
          <View key={dayKey(d)} style={styles.day}>
            <Text style={[styles.dayLabel, d.getTime() < todayStart && styles.dayPast]}>
              {dayLabel(d)}
              {dayKey(d) === todayKey ? ' · Today' : ''}
            </Text>

            {day.allDay.map((e, i) => (
              <Text key={`ad${i}`} style={styles.allDay} numberOfLines={1}>
                All day · {e.title}
              </Text>
            ))}

            {day.items.map((it, i) =>
              it.kind === 'event' ? (
                <View key={`e${i}`} style={styles.event}>
                  <Text style={styles.eventTime}>
                    {time(it.e.start)}–{time(it.e.end)}
                  </Text>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {it.e.title}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  key={it.s.start}
                  style={[
                    styles.slot,
                    picked.includes(it.s.start) && styles.slotOn,
                    it.s.friendBusy && styles.slotFriendBusy,
                  ]}
                  onPress={() => onToggle(it.s.start)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.check, picked.includes(it.s.start) && styles.checkOn]}>
                    {picked.includes(it.s.start) && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.slotTime}>{time(it.s.start)}</Text>
                  <Text style={[styles.slotNote, it.s.friendBusy && styles.slotNoteBusy]}>
                    {it.s.friendBusy ? `${friendName} is busy` : 'You’re free'}
                  </Text>
                </TouchableOpacity>
              )
            )}

            {empty && (
              <Text style={styles.nothing}>{d.getTime() < todayStart ? 'Past' : 'Nothing on'}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextOn: { color: '#fff' },
  day: { marginBottom: spacing.md, gap: 6 },
  dayPast: { opacity: 0.45 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  allDay: { fontSize: 13, color: colors.muted, backgroundColor: '#F5F5F4', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  event: { flexDirection: 'row', gap: spacing.sm, backgroundColor: '#F5F5F4', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  eventTime: { fontSize: 13, color: colors.muted, width: 128 },
  eventTitle: { flex: 1, fontSize: 14, color: colors.text },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  slotOn: { borderColor: colors.primary, borderWidth: 2 },
  slotFriendBusy: { opacity: 0.6 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  slotTime: { fontSize: 16, fontWeight: '600', color: colors.text, width: 84 },
  slotNote: { flex: 1, fontSize: 13, color: '#15803D', textAlign: 'right' },
  slotNoteBusy: { color: colors.muted },
  nothing: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
