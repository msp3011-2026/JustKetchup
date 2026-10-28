import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { registerForPush } from '../lib/push';
import { api } from '../lib/api';

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

  // 4. Once signed in: register for push, and look for new bookings in the
  //    calendar now and every time the app comes back to the front (e.g. after
  //    booking in ChatGPT).
  useEffect(() => {
    if (!session || onboarded !== true) return;
    registerForPush();
    const check = () => api('/api/me/check-bookings', { method: 'POST' }).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check();
    });
    return () => sub.remove();
  }, [session?.user?.id, onboarded]);

  // 5. Tapping "Shuchi picked Sat 7 PM, ready to book" opens that booking.
  useEffect(() => {
    if (!session || onboarded !== true) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const id = (r?.notification.request.content.data as any)?.inviteId;
      if (id) router.push(`/booking/${id}`);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [session?.user?.id, onboarded]);

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
