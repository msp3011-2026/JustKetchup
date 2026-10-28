import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MeetPlacesPicker from '../../components/MeetPlacesPicker';
import { colors, spacing } from '../../lib/theme';

export default function SettingsPlaces() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 17, color: colors.primary, fontWeight: '600' }}>‹ Back</Text>
        </TouchableOpacity>
      </View>
      <MeetPlacesPicker buttonLabel="Save" onSaved={() => router.back()} />
    </SafeAreaView>
  );
}
