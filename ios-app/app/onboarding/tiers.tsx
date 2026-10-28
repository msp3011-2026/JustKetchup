import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { TIERS, phasedNudgeDate, type TierValue } from '../../lib/tiers';
import { clearSelectedContacts, getSelectedContacts } from '../../lib/store';
import { colors, spacing } from '../../lib/theme';

export default function Tiers() {
  const router = useRouter();
  const contacts = useMemo(() => getSelectedContacts(), []);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, TierValue>>(() =>
    Object.fromEntries(contacts.map((c) => [c.id, 'friendly' as TierValue]))
  );

  function setTier(contactId: string, tier: TierValue) {
    setAssignments((prev) => ({ ...prev, [contactId]: tier }));
  }

  async function handleFinish() {
    if (contacts.length === 0) {
      return Alert.alert('No contacts', 'Go back and pick a few people first.');
    }

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) throw new Error('You are signed out. Please sign in again.');

      const rows = contacts.map((c, index) => ({
        user_id: user.id,
        name: c.name,
        phone: c.phone,
        tier: assignments[c.id] ?? 'friendly',
        // Phased from today so beta testers get nudges right away.
        next_nudge_date: phasedNudgeDate(index),
      }));

      const { error: insertError } = await supabase.from('contacts').insert(rows);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      if (updateError) throw updateError;

      clearSelectedContacts();
      router.replace('/home');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 3 of 3</Text>
        <Text style={styles.title}>How often?</Text>
        <Text style={styles.subtitle}>
          Choose how often you'd like to reconnect with each person.
        </Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            <View style={styles.tierRow}>
              {TIERS.map((tier) => {
                const active = (assignments[item.id] ?? 'friendly') === tier.value;
                return (
                  <TouchableOpacity
                    key={tier.value}
                    style={[styles.tierChip, active && styles.tierChipActive]}
                    onPress={() => setTier(item.id, tier.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tierLabel, active && styles.tierLabelActive]}>
                      {tier.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleFinish}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Finish setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  step: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.md, lineHeight: 22 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  cardName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  tierRow: { flexDirection: 'row', gap: spacing.sm },
  tierChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tierChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tierLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tierLabelActive: { color: colors.primaryText },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
});
