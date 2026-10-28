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
import { deleteContact, listContacts, type Contact } from '../../lib/contacts';
import { tierLabel } from '../../lib/tiers';
import { colors, spacing } from '../../lib/theme';

export default function ContactsList() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setContacts(await listContacts());
    } catch (e: any) {
      Alert.alert('Could not load contacts', e?.message ?? String(e));
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

  function confirmDelete(contact: Contact) {
    Alert.alert(
      `Remove ${contact.name}?`,
      'They will stop appearing in your nudges. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(contact.id);
              setContacts((prev) => prev.filter((c) => c.id !== contact.id));
            } catch (e: any) {
              Alert.alert('Could not remove', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardMain}
              onPress={() => router.push(`/contacts/${item.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{item.phone}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tierLabel(item.tier)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              hitSlop={12}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one here yet</Text>
            <Text style={styles.emptyBody}>
              Add people you want to stay in touch with, and we'll nudge you when it's time.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/contacts/import')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Import from iPhone</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/contacts/new')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Add manually</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
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
  cardMain: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  phone: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  deleteBtn: { paddingLeft: spacing.md },
  deleteText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.primaryText, fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
