// Yerel bildirim planlama. Sunucu/push gerektirmez; tamamen cihazda.
// Planlama mantığı notificationPlan.ts içinde (birim testli); burada Expo'ya yazılır.

import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Medication, Patient, Settings } from '../types';
import { planNotifications } from './notificationPlan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Bildirim izni ister. true = izin verildi. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted =
      req.granted ||
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  return granted;
}

/** Sistem bildirim izni şu an verilmiş mi? (UI'da "izin kapalı" uyarısı için.) */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  try {
    const s = await Notifications.getPermissionsAsync();
    return (
      s.granted ||
      s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'İlaç ve Rapor Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F766E',
      // Kilit ekranında içeriği OS gizlesin (sağlık verisi); bildirim görünür
      // ama metni güvenli kilit ekranında redakte edilir.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  } catch {
    /* bildirim modülü yoksa sessizce geç */
  }
}

// Bu oturumda aynı-gün nudge atılan anahtarlar.
const nudgedThisSession = new Set<string>();

let rescheduleLock: Promise<void> = Promise.resolve();

/**
 * Tüm planlı bildirimleri iptal eder ve mevcut duruma göre yeniden kurar.
 * Çağrılar sıraya alınır (yarış önleme). Planlanamayan sayısını döndürür.
 */
export function rescheduleAll(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
): Promise<number> {
  const run = rescheduleLock
    .catch(() => {})
    .then(() => doReschedule(patients, medications, settings));
  rescheduleLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function doReschedule(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
): Promise<number> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return 0;
  }

  if (!settings.notificationsEnabled) return 0;
  if (!(await getNotificationPermissionGranted())) return 0;
  await ensureAndroidChannel();

  const { items, dropped, nudgedKeys } = planNotifications(
    patients,
    medications,
    settings,
    new Date(),
    nudgedThisSession,
  );
  for (const k of nudgedKeys) nudgedThisSession.add(k);

  for (const item of items) {
    try {
      if (item.trigger.type === 'daily') {
        await Notifications.scheduleNotificationAsync({
          content: { title: item.title, body: item.body, data: item.data },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: item.trigger.hour,
            minute: item.trigger.minute,
          },
        });
      } else if (item.trigger.type === 'date') {
        await Notifications.scheduleNotificationAsync({
          content: { title: item.title, body: item.body, data: item.data },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.trigger.when,
          },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title: item.title, body: item.body, data: item.data },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: item.trigger.seconds,
          },
        });
      }
    } catch (e) {
      console.warn('Bildirim planlanamadı:', e);
    }
  }

  return dropped;
}

/** Test amaçlı: birkaç saniye sonra örnek bildirim gönderir. */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 İlaç Takip',
      body: 'Bildirimler çalışıyor! Bitişe yaklaşan ilaç/raporlarda haber vereceğiz.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}

/**
 * Uygulama öne geldiğinde verilen geri çağrıyı çalıştırır.
 * Aboneliği iptal eden fonksiyonu döndürür.
 */
export function onAppForeground(cb: () => void): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') cb();
  });
  return () => sub.remove();
}
