// Internal DB values stay warm/friendly/keep_warm.
// Users only ever see the plain-English labels.
export const TIERS = [
  { value: 'warm', label: 'Monthly', description: 'Once a month', days: 30 },
  { value: 'friendly', label: 'Quarterly', description: 'Every 3 months', days: 90 },
  { value: 'keep_warm', label: 'Twice a year', description: 'Every 6 months', days: 180 },
] as const;

export type TierValue = (typeof TIERS)[number]['value'];

export function tierLabel(value: string): string {
  return TIERS.find((t) => t.value === value)?.label ?? value;
}

/**
 * Beta testers should feel the product right away rather than waiting a full
 * tier interval. Nudges are phased out from today: 0, 2, 4, 6... days apart,
 * capped at 14 days.
 */
export function phasedNudgeDate(index: number): string {
  const offsetDays = Math.min(index * 2, 14);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Normalizes messy contact-book numbers to E.164 (US default). */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}
