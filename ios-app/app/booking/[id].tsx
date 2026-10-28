import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { colors, spacing } from '../../lib/theme';

type Place = { id: string; name: string; address: string; rating: number; reviews: number };
type Invite = {
  id: string;
  status: string;
  contactName: string;
  slot: { start: string } | null;
  shortlist: Place[];
  booked: { name: string; address: string | null } | null;
  friendEmail: string | null;
  chatgptUrl: string | null;
};

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * Ready to book: the friend picked a time and gave their food preferences.
 * Book in ChatGPT (it tries the places in order), come back, and JustKetchup
 * finds the reservation in Google Calendar and updates the friend's invite.
 */
export default function Booking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [wentToChatGPT, setWentToChatGPT] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  const load = useCallback(async () => {
    try {
      setInvite(await api<Invite>(`/api/invites/${id}`));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await api<{ found: boolean }>(`/api/invites/${id}/check`, { method: 'POST' });
      if (r.found) await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setChecking(false);
    }
  }, [id, load]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from ChatGPT: look for the reservation straight away. Gmail can take
  // a minute to add it to the calendar, so check again shortly after.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (/inactive|background/.test(String(appState.current)) && next === 'active' && wentToChatGPT) {
        check();
        setTimeout(check, 30000);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [wentToChatGPT, check]);

  async function openChatGPT() {
    if (!invite?.chatgptUrl) return;
    setWentToChatGPT(true);
    await Linking.openURL(invite.chatgptUrl);
  }

  function pickManually(p: Place) {
    Alert.alert(`Booked ${p.name}?`, `${invite?.contactName.split(' ')[0]} will get the details by email.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, booked',
        onPress: async () => {
          try {
            await api(`/api/invites/${id}/booked`, { method: 'POST', body: JSON.stringify({ placeId: p.id }) });
            await load();
          } catch (e: any) {
            Alert.alert('Could not save', e?.message ?? String(e));
          }
        },
      },
    ]);
  }

  const first = invite?.contactName.split(' ')[0] || 'your friend';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !invite ? (
        <Text style={styles.error}>{error ?? 'Not found'}</Text>
      ) : invite.status === 'confirmed' && invite.booked ? (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.kicker}>Booked</Text>
          <Text style={styles.h1}>{invite.booked.name}</Text>
          {invite.slot && <Text style={styles.body}>{when(invite.slot.start)}</Text>}
          {invite.booked.address && <Text style={styles.muted}>{invite.booked.address}</Text>}
          <Text style={styles.note}>
            It&apos;s in your Google Calendar, and {first} has been sent the details
            {invite.friendEmail ? ` at ${invite.friendEmail}` : ''}.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.kicker}>Ready to book</Text>
          <Text style={styles.h1}>Ketchup with {first}</Text>
          {invite.slot && <Text style={styles.body}>{when(invite.slot.start)} · table for 2</Text>}

          <Text style={styles.h2}>Places to try, in order</Text>
          {invite.shortlist.map((p, i) => (
            <View key={p.id} style={styles.place}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.placeName}>{p.name}</Text>
                <Text style={styles.muted}>★ {p.rating} · {p.reviews.toLocaleString()} reviews</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.button} onPress={openChatGPT} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Book with ChatGPT</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            ChatGPT tries each place for that exact time on Resy or OpenTable. Book there, then come back.
            We&apos;ll find the reservation in your calendar and send {first} the details.
          </Text>

          {checking && <Text style={styles.muted}>Looking for your reservation…</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          {wentToChatGPT && !checking && (
            <>
              <Text style={styles.h2}>Booked but not showing up?</Text>
              <Text style={styles.muted}>Tap the place you got.</Text>
              {invite.shortlist.map((p) => (
                <TouchableOpacity key={p.id} style={styles.pick} onPress={() => pickManually(p)}>
                  <Text style={styles.pickText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={check} style={{ marginTop: spacing.sm }}>
                <Text style={styles.link}>Check my calendar again</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  container: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  kicker: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: spacing.sm },
  error: { fontSize: 14, color: colors.danger, padding: spacing.lg },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  rank: { fontSize: 18, fontWeight: '800', color: colors.primary, width: 20, textAlign: 'center' },
  placeName: { fontSize: 16, fontWeight: '600', color: colors.text },
  button: { backgroundColor: '#10A37F', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  pick: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.card },
  pickText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
