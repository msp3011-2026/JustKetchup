import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteContact, getContact, updateContact } from '../../lib/contacts';
import { normalizePhone, type TierValue } from '../../lib/tiers';
import TierPicker from '../../components/TierPicker';
import { colors, spacing } from '../../lib/theme';

export default function EditContact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState<TierValue>('friendly');
  const [nextNudge, setNextNudge] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getContact(String(id));
        if (cancelled) return;
        if (!c) {
          Alert.alert('Not found', 'That contact no longer exists.');
          router.back();
          return;
        }
        setName(c.name);
        setPhone(c.phone);
        setTier((c.tier as TierValue) ?? 'friendly');
        setNextNudge(c.next_nudge_date);
      } catch (e: any) {
        Alert.alert('Could not load', e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    const cleanName = name.trim();
    const e164 = normalizePhone(phone);
    if (!cleanName) return Alert.alert('Name', 'Please enter their name.');
    if (!e164) return Alert.alert('Phone number', 'Enter a valid mobile number.');

    setSaving(true);
    try {
      await updateContact(String(id), { name: cleanName, phone: e164, tier });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(`Remove ${name}?`, 'They will stop appearing in your nudges.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(String(id));
            router.back();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message ?? String(e));
          }
        },
      },
    ]);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <TierPicker value={tier} onChange={setTier} />
          </View>

          {nextNudge && (
            <Text style={styles.meta}>Next nudge scheduled for {nextNudge}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.buttonText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
            <Text style={styles.deleteButtonText}>Remove contact</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  meta: { fontSize: 13, color: colors.muted, marginBottom: spacing.lg },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  deleteButton: { paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  deleteButtonText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
