// Yerel bildirim planlama. Sunucu/push gerektirmez; tamamen cihazda.
//
// Strateji: her yeniden planlamada önce tüm planlı bildirimleri iptal
// edip, mevcut ilaç/rapor durumuna göre yeniden kurarız. Böylece
// silinen ya da güncellenen kayıtlar için eski bildirim kalmaz.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Medication, Patient, Settings } from '../types';
import { buildUrgencyList } from './status';
import { addDays, formatTR, parseISO, startOfDay } from './date';

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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'İlaç ve Rapor Hatırlatıcıları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F766E',
    });
  }

  return granted;
}

/**
 * Tüm planlı bildirimleri iptal eder ve mevcut duruma göre yeniden kurar.
 * Her ilaç/rapor için "bitişe warnDaysBefore gün kala" sabah reminderHour'da
 * tek bir bildirim planlanır (geçmişte kalanlar atlanır).
 */
export async function rescheduleAll(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // bildirim modülü yoksa (ör. bazı web ortamları) sessizce geç
    return;
  }

  if (!settings.notificationsEnabled) return;

  const patientName = new Map(patients.map((p) => [p.id, p.fullName]));
  const items = buildUrgencyList(medications, settings.warnDaysBefore);
  const now = new Date();

  for (const item of items) {
    // Bitişe warnDaysBefore gün kala, reminderHour saatinde
    const triggerDay = addDays(startOfDay(item.date), -settings.warnDaysBefore);
    const triggerDate = new Date(triggerDay);
    triggerDate.setHours(settings.reminderHour, 0, 0, 0);

    // Geçmişteyse planlama (bildirim anlamsız olur)
    if (triggerDate.getTime() <= now.getTime()) continue;

    const who = patientName.get(item.medication.patientId) ?? 'Hasta';
    const what =
      item.kind === 'stock'
        ? `${item.medication.name} ilacı bitmek üzere`
        : `${item.medication.name} raporu bitmek üzere`;
    const body = `${who} — ${formatTR(item.date)} tarihinde bitiyor. Reçete/rapor için planlama yapın.`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 İlaç Takip Hatırlatması',
          body: `${what}. ${body}`,
          data: { medicationId: item.medication.id, kind: item.kind },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    } catch (e) {
      console.warn('Bildirim planlanamadı:', e);
    }
  }
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
