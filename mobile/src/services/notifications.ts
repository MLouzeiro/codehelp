import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permissao de notificacoes negada');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id',
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrao',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    });

    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgente',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#ef4444',
      sound: 'default',
    });
  }

  // Send token to backend
  try {
    await api.post('/alerts/agent/config', { pushToken: token.data });
  } catch {
    // Non-critical
  }

  return token.data;
}

export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (notification: Notifications.NotificationResponse) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener(onNotificationReceived);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export function getNotificationIcon(tipo: string): string {
  switch (tipo) {
    case 'novo_ticket': return '🎫';
    case 'cliente_respondeu': return '💬';
    case 'sla_alerta': return '⏰';
    case 'sla_vencido': return '🔴';
    case 'transferencia': return '🔀';
    case 'aprovacao_pendente': return '✅';
    case 'mensagem_recebida': return '📩';
    case 'avaliacao_recebida': return '⭐';
    default: return '🔔';
  }
}
