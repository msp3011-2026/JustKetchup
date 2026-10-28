import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';

type Hood = { id: string; name: string };

/**
 * "Your preferred neighborhoods to ketchup" — the neighborhoods you're open to. Friends
 * pick one of these on the invite page, and restaurants are found inside it.
 */
export default function MeetPlacesPicker({
  buttonLabel,
  onSaved,
}: {
  buttonLabel: string;
  onSaved: () => void;
}) {
  const [hoods, setHoods] = useState<Hood[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const [{ data: all, error }, { data: me }] = await Promise.all([
          supabase.from('neighborhoods').select('id, name').order('name'),
          supabase.from('users').select('meet_neighborhood_ids').eq('id', userData.user?.id ?? '').maybeSingle(),
        ]);
        if (error) throw error;
        setHoods(all ?? []);
        setPicked((me as any)?.meet_neighborhood_ids ?? []);
      } catch (e: any) {
        Alert.alert('Could not load neighborhoods', e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    if (picked.length === 0) {
      return Alert.alert('Pick at least one', 'Choose a neighborhood or two you’d love to ketchup in.');
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .update({ meet_neighborhood_ids: picked })
        .eq('id', userData.user?.id ?? '');
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your preferred neighborhoods to ketchup</Text>
        <Text style={styles.body}>
          The spots that are easy for you to get to. When you invite a friend, they pick one of these
          and we find great places to eat there.
        </Text>
        <View style={styles.chips}>
          {hoods.map((h) => {
            const on = picked.includes(h.id);
            return (
              <TouchableOpacity
                key={h.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(h.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{h.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (saving || picked.length === 0) && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {buttonLabel}
              {picked.length > 0 ? ` (${picked.length})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  button: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
