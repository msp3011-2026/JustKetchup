import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TIERS, type TierValue } from '../lib/tiers';
import { colors, spacing } from '../lib/theme';

type Props = {
  value: TierValue;
  onChange: (value: TierValue) => void;
  label?: string;
};

export default function TierPicker({ value, onChange, label = 'How often?' }: Props) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {TIERS.map((tier) => {
          const active = value === tier.value;
          return (
            <TouchableOpacity
              key={tier.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(tier.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{tier.label}</Text>
              <Text style={[styles.chipSub, active && styles.chipSubActive]}>
                {tier.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipLabelActive: { color: colors.primaryText },
  chipSub: { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
  chipSubActive: { color: colors.primaryText, opacity: 0.9 },
});
