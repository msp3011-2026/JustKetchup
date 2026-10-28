import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { listContacts, type Contact } from '../lib/contacts';
import { tierLabel } from '../lib/tiers';
import { colors, spacing } from '../lib/theme';

export default function Home() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [toBook, setToBook] = useState<{ id: string; name: string; start: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.name) setFirstName(String(profile.name).split(' ')[0]);

      setContacts(await listContacts());

      // Friends who picked a time and are waiting for you to book.
      const { data: waiting } = await supabase
        .from('invites')
        .select('id, chosen_slot, contacts(name)')
        .eq('user_id', user.id)
        .eq('status', 'booking')
        .order('responded_at', { ascending: true });
      setToBook(
        (waiting ?? []).map((w: any) => ({
          id: w.id,
          name: String((Array.isArray(w.contacts) ? w.contacts[0]?.name : w.contacts?.name) ?? '').split(' ')[0],
          start: w.chosen_slot?.start,
        }))
      );
    } catch (e: any) {
      Alert.alert('Could not load', e?.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function formatDue(dateStr: string | null): string {
    if (!dateStr) return 'Not scheduled';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dateStr}T00:00:00`);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi{firstName ? ` ${firstName}` : ''} 👋</Text>
          <Text style={styles.subtitle}>Here's who you're staying close to.</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 10 }}>
          <TouchableOpacity onPress={() => router.push('/settings/places')} hitSlop={12}>
            <Text style={styles.signOut}>Where I meet</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} hitSlop={12}>
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {toBook.length > 0 && (
        <View style={styles.toBook}>
          {toBook.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.toBookCard}
              onPress={() => router.push(`/booking/${b.id}`)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toBookKicker}>Ready to book</Text>
                <Text style={styles.toBookText}>
                  {b.name} picked{' '}
                  {b.start
                    ? new Date(b.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
                      ' at ' +
                      new Date(b.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : 'a time'}
                </Text>
              </View>
              <Text style={styles.toBookGo}>Book ›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const due = formatDue(item.next_nudge_date);
          const urgent = due === 'Today' || due === 'Overdue';
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/contacts/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDue}>
                  <Text style={urgent ? styles.cardDueUrgent : undefined}>{due}</Text>
                  {'  ·  '}
                  {tierLabel(item.tier)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.ketchup}
                onPress={() => router.push(`/invite/${item.id}`)}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <Text style={styles.ketchupText}>Ketchup</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one here yet</Text>
            <Text style={styles.emptyBody}>
              Add the people you want to stay close to and we'll tell you when it's time to reach
              out.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/contacts')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Manage contacts</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: spacing.xs },
  signOut: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardName: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardDue: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cardDueUrgent: { color: colors.primary, fontWeight: '600' },
  toBook: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  toBookCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEDD5', borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: '#FDBA74' },
  toBookKicker: { fontSize: 12, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  toBookText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 2 },
  toBookGo: { fontSize: 16, fontWeight: '700', color: colors.primary },
  ketchup: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginLeft: spacing.sm,
  },
  ketchupText: { color: colors.primaryText, fontSize: 14, fontWeight: '700' },
  badge: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  empty: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
});
