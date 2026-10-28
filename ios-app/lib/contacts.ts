import { supabase } from './supabase';
import { phasedNudgeDate, type TierValue } from './tiers';

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  tier: TierValue | string;
  next_nudge_date: string | null;
};

export type ContactDraft = {
  name: string;
  phone: string;
  tier: TierValue;
  next_nudge_date?: string | null;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You are signed out. Please sign in again.');
  return data.user.id;
}

export async function listContacts(): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, user_id, name, phone, tier, next_nudge_date')
    .eq('user_id', userId)
    .order('next_nudge_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getContact(id: string): Promise<Contact | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, user_id, name, phone, tier, next_nudge_date')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      name: draft.name,
      phone: draft.phone,
      tier: draft.tier,
      // Default the first nudge to two days out so beta testers see the product
      // work quickly rather than waiting a full tier interval.
      next_nudge_date: draft.next_nudge_date ?? phasedNudgeDate(1),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContact(id: string, patch: Partial<ContactDraft>): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('contacts').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Bulk import. Skips numbers already saved so re-importing from the phone book
 * doesn't create duplicates. Returns how many were added and how many skipped.
 */
export async function importContacts(
  drafts: ContactDraft[]
): Promise<{ added: number; skipped: number }> {
  const userId = await requireUserId();

  const { data: existing, error: existingError } = await supabase
    .from('contacts')
    .select('phone')
    .eq('user_id', userId);
  if (existingError) throw existingError;

  const seen = new Set((existing ?? []).map((c) => c.phone));
  const fresh = drafts.filter((d) => !seen.has(d.phone));

  if (fresh.length === 0) return { added: 0, skipped: drafts.length };

  const rows = fresh.map((d, index) => ({
    user_id: userId,
    name: d.name,
    phone: d.phone,
    tier: d.tier,
    next_nudge_date: d.next_nudge_date ?? phasedNudgeDate(index),
  }));

  const { error } = await supabase.from('contacts').insert(rows);
  if (error) throw error;

  return { added: fresh.length, skipped: drafts.length - fresh.length };
}
