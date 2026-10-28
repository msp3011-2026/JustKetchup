import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // null = not loaded yet
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // 1. Track the auth session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // 2. Once we have a user, find out whether they finished onboarding.
  useEffect(() => {
    let cancelled = false;

    if (!session?.user) {
      setOnboarded(null);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('[JustKetchup] Could not load profile:', error.message);
        setOnboarded(false);
        return;
      }
      setOnboarded(Boolean(data?.onboarding_completed));
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // 3. Send the user to the right place.
  //    Only redirects when the user is somewhere they shouldn't be, so normal
  //    navigation (home -> contacts -> edit) is never interrupted.
  useEffect(() => {
    if (authLoading) return;

    const root = segments[0];

    if (!session) {
      if (root !== undefined) router.replace('/');
      return;
    }

    if (onboarded === null) return; // profile still loading

    if (onboarded === false) {
      if (root !== 'onboarding') router.replace('/onboarding/info');
      return;
    }

    // Onboarded: the login screen is the only place they shouldn't be.
    if (root === undefined || root === 'onboarding') {
      router.replace('/home');
    }
  }, [authLoading, session, onboarded, segments]);

  if (authLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
