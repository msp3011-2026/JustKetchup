import { supabase } from './supabase';

// The web app on Vercel hosts the server side: Google Calendar, invite creation.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://justketchup.vercel.app').replace(/\/$/, '');

// Calls a server route as the signed-in user. Throws with the server's own
// error text, never a generic message, so problems are diagnosable.
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out. Please sign in again.');

  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status} from ${path}`);
  return body as T;
}
