import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { api } from './api';

// Google sign-in that also grants Google Calendar access. `access_type=offline`
// and `prompt=consent` make Google return a refresh token, which we hand to the
// server so it can read free times and add confirmed meetups while the app is
// closed. Returns false if the person cancelled.
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
].join(' ');

export async function signInWithGoogle(): Promise<boolean> {
  // Resolves to justketchup://auth-callback in a build, and to the Expo Go
  // proxy URL while developing. Both must be in Supabase's redirect list.
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: CALENDAR_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase did not return a sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const [, fragment] = result.url.split('#');
  const [, query] = result.url.split('?');
  const params = new URLSearchParams(fragment ?? query ?? '');

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');
  let googleRefresh = params.get('provider_refresh_token');

  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
  } else if (code) {
    const { data: ex, error: codeError } = await supabase.auth.exchangeCodeForSession(code);
    if (codeError) throw codeError;
    googleRefresh = googleRefresh ?? ex.session?.provider_refresh_token ?? null;
  } else {
    throw new Error('Google did not return a session. Check your Supabase redirect URLs.');
  }

  if (googleRefresh) {
    try {
      await api('/api/google/connect', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: googleRefresh }),
      });
    } catch (e: any) {
      // Signed in either way; the invite screen will offer to reconnect.
      console.warn('[JustKetchup] Could not save Google Calendar access:', e?.message ?? e);
    }
  } else {
    console.warn('[JustKetchup] Google returned no refresh token; calendar not connected.');
  }
  return true;
}
