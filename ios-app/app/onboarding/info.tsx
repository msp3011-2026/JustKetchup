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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/tiers';
import { colors, spacing } from '../../lib/theme';

export default function Info() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill from the Google profile so there's less typing.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      if (meta.full_name) setName(String(meta.full_name));
    });
  }, []);

  async function handleContinue() {
    const cleanName = name.trim();
    const cleanCity = city.trim();
    const e164 = normalizePhone(phone);

    if (!cleanName) return Alert.alert('Your name', 'Please enter your name.');
    if (!e164) return Alert.alert('Phone number', 'Enter a valid mobile number, e.g. (555) 123-4567.');
    if (!cleanCity) return Alert.alert('Your city', 'Please enter your city.');

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) throw new Error('You are signed out. Please sign in again.');

      const { error } = await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email,
          name: cleanName,
          phone: e164,
          city: cleanCity,
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      );
      if (error) throw error;

      router.push('/onboarding/places');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.step}>Step 1 of 3</Text>
          <Text style={styles.title}>A little about you</Text>
          <Text style={styles.subtitle}>
            We'll send you a notification when it's time to reconnect with someone.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Manasi Paraswar"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>This is where your nudges will arrive.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Your city</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="New York"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />
            <Text style={styles.hint}>Used to suggest places to meet.</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  step: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.xl, lineHeight: 22 },
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
  hint: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
});
