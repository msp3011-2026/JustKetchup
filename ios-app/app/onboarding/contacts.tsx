import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts/legacy';
import { useRouter } from 'expo-router';
import { normalizePhone } from '../../lib/tiers';
import { setSelectedContacts, type PickedContact } from '../../lib/store';
import { colors, spacing } from '../../lib/theme';

export default function ContactPicker() {
  const router = useRouter();
  const [permission, setPermission] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [all, setAll] = useState<PickedContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      const cleaned: PickedContact[] = [];
      const seenPhones = new Set<string>();

      for (const c of data) {
        const raw = c.phoneNumbers?.[0]?.number;
        if (!raw) continue;
        const phone = normalizePhone(raw);
        if (!phone || seenPhones.has(phone)) continue;

        const name = (c.name || '').trim();
        if (!name) continue;

        seenPhones.add(phone);
        cleaned.push({ id: c.id ?? phone, name, phone });
      }

      cleaned.sort((a, b) => a.name.localeCompare(b.name));
      setAll(cleaned);
      setPermission('granted');
    })();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [all, query]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleContinue() {
    const picked = all.filter((c) => selectedIds.has(c.id));
    if (picked.length === 0) {
      return Alert.alert('Pick someone', 'Choose at least one person you want to stay in touch with.');
    }
    setSelectedContacts(picked);
    router.push('/onboarding/tiers');
  }

  if (permission === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.hint}>Loading your contacts…</Text>
      </SafeAreaView>
    );
  }

  if (permission === 'denied') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Contacts access needed</Text>
        <Text style={styles.subtitle}>
          JustKetchup needs your contacts so you can choose who to stay in touch with. Enable it in
          Settings → JustKetchup → Contacts, then reopen the app.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 2 of 3</Text>
        <Text style={styles.title}>Who do you want to stay close to?</Text>
        <Text style={styles.subtitle}>Pick a few people to start. You can add more later.</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const checked = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, checked && styles.rowChecked]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowPhone}>{item.phone}</Text>
              </View>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.hint}>
            No contacts with phone numbers found{query ? ' for that search' : ''}.
          </Text>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.buttonText}>
            Continue{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  step: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: spacing.md,
    lineHeight: 22,
    textAlign: 'left',
  },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  rowChecked: { borderColor: colors.primary, borderWidth: 2 },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowPhone: { fontSize: 13, color: colors.muted, marginTop: 2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.primaryText, fontSize: 15, fontWeight: '800' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: spacing.md },
});
