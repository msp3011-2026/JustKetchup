import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

// Show notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission and sends this phone's push token to the
 * server, so it can say "Shuchi picked Sat 7 PM, ready to book".
 * Quietly does nothing in Expo Go and the simulator, which can't receive pushes.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice || Constants.appOwnership === 'expo') return;
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/me/push-token', { method: 'POST', body: JSON.stringify({ token }) });
  } catch (e: any) {
    console.warn('[JustKetchup] Push setup skipped:', e?.message ?? e, Platform.OS);
  }
}
