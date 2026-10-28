import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { importContacts } from '../../lib/contacts';
import { normalizePhone, type TierValue } from '../../lib/tiers';
import TierPicker from '../../components/TierPicker';
import { colors, spacing } from '../../lib/theme';

type PhoneContact = { id: string; name: string; phone: string };

export default function ImportContacts() {
  const router = useRouter();
  const [permission, setPermission] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [all, setAll] = useState<PhoneContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<TierValue>('friendly');
  const [saving, setSaving] = useState(false);

  async function loadPhoneContacts() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setPermission('denied');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    });

    const cleaned: PhoneContact[] = [];
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
  }

  useEffect(() => {
    loadPhoneContacts();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [all, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    const picked = all.filter((c) => selected.has(c.id));
    if (picked.length === 0) {
      return Alert.alert('Pick someone', 'Select at least one person to import.');
    }

    setSaving(true);
    try {
      const { added, skipped } = await importContacts(
        picked.map((c) => ({ name: c.name, phone: c.phone, tier }))
      );
      Alert.alert(
        'Imported',
        `Added ${added} ${added === 1 ? 'person' : 'people'}.` +
          (skipped > 0 ? ` Skipped ${skipped} already saved.` : ''),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Could not import', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (permission === 'loading') {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.hint}>Reading your contacts…</Text>
      </SafeAreaView>
    );
  }

  if (permission === 'denied') {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <Text style={styles.emptyTitle}>Contacts access needed</Text>
        <Text style={styles.emptyBody}>
          JustKetchup needs permission to read your contacts so you can pick who to stay in touch
          with. Your contacts stay on your device unless you import them.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openSettings()}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={loadPhoneContacts} style={{ marginTop: spacing.md }}>
          <Text style={styles.retry}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your contacts"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
        <TierPicker value={tier} onChange={setTier} label="How often for everyone you pick?" />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const checked = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, checked && styles.rowChecked]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>
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
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>
              Import{selected.size > 0 ? ` ${selected.size}` : ''}
            </Text>
          )}
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowChecked: { borderColor: colors.primary, borderWidth: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  phone: { fontSize: 13, color: colors.muted, marginTop: 2 },
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
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  retry: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
