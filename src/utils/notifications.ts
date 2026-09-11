// Yerel bildirim planlama. Sunucu/push gerektirmez; tamamen cihazda.
//
// Strateji: her yeniden planlamada önce tüm planlı bildirimleri iptal edip,
// mevcut ilaç/rapor/son-kullanma durumuna göre yeniden kurarız. Böylece
// silinen ya da güncellenen kayıtlar için eski bildirim kalmaz.
//
// ÖNEMLİ — iOS sınırı: iOS bir uygulamada en fazla 64 bekleyen bildirim
// tutar; fazlası SESSİZCE atılır. Polifarmasi hastalarında (çok ilaç × çok
// saat × çok hasta) bu sınır kolayca aşılabilir. Bu yüzden:
//   1) Günlük "ilaç saati" hatırlatmalarını saat dilimine göre BİRLEŞTİRİRİZ
//      (her benzersiz saat için tek bildirim, içinde o saatteki tüm ilaçlar),
//   2) Toplam planlanan bildirimi bir bütçeyle sınırlarız.

import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Medication, Patient, Settings } from '../types';
import { buildUrgencyList, isDepleted } from './status';
import { addDays, formatTR, startOfDay } from './date';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// iOS bekleyen bildirim üst sınırı 64; kendimize güvenli pay bırakırız.
const SCHEDULE_BUDGET = 58;

/** Bildirim izni ister. true = izin verildi. */
export async function requestNotificationPermission(): Promise<boolean> {
  // Android kanalını her durumda (izinden bağımsız) hazır tut.
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

// Bu oturumda zaten "geç kalmış" uyarı için bir kez bildirim attığımız
// öğeler — her yeniden planlamada tekrar atmamak için.
const nudgedThisSession = new Set<string>();

// Yeniden planlamaları SIRAYA dizen kilit: iki eşzamanlı reschedule'ın
// (ör. veri değişimi + uygulamanın öne gelmesi) cancel/schedule yarışına
// girmesini engeller.
let rescheduleLock: Promise<void> = Promise.resolve();

/**
 * Tüm planlı bildirimleri iptal eder ve mevcut duruma göre yeniden kurar.
 * Çağrılar sıraya alınır (yarış önleme).
 */
export function rescheduleAll(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
): Promise<number> {
  // Serileştirme kilidini koru ama planlanamayan sayısını çağırana döndür.
  const run = rescheduleLock
    .catch(() => {})
    .then(() => doReschedule(patients, medications, settings));
  rescheduleLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Tüm planlı bildirimleri kurar; cihaz/bütçe sınırı (iOS 64 ≈ 58) nedeniyle
 * PLANLANAMAYAN öğe sayısını döndürür (0 = hepsi kuruldu). UI bu sayı > 0 ise
 * kullanıcıyı uyarır (sessiz düşürme yerine).
 */
async function doReschedule(
  patients: Patient[],
  medications: Medication[],
  settings: Settings,
): Promise<number> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // bildirim modülü yoksa (ör. bazı web ortamları) sessizce geç
    return 0;
  }

  if (!settings.notificationsEnabled) return 0;
  // Ayar "açık" olsa bile gerçek sistem izni yoksa planlama yapma; aksi halde
  // her şey sessizce başarısız olur (kullanıcı "açık" sanır). UI bu durumu
  // ayrıca bir uyarı bandıyla bildirir (bkz. notificationsGranted).
  if (!(await getNotificationPermissionGranted())) return 0;
  await ensureAndroidChannel();

  const patientName = new Map(patients.map((p) => [p.id, p.fullName]));
  const now = new Date();
  let budget = SCHEDULE_BUDGET;
  let dropped = 0; // bütçe nedeniyle planlanamayan öğe sayısı
  // Gizlilik: açıksa bildirim gövdesinde hasta/ilaç adı geçmez (kilit ekranı).
  const hide = settings.hideSensitiveNotifications;

  // 1) Günlük "ilaç saati" hatırlatmaları — saat dilimine göre BİRLEŞTİRİLİR.
  //    Stoğu tükenmiş ilaçlar atlanır (boşuna "al" demeyelim).
  const byTime = new Map<string, string[]>(); // "HH:MM" -> ["Ayşe — Coraspin", ...]
  for (const med of medications) {
    if (!med.doseTimes || med.doseTimes.length === 0) continue;
    // Stoğu GERÇEKTEN tükenmiş (trackStock + sayım 0) ilaçta "al" demek yanlış
    // olur; bunları aşağıdaki günlük "yenile" eskalasyonuna bırakırız. Salt-
    // hatırlatma ilaçları (stok takip edilmeyen) bundan ETKİLENMEZ — hatırlatma
    // sürer; yani stok TAHMİNİYLE susturma yapılmaz.
    if (isDepleted(med)) continue;
    const who = patientName.get(med.patientId) ?? 'Hasta';
    for (const time of med.doseTimes) {
      if (!/^\d{1,2}:\d{2}$/.test(time)) continue;
      const list = byTime.get(time) ?? [];
      list.push(`${who} — ${med.name}`);
      byTime.set(time, list);
    }
  }

  const sortedTimes = [...byTime.keys()].sort();
  for (let ti = 0; ti < sortedTimes.length; ti++) {
    if (budget <= 0) {
      dropped += sortedTimes.length - ti;
      break;
    }
    const time = sortedTimes[ti];
    const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const list = byTime.get(time)!;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ İlaç saati ${time}`,
          body: hide
            ? `${list.length} ilaç alınacak — ayrıntı için uygulamayı açın`
            : list.join('\n'),
          data: { kind: 'dose', time },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hh,
          minute: mm,
        },
      });
      budget--;
    } catch (e) {
      console.warn('İlaç saati bildirimi planlanamadı:', e);
    }
  }

  // 1b) TÜKENEN ilaçlar: günlük "yenile" eskalasyonu (tek bildirim). Stoğu
  //     bitmiş ilaçlar yukarıda "al" listesinden çıkarıldı; sessiz kalmak
  //     yerine her gün yenileme çağrısı yapılır (refill edilince düşer).
  const depleted = medications.filter((m) => isDepleted(m));
  if (depleted.length > 0 && budget <= 0) dropped += 1;
  if (depleted.length > 0 && budget > 0) {
    const body = hide
      ? `${depleted.length} ilaç bitti — ayrıntı için uygulamayı açın`
      : depleted
          .map((m) => `${patientName.get(m.patientId) ?? 'Hasta'} — ${m.name}`)
          .join('\n');
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Biten ilaç(lar) — yenileyin',
          body,
          data: { kind: 'depleted' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: settings.reminderHour,
          minute: 0,
        },
      });
      budget--;
    } catch (e) {
      console.warn('Tükenme eskalasyonu planlanamadı:', e);
    }
  }

  // 2) İlaç/rapor/son-kullanma uyarıları — en yakın bitiş önce (öncelik).
  //    Her öğe için iki kademe: (a) eşik gün kala ön-uyarı, (b) bitiş günü.
  //    Tükenen stok kalemleri buildUrgencyList'te zaten yok; yukarıdaki günlük
  //    eskalasyon onları kapsar (çift planlama / bütçe israfı yok).
  const items = buildUrgencyList(medications, settings.warnDaysBefore);

  for (let ii = 0; ii < items.length; ii++) {
    if (budget <= 0) {
      dropped += items.length - ii;
      break;
    }
    const item = items[ii];
    const who = patientName.get(item.medication.patientId) ?? 'Hasta';

    const preWarn = new Date(addDays(startOfDay(item.date), -settings.warnDaysBefore));
    preWarn.setHours(settings.reminderHour, 0, 0, 0);
    const dayOf = new Date(startOfDay(item.date));
    dayOf.setHours(settings.reminderHour, 0, 0, 0);

    const labelSoon = labelFor(item.kind, item.medication.name, false);
    const labelDue = labelFor(item.kind, item.medication.name, true);
    const tail = `${who} — ${formatTR(item.date)}. Reçete/rapor için planlama yapın.`;
    const hidden = 'Bir hatırlatma var — ayrıntı için uygulamayı açın.';

    budget = await scheduleOneShot(
      preWarn,
      now,
      `${item.medication.id}:${item.kind}:pre`,
      '💊 İlaç Takip Hatırlatması',
      hide ? hidden : `${labelSoon}. ${tail}`,
      { medicationId: item.medication.id, kind: item.kind, stage: 'pre' },
      budget,
    );
    if (budget <= 0) break;
    budget = await scheduleOneShot(
      dayOf,
      now,
      `${item.medication.id}:${item.kind}:due`,
      '💊 İlaç Takip Hatırlatması',
      hide ? hidden : `${labelDue}. ${tail}`,
      { medicationId: item.medication.id, kind: item.kind, stage: 'due' },
      budget,
    );
  }

  return dropped;
}

function labelFor(
  kind: 'stock' | 'report' | 'expiry',
  name: string,
  due: boolean,
): string {
  if (kind === 'stock') {
    return due ? `${name} ilacı bugün bitiyor` : `${name} ilacı bitmek üzere`;
  }
  if (kind === 'report') {
    return due ? `${name} raporu bugün doluyor` : `${name} raporu bitmek üzere`;
  }
  return due
    ? `${name} kutusunun son kullanma tarihi bugün`
    : `${name} kutusunun son kullanma tarihi yaklaşıyor`;
}

/**
 * Belirli bir tarihte tek seferlik bildirim kurar.
 * - Tarih gelecekteyse: o tarihe planlar.
 * - Bugün ama saati geçmişse (#aynı-gün-kaçırma): bu oturumda bir kez,
 *   kısa süre sonra (60 sn) bir hatırlatma atar (sessizce düşürmek yerine).
 * - Geçmiş bir günse: atlar.
 * Kalan bütçeyi döndürür.
 */
async function scheduleOneShot(
  when: Date,
  now: Date,
  key: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  budget: number,
): Promise<number> {
  if (budget <= 0) return budget;

  if (when.getTime() > now.getTime()) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
      return budget - 1;
    } catch (e) {
      console.warn('Bildirim planlanamadı:', e);
      return budget;
    }
  }

  // Saati geçmiş ama AYNI GÜN ise: oturumda bir kez kısa gecikmeli hatırlat.
  // Anahtara tarih eklenir ki gün değişince (ya da yenileme sonrası tetikleyici
  // ileri bir güne kayınca) aynı anahtar yeni günü kalıcı olarak bastırmasın.
  const sameDay = startOfDay(when).getTime() === startOfDay(now).getTime();
  const sessionKey = `${key}:${startOfDay(when).toISOString().slice(0, 10)}`;
  if (sameDay && !nudgedThisSession.has(sessionKey)) {
    nudgedThisSession.add(sessionKey);
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 60,
        },
      });
      return budget - 1;
    } catch (e) {
      console.warn('Aynı-gün bildirimi planlanamadı:', e);
      return budget;
    }
  }

  return budget;
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
 * Uygulama öne geldiğinde verilen geri çağrıyı çalıştırır (gün değişince
 * bildirimleri güncel tarihe göre yeniden kurmak için). Aboneliği iptal eden
 * fonksiyonu döndürür.
 */
export function onAppForeground(cb: () => void): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') cb();
  });
  return () => sub.remove();
}
