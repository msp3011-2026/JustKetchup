import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getContact, type Contact } from '../../lib/contacts';
import { api } from '../../lib/api';
import { signInWithGoogle } from '../../lib/googleAuth';
import { colors, spacing } from '../../lib/theme';
import WeekView, { type CalEvent, type Slot } from '../../components/WeekView';

const MAX_PICK = 4;

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

// Short and warm: it is sent from Manasi's own WhatsApp, in her voice.
function draftMessage(firstName: string, url: string) {
  return `Hey ${firstName}! How have you been? It's been way too long, I'd love to catch up. I'm using JustKetchup to make the logistics easier, so just pick a time and a spot that works for you here:\n\n${url}`;
}

function whatsappUrl(phoneE164: string, text: string) {
  const digits = phoneE164.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 56 }} />
    </View>
  );
}

export default function NewInvite() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [friend, setFriend] = useState<{ usesApp: boolean; calendarChecked: boolean }>({ usesApp: false, calendarChecked: false });
  const [picked, setPicked] = useState<string[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const first = (contact?.name ?? '').split(' ')[0] || 'them';

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([
        getContact(String(contactId)),
        api<{
          connected: boolean;
          slots: Slot[];
          events?: CalEvent[];
          friend?: { usesApp: boolean; calendarChecked: boolean };
          error?: string;
        }>(`/api/me/slots?contactId=${encodeURIComponent(String(contactId))}`),
      ]);
      setContact(c);
      setSlots(s.slots ?? []);
      setEvents(s.events ?? []);
      setFriend(s.friend ?? { usesApp: false, calendarChecked: false });
      setConnected(Boolean(s.connected));
      // Pre-tick the first few times that work for both of you.
      setPicked((s.slots ?? []).filter((x) => !x.friendBusy).slice(0, 3).map((x) => x.start));
    } catch (e: any) {
      setLoadError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [contactId]);

  function toggle(start: string) {
    setPicked((p) => {
      if (p.includes(start)) return p.filter((x) => x !== start);
      if (p.length >= MAX_PICK) {
        Alert.alert('That’s plenty', `Offer up to ${MAX_PICK} times so it’s an easy choice.`);
        return p;
      }
      return [...p, start];
    });
  }

  async function connectCalendar() {
    try {
      const ok = await signInWithGoogle();
      if (ok) await load();
    } catch (e: any) {
      Alert.alert('Could not connect Google Calendar', e?.message ?? String(e));
    }
  }

  async function send() {
    if (!contact) return;
    if (picked.length === 0) return Alert.alert('Pick a time', 'Choose at least one time to offer.');
    setSending(true);
    try {
      const chosen = slots.filter((s) => picked.includes(s.start));
      const { url } = await api<{ url: string }>('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ contactId: contact.id, slots: chosen }),
      });
      await Linking.openURL(whatsappUrl(contact.phone, draftMessage(first, url)));
      router.replace(`/contacts/${contact.id}`);
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Checking your calendar…</Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text style={styles.h2}>Couldn’t load your free times</Text>
        <Text style={styles.error}>{loadError}</Text>
        <TouchableOpacity style={styles.button} onPress={load}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={`Ketchup with ${first}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        {connected === false && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Google Calendar isn’t connected, so these are general suggestions, not checked against your calendar.
            </Text>
            <TouchableOpacity onPress={connectCalendar}>
              <Text style={styles.link}>Connect Google Calendar</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.h2}>When are you free?</Text>
        <Text style={styles.muted}>
          {friend.calendarChecked
            ? `Checked against your calendar and ${first}'s. `
            : connected
              ? 'Your week from Google Calendar. '
              : ''}
          Tick up to {MAX_PICK} times to offer {first}.
        </Text>

        <View style={styles.list}>
          <WeekView slots={slots} events={events} picked={picked} onToggle={toggle} friendName={first} />
          {slots.length === 0 && (
            <Text style={styles.muted}>Your calendar is full for the next two weeks.</Text>
          )}
        </View>

        <Text style={styles.h2}>Your message</Text>
        <Text style={styles.muted}>WhatsApp opens with this already typed. Change anything before you send.</Text>
        <View style={styles.preview}>
          <Text style={styles.previewText}>{draftMessage(first, 'justketchup.vercel.app/m/…')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.whatsapp, (sending || picked.length === 0) && styles.buttonDisabled]}
          onPress={send}
          disabled={sending || picked.length === 0}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send on WhatsApp</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 17, color: colors.primary, fontWeight: '600', width: 56 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.bg },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  muted: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  error: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  notice: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  noticeText: { fontSize: 14, color: colors.text },
  link: { fontSize: 15, fontWeight: '700', color: colors.primary },
  list: { gap: spacing.sm, marginBottom: spacing.lg },
  slot: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: spacing.md,
  },
  slotOn: { borderColor: colors.primary },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  slotDay: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '600' },
  slotTime: { fontSize: 16, color: colors.muted },
  preview: { backgroundColor: '#DCF8C6', borderRadius: 14, padding: spacing.md },
  previewText: { fontSize: 15, color: '#111', lineHeight: 21 },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.bg },
  button: { backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: spacing.lg, borderRadius: 14, alignItems: 'center' },
  whatsapp: { backgroundColor: '#25D366' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
