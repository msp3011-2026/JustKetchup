import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MeetPlacesPicker from '../../components/MeetPlacesPicker';
import { colors } from '../../lib/theme';

export default function OnboardingPlaces() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <MeetPlacesPicker buttonLabel="Next" onSaved={() => router.push('/onboarding/contacts')} />
    </SafeAreaView>
  );
}
