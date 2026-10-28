import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';

export default function ContactsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Your people' }} />
      <Stack.Screen name="new" options={{ title: 'Add someone', presentation: 'modal' }} />
      <Stack.Screen name="import" options={{ title: 'Import from iPhone' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit contact' }} />
    </Stack>
  );
}
