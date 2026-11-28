import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/** Canal do Android para os avisos do app. No iOS, canais não existem. */
export const CHANNEL_ID = 'alerts';

/**
 * Configuração inicial. Chamar uma vez, na abertura do app.
 * Sem o handler, o iOS não mostra a notificação enquanto o app está aberto.
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Pede permissão se ainda não foi pedida. Devolve se as notificações estão liberadas.
 * Se o usuário já recusou, o sistema não deixa perguntar de novo: só pelos Ajustes.
 */
export async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Avisos',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Mostra uma notificação agora. Não faz nada se não houver permissão. */
export async function notifyNow(title: string, body: string) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  });
}