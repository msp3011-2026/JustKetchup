import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '../lib/googleAuth';
import { colors, spacing } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>JustKetchup</Text>
          <Text style={styles.tagline}>
            Stay close to the people who matter.{'\n'}We'll handle the reaching out.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  hero: { alignItems: 'center', marginBottom: spacing.xl * 2 },
  logo: { fontSize: 40, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  tagline: { fontSize: 17, color: colors.muted, textAlign: 'center', lineHeight: 25 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  legal: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
});
