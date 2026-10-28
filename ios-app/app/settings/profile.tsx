import { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { signInWithGoogle } from '../../lib/googleAuth';
import { normalizePhone } from '../../lib/tiers';
import { DIETARY, CUISINES } from '../../lib/food';
import { colors, spacing } from '../../lib/theme';

type Profile = {
  name: string;
  phone: string;
  city: string;
  dietary: string[];
  cuisines: string[];
};

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Everything about you in one place: who you are, where you ketchup, what you eat. */
export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [original, setOriginal] = useState<Profile | null>(null);
  const [p, setP] = useState<Profile>({ name: '', phone: '', city: '', dietary: [], cuisines: [] });
  const [hoodNames, setHoodNames] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<'checking' | 'connected' | 'not_connected'>('checking');

  const load = useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;
      setEmail(user.email ?? '');
      const { data: me, error } = await supabase
        .from('users')
        .select('name, phone, city, dietary, cuisines, meet_neighborhood_ids')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const prof: Profile = {
        name: me?.name ?? '',
        phone: me?.phone ?? '',
        city: me?.city ?? '',
        dietary: (me as any)?.dietary ?? [],
        cuisines: (me as any)?.cuisines ?? [],
      };
      setP(prof);
      setOriginal(prof);
      const ids: string[] = (me as any)?.meet_neighborhood_ids ?? [];
      if (ids.length) {
        const { data: hoods } = await supabase.from('neighborhoods').select('name').in('id', ids).order('name');
        setHoodNames((hoods ?? []).map((h) => h.name));
      } else {
        setHoodNames([]);
      }
      // Is Google Calendar connected? The free-times check answers that.
      api<{ connected: boolean }>('/api/me/slots')
        .then((r) => setCalendar(r.connected ? 'connected' : 'not_connected'))
        .catch(() => setCalendar('not_connected'));
    } catch (e: any) {
      Alert.alert('Could not load your profile', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const dirty = original !== null && JSON.stringify(p) !== JSON.stringify(original);

  function toggle(key: 'dietary' | 'cuisines', v: string) {
    setP((cur) => ({
      ...cur,
      [key]: cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v],
    }));
  }

  async function save() {
    const name = p.name.trim();
    const city = p.city.trim();
    const phone = normalizePhone(p.phone);
    if (!name) return Alert.alert('Your name', 'Please add your name. It’s how friends see your invites.');
    if (!phone) return Alert.alert('Mobile number', 'Please add a valid mobile number, like (555) 123-4567.');
    if (!city) return Alert.alert('Your city', 'Please add your city.');
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('users')
        .update({ name, phone, city, dietary: p.dietary, cuisines: p.cuisines })
        .eq('id', u.user?.id ?? '');
      if (error) throw error;
      const saved = { ...p, name, phone, city };
      setP(saved);
      setOriginal(saved);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function reconnect() {
    try {
      if (await signInWithGoogle()) load();
    } catch (e: any) {
      Alert.alert('Could not connect Google Calendar', e?.message ?? String(e));
    }
  }

  function signOut() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  function goBack() {
    if (!dirty) return router.back();
    Alert.alert('Discard changes?', 'You have edits that aren’t saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your profile</Text>
        <View style={{ width: 56 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>About you</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={p.name} onChangeText={(t) => setP({ ...p, name: t })} autoCapitalize="words" />
            <Text style={styles.label}>Mobile number</Text>
            <TextInput style={styles.input} value={p.phone} onChangeText={(t) => setP({ ...p, phone: t })} keyboardType="phone-pad" />
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={p.city} onChangeText={(t) => setP({ ...p, city: t })} autoCapitalize="words" />
            {!!email && <Text style={styles.hint}>Signed in as {email}</Text>}

            <Text style={styles.section}>Your preferred neighborhoods to ketchup</Text>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/places')} activeOpacity={0.8}>
              <Text style={[styles.rowText, hoodNames.length === 0 && styles.rowEmpty]} numberOfLines={2}>
                {hoodNames.length ? hoodNames.join(', ') : 'Pick a few spots that are easy for you'}
              </Text>
              <Text style={styles.rowGo}>Edit ›</Text>
            </TouchableOpacity>

            <Text style={styles.section}>Dietary restrictions</Text>
            <Text style={styles.hint}>Optional. We&apos;ll skip places that don&apos;t work for you.</Text>
            <View style={styles.chips}>
              {DIETARY.map((d) => (
                <Chip key={d.v} on={p.dietary.includes(d.v)} label={d.label} onPress={() => toggle('dietary', d.v)} />
              ))}
            </View>
            <Text style={styles.section}>Favorite cuisines</Text>
            <Text style={styles.hint}>Optional. We use these when your friend doesn&apos;t mind what to eat.</Text>
            <View style={styles.chips}>
              {CUISINES.map((c) => (
                <Chip key={c.v} on={p.cuisines.includes(c.v)} label={c.label} onPress={() => toggle('cuisines', c.v)} />
              ))}
            </View>

            <Text style={styles.section}>Google Calendar</Text>
            <View style={styles.row}>
              <Text style={styles.rowText}>
                {calendar === 'checking'
                  ? 'Checking…'
                  : calendar === 'connected'
                    ? 'Connected. We use it to find your free times and add your ketchups.'
                    : 'Not connected'}
              </Text>
              {calendar === 'not_connected' && (
                <TouchableOpacity onPress={reconnect}>
                  <Text style={styles.rowGo}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={signOut} style={{ marginTop: spacing.xl, alignSelf: 'center' }}>
              <Text style={styles.signOut}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>

          {dirty && (
            <View style={styles.footer}>
              <TouchableOpacity style={[styles.button, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save changes</Text>}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 17, color: colors.primary, fontWeight: '600', width: 56 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  rowText: { flex: 1, fontSize: 15, color: colors.text },
  rowEmpty: { color: colors.muted },
  rowGo: { fontSize: 15, fontWeight: '700', color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  signOut: { fontSize: 15, color: colors.danger, fontWeight: '600' },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  button: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
